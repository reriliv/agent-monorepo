import { GraphNode } from '@langchain/langgraph';
import type { MessagesState } from '../core/state';
import { AIMessage } from '@langchain/core/messages';
import { ToolNames, toolsByName } from '../tools';

export const toolNode: GraphNode<MessagesState> = async (state) => {
  const lastMessage = state.messages.at(-1);

  if (lastMessage == null || !AIMessage.isInstance(lastMessage)) {
    return { messages: [] };
  }

  const result = [...state.messages];
  for (const toolCall of lastMessage.tool_calls ?? []) {
    const tool = toolsByName[toolCall.name as ToolNames];
    if (tool) {
      const observation = await tool.invoke(toolCall);
      result.push(observation);
    }
  }

  return { messages: result, llmCalls: state.llmCalls };
};
