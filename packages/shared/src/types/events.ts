/**
 * SSE 清洁事件类型
 */
export type CleanEventType = 'token' | 'message' | 'tool_start' | 'tool_end' | 'error';

/**
 * SSE 清洁事件（后端发送、前端解析）
 */
export interface CleanEvent {
  type: CleanEventType;
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
}