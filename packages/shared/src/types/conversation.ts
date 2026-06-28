/**
 * 对话会话信息
 */
export interface Conversation {
  sessionId: string;
  title: string;
  summary: string;
  updatedAt: string;
  createdAt?: string;
}