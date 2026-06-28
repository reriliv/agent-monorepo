import { BaseMessage } from 'langchain';

export interface AgentState {
  messages: BaseMessage[];
  title?: string;
  summary?: string;
  sessionId?: string;
  traceId?: string;
}

export type StateUpdate = Partial<AgentState>;
