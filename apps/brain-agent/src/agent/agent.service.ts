import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, HumanMessage, SystemMessage } from 'langchain';

@Injectable()
export class AgentService {
  private llm: ChatOpenAI;
  constructor() {
    this.llm = new ChatOpenAI({
      apiKey: process.env.API_KEY,
      model: process.env.MODEL_NAME,
      configuration: {
        baseURL: process.env.API_URL,
      },
    });
  }

  async process(message: string, eventStream: Subject<any>) {
    console.log('user input', message);
    eventStream.next({
      type: 'start',
      data: { timestamp: new Date().toISOString() },
    });

    const messages = [
      new SystemMessage(`你是一个智能助手，需要根据用户的输入提供有意义、有帮助的回复。
    	要求:
    	1. 用中文回复
    	2. 回答要详细但不冗长
    	3. 保持友好和专业的预期
    	4. 如果问题不明确，可以追问用户获取更多信息`),
      new HumanMessage(message),
    ];

    let iteration = 0;
    const maxInterations = 5;

    while (iteration < maxInterations) {
      iteration++;

      const boundLlm = this.llm.bindTools([]);

      eventStream.next({
        type: 'thought',
        data: `正在思考... 第${iteration}轮`,
      });

      const res = await boundLlm.invoke(messages);
      console.log('res', res);
      const aiMessage = res as AIMessage;
      // if (aiMessage.tool_calls && aiMessage.tool_calls.length > 0) {
      //   //
      // } else {
      const finalAnswer = aiMessage.content as string;
      console.log('finalAnswer', finalAnswer);
      eventStream.next({
        type: 'reply',
        data: finalAnswer,
      });

      eventStream.next({
        type: 'complete',
        data: {
          totalIteration: iteration,
          finalAnswer,
          timestamp: new Date().toISOString(),
        },
      });

      eventStream.complete();
      return;
      // }
    }

    eventStream.next({
      type: 'reply',
      data: '结束',
    });

    eventStream.next({
      type: 'complete',
      data: { timeStamp: new Date().toISOString() },
    });

    eventStream.complete();
    return;
  }
}
