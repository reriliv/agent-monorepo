import {
  ExtractStateType,
  GetStateOptions,
  MemorySaver,
  START,
  StateGraph,
} from '@langchain/langgraph';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConversationNode } from './nodes/conversation.node';
import { ConversationRouter } from '../routers/conversation.router';
import { MemoryService } from '../../memory/memory.service';
import { AgentState, AgentStateSchema, StateUpdate } from './state.dto';
import { BaseMessage } from 'langchain';
import { RunnableConfig } from '@langchain/core/runnables';

/* type GraphState = {
  messages: BaseMessage[];
  title: string;
  summary: string;
  sessionId: string;
  traceId: string;
}; */

type CompiledGraph = {
  invoke: (
    state: AgentState,
    config: RunnableConfig,
  ) => Promise<ExtractStateType<AgentState, StateUpdate>>;
  stream: (state: AgentState, config: RunnableConfig) => Promise<StateUpdate>;
  streamEvents: (
    state: AgentState,
    config: RunnableConfig,
  ) => Promise<StateUpdate>;
  getState: (
    config: RunnableConfig,
    options: GetStateOptions,
  ) => Promise<AgentState>;
};

@Injectable()
export class GraphFactory implements OnModuleInit {
  private compiledGraph: CompiledGraph;
  private checkpoint: MemorySaver;

  constructor(
    private conversationNode: ConversationNode,
    private conversationRouter: ConversationRouter,
    private memoryService: MemoryService,
  ) {
    this.checkpoint = new MemorySaver();
  }

  onModuleInit() {
    this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(AgentStateSchema)
      .addNode('conversation', async (state) => {
        return this.conversationNode.invoke(state);
      })
      .addEdge(START, 'conversation')
      .addConditionalEdges('conversation', (state) => {
        return this.conversationRouter.route(state);
      });

    this.compiledGraph = workflow.compile({
      checkpointer: this.checkpoint,
    }) as unknown as CompiledGraph;
  }

  async invoke(sessionId: string, messages: BaseMessage[]) {
    const savedState = this.memoryService.loadState(sessionId);

    const result = await this.compiledGraph.invoke(
      {
        messages,
        title: savedState?.title || '',
        summary: savedState?.summary || '',
        sessionId,
        traceId: '',
      },
      {
        configurable: {
          thread_id: sessionId,
        },
      },
    );

    this.memoryService.saveState(sessionId, result as AgentState);

    return {
      messages: result.messages,
      title: result.title,
      summary: result.summary,
    };
  }

  async *stream(sessionId: string, messages: BaseMessage[]) {
    const savedState = this.memoryService.loadState(sessionId);

    const stream = await this.compiledGraph.stream(
      {
        messages,
        title: savedState?.title || '',
        summary: savedState?.summary || '',
        sessionId,
        traceId: '',
      },
      {
        configurable: {
          thread_id: sessionId,
        },
      },
    );

    let finalState: AgentState | null = null;
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

    const stream = await this.compiledGraph.streamEvents(
      {
        messages: input.messages || [],
        title: savedState?.title || '',
        summary: savedState?.summary || '',
        sessionId,
        traceId: '',
      },
      {
        configurable: {
          thread_id: sessionId,
        },
        version: 'v2',
      },
    );

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
