import { ChatOpenAI } from '@langchain/openai';

export const model = new ChatOpenAI({
  model: process.env.OPENAI_MODEL || 'deepseek-flash-v4',
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});
