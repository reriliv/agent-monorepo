import { Controller, Get, Post, Query, Sse, Body, Delete, Param } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { GraphFactory } from './graph/graph.factory';
import { HumanMessage } from 'langchain';
import { MemoryService } from '../memory/memory.service';
import type { CleanEvent } from '@monorepo/shared';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly graphFactory: GraphFactory,
    private readonly memoryService: MemoryService,
  ) { }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('chat')
  async chat(@Body() body: { message: string; sessionId?: string; }) {
    const { message, sessionId } = body;
    const sid = sessionId || `session-${Date.now()}`;

    const result = await this.graphFactory.invoke(sid, {
      messages: [new HumanMessage(message)],
    });

    return {
      sessionId: sid,
      response: result.messages[result.messages.length - 1]?.content,
      summary: result.summary,
    };
  }

  @Get('chat/sse')
  @Sse()
  async chatSSE(
    @Query('message') message: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<Observable<MessageEvent>> {
    return this.createEventStream(message, sessionId);
  }

  @Post('chat/sse')
  @Sse()
  async chatSSEPost(
    @Body() body: { message: string; sessionId?: string; },
  ): Promise<Observable<MessageEvent>> {
    const { message, sessionId } = body;
    return this.createEventStream(message, sessionId);
  }

  private async createEventStream(
    message: string,
    sessionId?: string,
  ): Promise<Observable<MessageEvent>> {
    const eventSubject = new Subject<MessageEvent>();
    const sid = sessionId || `session-${Date.now()}`;

    (async () => {
      try {
        const stream = this.graphFactory.streamEvents(sid, { messages: [new HumanMessage(message)] });
        for await (const event of stream) {
          const cleanEvent = this.transformEvent(event);
          if (cleanEvent) {
            eventSubject.next({
              data: JSON.stringify(cleanEvent),
            } as MessageEvent);
          }
        }
        eventSubject.complete();
      } catch (error) {
        eventSubject.next({
          data: JSON.stringify({
            type: 'error',
            content: (error as Error).message,
          }),
        } as MessageEvent);
        eventSubject.complete();
      }
    })();

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => subscriber.next(event),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });
    });
  }

  private transformEvent(event: any): CleanEvent | null {
    const eventName = event.event;

    if (eventName === 'on_chat_model_stream') {
      const delta = event.data?.chunk?.choices?.[0]?.delta;
      if (delta?.content) {
        return {
          type: 'token',
          content: delta.content,
        };
      }
    }

    if (eventName === 'on_chat_model_end') {
      const output = event.data?.output;
      if (output) {
        const content = output.content;
        const toolCalls = output.tool_calls;
        if (content || toolCalls) {
          const result: CleanEvent = { type: 'message' };
          if (typeof content === 'string') {
            result.content = content;
          }
          if (toolCalls && toolCalls.length > 0) {
            result.toolName = toolCalls[0].name;
            result.toolArgs = toolCalls[0].args;
          }
          return result;
        }
      }
    }

    if (eventName === 'on_tool_start') {
      const input = event.data?.input;
      if (input) {
        return {
          type: 'tool_start',
          toolName: input.name,
          toolArgs: input.args,
        };
      }
    }

    if (eventName === 'on_tool_end') {
      const output = event.data?.output;
      if (output) {
        return {
          type: 'tool_end',
          toolResult: typeof output === 'string' ? output : JSON.stringify(output),
        };
      }
    }

    return null;
  }

  @Post('chat/stream')
  async chatStream(@Body() body: { message: string; sessionId?: string; }) {
    const { message, sessionId } = body;
    const sid = sessionId || `session-${Date.now()}`;

    const stream = this.graphFactory.stream(sid, {
      messages: [new HumanMessage(message)],
    });

    const responses: any[] = [];
    for await (const chunk of stream) {
      responses.push(chunk);
    }

    return {
      sessionId: sid,
      responses,
    };
  }

  @Get('conversations')
  async listConversations() {
    const conversations = await this.memoryService.listConversations();
    return { conversations };
  }

  @Get('conversation/:sessionId')
  async getConversation(@Param('sessionId') sessionId: string) {
    const state = await this.memoryService.loadState(sessionId);
    if (!state) {
      return { success: false, message: 'Conversation not found' };
    }

    const messages = state.messages.map((msg) => ({
      role: msg._getType() === 'human' ? 'user' : 'assistant',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    }));

    return {
      success: true,
      sessionId,
      title: state.title,
      summary: state.summary,
      messages,
    };
  }

  @Delete('conversation/:sessionId')
  async deleteConversation(@Param('sessionId') sessionId: string) {
    const success = await this.memoryService.deleteConversation(sessionId);
    return { success, sessionId };
  }

  @Post('sse')
  @Sse()
  sse() {
    const eventSubject = new Subject<MessageEvent>();

    setTimeout(() => {
      eventSubject.next({
        data: '1000ms sleep done',
      } as MessageEvent);

      eventSubject.complete();
    }, 2000);

    return new Observable((subscriber) => {
      eventSubject.subscribe({
        next: (event) => subscriber.next({ data: event } as MessageEvent),
        complete: () => subscriber.complete(),
        error: (err) => subscriber.error(err),
      });

      eventSubject.next({
        type: 'start',
        data: 'sse connect'
      } as MessageEvent);
    });
  }
}
