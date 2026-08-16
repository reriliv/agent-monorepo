import { Injectable } from '@nestjs/common';
import { BaseMessage, HumanMessage } from 'langchain';
import { messagesState, workflow } from './core';
import { Subject } from 'rxjs';
import { CleanEvent, Conversation } from '@monorepo/shared';
import fs from 'fs/promises';
import path from 'path';
import {
  AIMessage,
  MessageType,
  SystemMessage,
} from '@langchain/core/messages';

@Injectable()
export class AgentService {
  private aborter = new AbortController();
  private abortedSessionId: string = '';
  constructor() {}
  getHello(): string {
    return 'Hello from AgentService!';
  }

  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  async chat(
    eventSubject: Subject<CleanEvent>,
    message: string,
    sessionId?: string,
  ) {
    const sid = sessionId || crypto.randomUUID();
    // Here you would implement the logic to handle the chat message
    // For now, we just return a mock response
    const result = await workflow.invoke(
      { messages: [new HumanMessage(message)] },
      {
        signal: this.aborter.signal,
        // control: this.control,
        configurable: {
          thread_id: sid,
        },
      },
    );

    console.log('result');
    console.log(result);

    this.refreshSignal();

    const finalMessage = result.messages.at(-1);

    // eventSubject.next({
    //   type: 'message',
    //   data: {
    //     sessionId: sid,
    //     response: `Received message: ${message}`,
    //     summary: `Summary for session ${sid}`,
    //     llmCalls: result.llmCalls,
    //     chatResult: finalMessage?.content,
    //   },
    // } as unknown as MessageEvent);

    eventSubject.next({
      type: 'message',
      content: (finalMessage?.content as unknown as string) || '',
    });

    eventSubject.complete();

    // return {
    //   sessionId: sid,
    //   response: `Received message: ${message}`,
    //   summary: `Summary for session ${sid}`,
    //   llmCalls: result.llmCalls,
    //   chatResult: finalMessage,
    // };
  }

