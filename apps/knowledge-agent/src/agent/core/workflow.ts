import {
  StateGraph,
  START,
  END,
  MemorySaver,
  InMemoryStore,
} from '@langchain/langgraph';
import { shouldContinue } from '../routes';
import { messagesState } from './state';
import { llmCallNode, toolNode } from '../nodes';

const checkpointer = new MemorySaver();
const store = new InMemoryStore();

export const workflow = new StateGraph(messagesState)
  .addNode('llmCall', llmCallNode)
  .addNode('toolNode', toolNode)
  .addEdge(START, 'llmCall')
  .addConditionalEdges('llmCall', shouldContinue, ['toolNode', END])
  .addEdge('toolNode', 'llmCall')
  .compile({ checkpointer, store });

// Invoke
/* const result = await agent.invoke(
  {
    messages: [new HumanMessage('Add 3 and 4.')],
  },
  {
    configurable: {
      threadId: 'test-thread',
    },
  },
);

for (const message of result.messages) {
  console.log(`[${message.type}]: ${message.text}`);
} */
