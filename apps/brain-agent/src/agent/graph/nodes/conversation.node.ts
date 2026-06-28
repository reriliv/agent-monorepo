import { Injectable, Logger } from '@nestjs/common';
import { AgentState, StateUpdate } from '../state.dto';
import { LLMService } from '../../../llm/llm.service';
import { ToolsService } from '../../tools/tools.service';
import { SystemMessage, AIMessage, BaseMessage } from 'langchain';
import { randomUUID } from 'crypto';
import { ToolMessage } from '@langchain/core/messages';

const SYSTEM_PROMPT = `你是一个智能助手，需要根据用户的输入提供有意义、有帮助的回复。
要求:
1. 用中文回复
2. 回答要详细但不冗长
3. 保持友好和专业的语气
4. 如果问题不明确，可以追问用户获取更多信息
5. 你可以使用工具来获取信息或执行操作`;

@Injectable()
export class ConversationNode {
  private readonly logger = new Logger(ConversationNode.name);
  private readonly maxIterations = 10;

  constructor(
    private llmService: LLMService,
    private toolsService: ToolsService,
  ) { }

  async invoke(state: AgentState): Promise<StateUpdate> {
    this.logger.debug(`Conversation node invoked, messages: ${state.messages.length}`);

    let messages: BaseMessage[] = [...state.messages];
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

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      this.logger.debug(`Processing iteration ${iteration + 1}`);

      const response = await boundLlm.invoke(messages);
      const aiMessage = response as AIMessage;

      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls || [];

      if (toolCalls.length === 0) {
        this.logger.debug('No tool calls, returning response');
        return { messages: [aiMessage] };
      }

      for (const toolCall of toolCalls) {
        this.logger.debug(`Executing tool: ${toolCall.name}`);

        try {
          const tool = this.toolsService.getToolByName(toolCall.name);
          if (!tool) {
            throw new Error(`Tool ${toolCall.name} not found`);
          }

          const args = typeof toolCall.args === 'string' ? JSON.parse(toolCall.args) : toolCall.args;
          const toolResult = await tool.invoke(args);

          const toolMessage = new ToolMessage({
            id: randomUUID(),
            tool_call_id: toolCall.id ?? randomUUID(),
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult),
          });

          messages.push(toolMessage);
        } catch (error) {
          this.logger.error(`Tool execution failed: ${(error as Error).message}`);

          const errorMessage = new ToolMessage({
            id: randomUUID(),
            tool_call_id: toolCall.id ?? randomUUID(),
            content: `Error executing tool ${toolCall.name}: ${(error as Error).message}`,
          });

          messages.push(errorMessage);
        }
      }
    }

    const finalMessage = messages[messages.length - 1] as AIMessage;
    return { messages: [finalMessage] };
  }
}
