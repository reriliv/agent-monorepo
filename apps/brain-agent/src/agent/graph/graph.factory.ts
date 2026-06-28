import { MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConversationNode } from './nodes/conversation.node';
import { ConversationRouter } from '../routers/conversation.router';
import { MemoryService } from '../../memory/memory.service';
import { AgentState } from './state.dto';
import { BaseMessage } from 'langchain';

type GraphState = {
  messages: BaseMessage[];
  title: string;
  summary: string;
  sessionId: string;
  traceId: string;
};

@Injectable()
export class GraphFactory implements OnModuleInit {
  private compiledGraph: any;
  private checkpoint: MemorySaver;

  constructor(
    private conversationNode: ConversationNode,
    private conversationRouter: ConversationRouter,
    private memoryService: MemoryService,
  ) {
    this.checkpoint = new MemorySaver();
  }

  async onModuleInit() {
    await this.buildGraph();
  }

  private async buildGraph() {
    const workflow = new StateGraph<GraphState>({
      channels: {
        messages: {
          reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
          default: () => [],
        },
        title: {
          reducer: (x: string, y: string) => y ?? x,
          default: () => '',
        },
        summary: {
          reducer: (x: string, y: string) => y ?? x,
          default: () => '',
        },
        sessionId: {
          reducer: (x: string, y: string) => y ?? x,
          default: () => '',
        },
        traceId: {
          reducer: (x: string, y: string) => y ?? x,
          default: () => '',
        },
      },
    })
      .addNode('conversation', async (state: GraphState) => {
        return this.conversationNode.invoke(state);
      })
      .addEdge(START, 'conversation')
      .addConditionalEdges('conversation', (state: GraphState) => {
        return this.conversationRouter.route(state as unknown as AgentState);
      });

    this.compiledGraph = workflow.compile({
      checkpointer: this.checkpoint,
    });
  }

  async invoke(sessionId: string, input: any) {
    const savedState = await this.memoryService.loadState(sessionId);

    const result = await this.compiledGraph.invoke({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
    }, {
      configurable: {
        thread_id: sessionId,
      },
    });

    await this.memoryService.saveState(sessionId, result);

    return {
      messages: result.messages,
      title: result.title,
      summary: result.summary,
    };
  }

  async *stream(sessionId: string, input: any) {
    const savedState = await this.memoryService.loadState(sessionId);

    const stream = await this.compiledGraph.stream({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
    }, {
      configurable: {
        thread_id: sessionId,
      },
    });

    let finalState: any = null;
    for await (const chunk of stream) {
      yield chunk;
      finalState = chunk;
    }

    if (finalState) {
      await this.memoryService.saveState(sessionId, finalState);
    }
  }

  async *streamEvents(sessionId: string, input: any) {
    const savedState = await this.memoryService.loadState(sessionId);

    const stream = await this.compiledGraph.streamEvents({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
    }, {
      configurable: {
        thread_id: sessionId,
      },
      version: 'v2',
    });

    for await (const event of stream) {
      yield event;
    }

    const finalState = await this.compiledGraph.getState({
      configurable: {
        thread_id: sessionId,
      },
    });

    if (finalState?.values) {
      await this.memoryService.saveState(sessionId, finalState.values);
    }
  }
}
