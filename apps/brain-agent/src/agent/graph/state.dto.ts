import { StateSchema } from '@langchain/langgraph/web';
import { BaseMessage } from 'langchain';
import z from 'zod/v4';

// export interface AgentState {
//   messages: BaseMessage[];
//   title?: string;
//   summary?: string;
//   sessionId?: string;
//   traceId?: string;
// }

// export type StateUpdate = Partial<AgentState>;

export const AgentStateSchema = new StateSchema({
  messages: z.array(z.instanceof(BaseMessage)).default([]),
  title: z.string().optional().default(''),
  summary: z.string().optional().default(''),
  sessionId: z.string().optional().default(''),
  traceId: z.string().optional().default(''),
});

export type AgentState = typeof AgentStateSchema.State;
export type StateUpdate = typeof AgentStateSchema.Update;
