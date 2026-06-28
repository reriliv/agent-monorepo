import { ChatOpenAI } from '@langchain/openai';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BaseMessage } from 'langchain';

@Injectable()
export class LLMService {
  private readonly logger = new Logger();
  private llm: ChatOpenAI;

  constructor(private configService: ConfigService) {
    this.llm = new ChatOpenAI({
      apiKey: this.configService.get('API_KEY'),
      model: this.configService.get('MODEL_NAME'),
      configuration: {
        baseURL: this.configService.get('BASE_URL'),
      },
    });

    this.logger.log('LLM initialized');
  }

  // 调用llm
  async invoke(messages: BaseMessage[]): Promise<BaseMessage> {
    const start = Date.now();
    try {
      this.logger.debug(`Invoking LLM with ${messages.length} messages`);
      const response = await this.llm.invoke(messages);
      this.logger.debug(`LLM responsed in ${Date.now() - start}ms`);
      return response;
    } catch (error) {
      this.logger.error(`LLM invocation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  // 流式调用
  async *stream(messages: BaseMessage[]) {
    const stream = await this.llm.stream(messages);
    for await (const chunk of stream) {
      yield chunk;
    }
  }

  // 绑定工具
  bindTools(tools: any[]) {
    return this.llm.bindTools(tools);
  }

  // 获取原始实例
  getModel() {
    return this.llm;
  }
}
