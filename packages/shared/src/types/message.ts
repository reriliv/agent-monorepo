/**
 * 工具调用信息
 */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * 聊天消息
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: string[];
}

/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant';