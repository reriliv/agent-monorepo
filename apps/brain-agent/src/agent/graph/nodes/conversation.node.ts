import { Injectable, Logger } from '@nestjs/common';
import { GraphState, GraphUpdate } from '../state.dto';
import { LLMService } from '../../../llm/llm.service';
import { ToolsService } from '../../tools/tools.service';
import { SystemMessage, AIMessage } from '@langchain/core/messages';
import { randomUUID } from 'crypto';

const SYSTEM_PROMPT = `你是一个智能助手，需要根据用户的输入提供有意义、有帮助的回复。
要求:
1. 用中文回复
2. 回答要详细但不冗长
3. 保持友好和专业的语气
4. 如果问题不明确，可以追问用户获取更多信息
5. 你可以使用工具来获取信息或执行操作
6. 如果工具调用失败或参数错误，请尝试用其他方式回答或追问用户
7. 不要重复调用同一个工具，除非你有充分的理由`;

const MAX_ITERATIONS = 10;

@Injectable()
export class ConversationNode {
  private readonly logger = new Logger(ConversationNode.name);

  constructor(
    private llmService: LLMService,
    private toolsService: ToolsService,
  ) { }

  async invoke(state: GraphState): Promise<GraphUpdate> {
    this.logger.debug(`Conversation node invoked, messages: ${state.messages.length}, iterations: ${state.iterations}`);

    if (state.iterations >= MAX_ITERATIONS) {
      const warningMessage = new AIMessage({
        id: randomUUID(),
        content: `⚠️ 对话已达到最大迭代次数(${MAX_ITERATIONS})，为了避免无限循环，我将直接为你总结当前信息。`,
      });
      return { messages: [warningMessage], iterations: 1 };
    }

    let messages = [...state.messages];
    const { summary } = state;

    if (summary) {
      const systemMessage = new SystemMessage({
        id: randomUUID(),
        content: `Summary of conversation earlier: ${summary}`,
      });
      messages = [systemMessage, new SystemMessage(SYSTEM_PROMPT), ...messages];
    } else {
      messages = [new SystemMessage(SYSTEM_PROMPT), ...messages];
    }

    const tools = this.toolsService.getAllTools();
    const boundLlm = this.llmService.bindTools(tools);
    const response = await boundLlm.invoke(messages);
    const aiMessage = response as AIMessage;

    this.logger.debug(`LLM response: ${aiMessage.content?.slice(0, 100)}...`);
    if (aiMessage.tool_calls?.length) {
      this.logger.debug(`Tool calls: ${aiMessage.tool_calls.map((tc: any) => tc.name).join(', ')}`);
    }

    return { messages: [aiMessage], iterations: 1 };
  }
}
