import { START, StateGraph } from '@langchain/langgraph';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConversationNode } from './nodes/conversation.node';
import { ToolsNode } from './nodes/tools.node';
import { ConversationRouter } from '../routers/conversation.router';
import { MemoryService } from '../../memory/memory.service';
import { LogService } from '../../memory/log.service';
import { FileCheckpointSaver } from '../../memory/file-checkpoint-saver';
import { GraphStateAnnotation, GraphState } from './state.dto';

@Injectable()
export class GraphFactory implements OnModuleInit {
  private compiledGraph: any;
  private checkpoint: FileCheckpointSaver;

  constructor(
    private conversationNode: ConversationNode,
    private toolsNode: ToolsNode,
    private conversationRouter: ConversationRouter,
    private memoryService: MemoryService,
    private logService: LogService,
  ) {
    this.checkpoint = new FileCheckpointSaver();
  }

  async onModuleInit() {
    await this.buildGraph();
  }

  private async buildGraph() {
    const workflow = new StateGraph(GraphStateAnnotation)
      .addNode('conversation', async (state: GraphState) => {
        this.logService.debug(`Entering conversation node`, undefined, state.sessionId, 'conversation');
        const result = await this.conversationNode.invoke(state);
        const messages = Array.isArray(result.messages) ? result.messages : [];
        this.logService.debug(`Leaving conversation node`, { messagesCount: messages.length }, state.sessionId, 'conversation');
        return result;
      })
      .addNode('tools', this.toolsNode.getNode())
      .addEdge(START, 'conversation')
      .addConditionalEdges('conversation', (state: GraphState) => {
        const route = this.conversationRouter.route(state);
        this.logService.debug(`Routing from conversation`, { route }, state.sessionId);
        return route;
      })
      .addEdge('tools', 'conversation');

    this.compiledGraph = workflow.compile({
      checkpointer: this.checkpoint,
    });
  }

  async invoke(sessionId: string, input: any) {
    this.logService.logGraphStart(sessionId);

    const savedState = await this.memoryService.loadState(sessionId);

    this.logService.debug(`Loaded state`, { hasState: !!savedState }, sessionId);

    await this.compiledGraph.invoke({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
      iterations: 0,
    }, {
      configurable: {
        thread_id: sessionId,
      },
    });

    const finalState = await this.compiledGraph.getState({
      configurable: {
        thread_id: sessionId,
      },
    });

    const result = finalState?.checkpoint?.values || finalState?.values || { messages: [], title: '', summary: '' };

    this.logService.debug(`Graph invoke completed`, { messagesCount: result.messages?.length }, sessionId);

    await this.memoryService.saveState(sessionId, result);

    this.logService.logGraphEnd(sessionId);

    return {
      messages: result.messages,
      title: result.title,
      summary: result.summary,
    };
  }

  async *stream(sessionId: string, input: any) {
    this.logService.logGraphStart(sessionId);

    const savedState = await this.memoryService.loadState(sessionId);

    this.logService.debug(`Loaded state for stream`, { hasState: !!savedState }, sessionId);

    const stream = await this.compiledGraph.stream({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
      iterations: 0,
    }, {
      configurable: {
        thread_id: sessionId,
      },
    });

    for await (const chunk of stream) {
      yield chunk;
    }

    const finalState = await this.compiledGraph.getState({
      configurable: {
        thread_id: sessionId,
      },
    });

    const stateValues = finalState?.checkpoint?.values || finalState?.values;
    if (stateValues) {
      this.logService.debug(`Stream completed, saving state`, { messagesCount: stateValues.messages?.length }, sessionId);
      await this.memoryService.saveState(sessionId, stateValues);
    }

    this.logService.logGraphEnd(sessionId);
  }

  async *streamEvents(sessionId: string, input: any) {
    this.logService.logGraphStart(sessionId);

    const savedState = await this.memoryService.loadState(sessionId);

    this.logService.debug(`Loaded state for streamEvents`, { hasState: !!savedState }, sessionId);

    const stream = await this.compiledGraph.streamEvents({
      messages: input.messages || [],
      title: savedState?.title || '',
      summary: savedState?.summary || '',
      sessionId,
      traceId: '',
      iterations: 0,
    }, {
      configurable: {
        thread_id: sessionId,
      },
      version: 'v2',
    });

    for await (const event of stream) {
      this.logService.debug(`Stream event`, { eventType: event.event }, sessionId);
      yield event;
    }

    const finalState = await this.compiledGraph.getState({
      configurable: {
        thread_id: sessionId,
      },
    });

    this.logService.debug('Raw getState result', {
      keys: Object.keys(finalState || {}),
      valuesKeys: Object.keys(finalState?.values || {}),
      hasCheckpoint: !!finalState?.checkpoint,
      hasMessages: !!finalState?.values?.messages,
      messagesType: typeof finalState?.values?.messages,
      messagesLength: Array.isArray(finalState?.values?.messages) ? finalState.values.messages.length : 'N/A'
    }, sessionId);

    const stateValues = finalState?.checkpoint?.values || finalState?.values;
    if (stateValues) {
      this.logService.debug(`StreamEvents completed, saving state`, { messagesCount: stateValues.messages?.length }, sessionId);
      await this.memoryService.saveState(sessionId, stateValues);
    }

    this.logService.logGraphEnd(sessionId);
  }
}
