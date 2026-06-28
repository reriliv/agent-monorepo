import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { HumanMessage } from 'langchain';
import { MemoryService } from '../../memory/memory.service';
import { LLMService } from '../../llm/llm.service';

export function createSummarizeTool(
  memoryService: MemoryService,
  llmService: LLMService,
) {
  return new DynamicStructuredTool({
    name: 'summarize',
    description: '总结当前对话，生成标题和摘要。当用户要求总结对话、生成标题时调用此工具。',
    schema: z.object({
      sessionId: z.string().describe('要总结的对话会话ID'),
    }),
    func: async ({ sessionId }) => {
      try {
        const state = await memoryService.loadState(sessionId);
        if (!state || !state.messages || state.messages.length === 0) {
          return '没有找到可总结的对话';
        }

        const messages = state.messages.map((msg) => {
          const role = msg._getType() === 'human' ? 'User' : 'Assistant';
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          return `${role}: ${content}`;
        }).join('\n');

        const response = await llmService.invoke([
          new HumanMessage(`请对以下对话内容进行总结，并生成一个标题。

对话内容：
${messages}

请严格按照以下JSON格式返回：
{
  "title": "简短标题（最多20个字符）",
  "summary": "对话摘要（最多200个字符）"
}`),
        ]);

        const responseContent = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        let result;
        try {
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            result = { title: '对话总结', summary: responseContent };
          }
        } catch {
          result = { title: '对话总结', summary: responseContent };
        }

        const title = (result.title || '无标题').substring(0, 20);
        const summary = (result.summary || responseContent).substring(0, 200);

        await memoryService.saveTitleAndSummary(sessionId, title, summary);

        return JSON.stringify({
          success: true,
          title,
          summary,
        }, null, 2);
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : '总结对话失败',
        });
      }
    },
  });
}
