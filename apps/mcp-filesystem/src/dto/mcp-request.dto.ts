// apps/mcp-filesystem/src/dto/mcp-request.dto.ts
import { ToolName, ToolSchemaMap } from '../types/tool-types';

// 直接用 interface，没有运行时开销
export interface MCPRequestDto<T extends ToolName = ToolName> {
  tool: T;
  params: ToolSchemaMap[T]['params'];
  context?: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
  };
}

export interface MCPResponseDto<T extends ToolName = ToolName> {
  success: boolean;
  data?: ToolSchemaMap[T]['result'];
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  metadata: {
    tool: T;
    executionTime: number;
    timestamp: string;
    requestId?: string;
  };
}
