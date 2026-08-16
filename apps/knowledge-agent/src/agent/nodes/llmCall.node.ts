import { GraphNode } from '@langchain/langgraph';
import type { MessagesState } from '../core/state';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { modelWithTools } from '../tools';

const SYSTEM_PROMPT = `你是一个智能助手，需要根据用户的输入提供有意义、有帮助的回复。
要求:
1. 用中文回复
2. 回答要详细但不冗长
3. 保持友好和专业的语气
4. 如果问题不明确，可以追问用户获取更多信息
5. 你可以使用工具来获取信息或执行操作`;

export const llmCallNode: GraphNode<MessagesState> = async (state, config) => {
  console.log('state in llm call node');
  const messages = [...state.messages];
  const response = await modelWithTools.invoke(
    [new SystemMessage(SYSTEM_PROMPT), ...messages],
    config,
  );
  const aiMessage = response as AIMessage;
  console.log('response');
  console.log(response);
  messages.push(aiMessage);
  return {
    messages,
    llmCalls: state.llmCalls + 1,
  };
};