  private async runStream(
    eventSubject: Subject<CleanEvent>,
    thread_id: string,
    input: null | Parameters<typeof workflow.stream>[0] = null,
  ) {
    try {
      const stream = await workflow.stream(input, {
        signal: this.aborter.signal,
        configurable: {
          thread_id,
        },
        streamMode: 'messages',
      });

      // console.log('stream');
      // console.log(stream);

      // const messages: BaseMessage[] = [];

      // let finalState: AgentState | null = null;
      for await (const [messageChunk] of stream) {
        if (this.aborter.signal.aborted) {
          // save store
          break;
        }
        // console.log('chunk');
        // console.log(messageChunk);
        // console.log('metadata');
        // console.log(metadata);
        // messages.push(messageChunk);
        if (messageChunk.content) {
          let content = messageChunk.content;
          if (Array.isArray(content)) {
            content = content.map((c) => c.text).join(' ');
          }
          eventSubject.next({
            type: 'token',
            content,
          });
        }
        // yield chunk;
        // finalState = chunk;
        // yield eventSubject.next(chunk as unknown as CleanEvent);
      }
      // console.log('stream.values');
      // console.log(stream.values());
      await this.saveChat(thread_id);
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        console.log(`Stream paused/aborted for thread ${thread_id}`);
      } else {
        throw e;
      }
    } finally {
      eventSubject.complete();
    }
  }

  async chatSSE(
    eventSubject: Subject<CleanEvent>,
    message: string,
    sessionId?: string,
  ) {
    if (sessionId === this.abortedSessionId) {
      await this.resumeChatSse(eventSubject, sessionId);
      return;
    }

    const sid = sessionId || crypto.randomUUID();
    const messages = [
      ...(await this.loadMessages(sid)),
      new HumanMessage(message),
    ];

    await this.runStream(eventSubject, sid, {
      messages,
    });
    // const stream = await workflow.stream(
    //   { messages: [new HumanMessage(message)] },
    //   {
    //     control: this.control,
    //     configurable: {
    //       thread_id: sid,
    //     },
    //     streamMode: 'messages',
    //   },
    // );

    // console.log('stream');
    // console.log(stream);

    // // let finalState: AgentState | null = null;
    // for await (const [messageChunk, metadata] of stream) {
    //   if (this.aborter.signal.aborted) {
    //     // save store
    //     break;
    //   }
    //   console.log('chunk');
    //   console.log(messageChunk);
    //   console.log('metadata');
    //   console.log(metadata);
    //   if (messageChunk.content) {
    //     let content = messageChunk.content;
    //     if (Array.isArray(content)) {
    //       content = content.map((c) => c.text).join(' ');
    //     }
    //     eventSubject.next({
    //       type: 'token',
    //       content,
    //     });
    //   }
    //   // yield chunk;
    //   // finalState = chunk;
    //   // yield eventSubject.next(chunk as unknown as CleanEvent);
    // }
    // eventSubject.complete();

    // if (finalState) {
    //   await this.memoryService.saveState(sessionId, finalState);
    // }
  }

  async resumeChatSse(eventSubject: Subject<CleanEvent>, sessionId: string) {
    await this.runStream(eventSubject, sessionId);
  }

  private refreshSignal() {
    this.aborter = new AbortController();
  }

  cancelChat(sessionId: string) {
    this.aborter.abort('user cancel');
    this.abortedSessionId = sessionId;
    this.refreshSignal();
  }

  async loadConversations() {
    const conversationSummaryPath = path.resolve(
      process.cwd(),
      'conversations',
      'summary.json',
    );
    if (!(await this.canAccess(conversationSummaryPath))) {
      return [];
    }
    try {
      const content = await fs.readFile(conversationSummaryPath, 'utf-8');
      const conversations = JSON.parse(content) as Conversation[];
      return conversations;
    } catch {
      return [];
    }
  }

  private async loadMessages(sessionId: string) {
    try {
      const conversationPath = path.resolve(
        process.cwd(),
        'conversations',
        `${sessionId}.json`,
      );
      const content = JSON.parse(
        await fs.readFile(conversationPath, 'utf-8'),
      ) as Array<{
        content: string;
        type: MessageType;
      }>;
      return content.map((c) => {
        switch (c.type) {
          case 'ai':
            return new AIMessage(c.content);
          case 'human':
            return new HumanMessage(c.content);
          case 'system':
            return new SystemMessage(c.content);
          default:
            break;
        }
      }) as BaseMessage[];
    } catch (e) {
      console.log('error occur:');
      console.error(e);
      return [];
    }
  }

  private async canAccess(accessPath: string) {
    return await fs
      .access(accessPath)
      .then(() => true)
      .catch(() => false);
  }

  private async saveChat(sessionId: string) {
    console.log(sessionId);

    const stateResult = await workflow.getState({
      configurable: { thread_id: sessionId },
    });
    // let messages: BaseMessage[] = [];
    const state = stateResult.values as typeof messagesState.State | undefined;
    const messages = state?.messages || [];
    // state.values?.messages || [];
    console.log('messages\n');
    console.log(messages);

    const conversationPath = path.resolve(process.cwd(), 'conversations');
    const messagePath = path.resolve(conversationPath, `${sessionId}.json`);
    console.log('messagePath', messagePath);

    try {
      // const dir = path.dirname(conversationPath);
      let content: Array<{ content: string; type: MessageType }>;
      if (!(await this.canAccess(conversationPath))) {
        // create dir
        await fs.mkdir(conversationPath, { recursive: true });
      }
      if (await this.canAccess(messagePath)) {
        // append to bottom
        content = JSON.parse(await fs.readFile(messagePath, 'utf-8')) as Array<{
          content: string;
          type: MessageType;
        }>;
        messages.forEach((m) =>
          content.push({ type: m.type, content: m.content as string }),
        );
      } else {
        content = messages.map((m) => ({
          content: m.content as string,
          type: m.type,
        }));
      }
      await fs.writeFile(conversationPath, JSON.stringify(content), 'utf-8');
      await updateSummary();
      return `File written successfully to ${conversationPath}`;
    } catch (error) {
      return `Error writing file: ${(error as Error).message}`;
    }
  }
}
