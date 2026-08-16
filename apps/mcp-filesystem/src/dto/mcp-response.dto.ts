// apps/mcp-filesystem/src/dto/mcp-response.dto.ts
export interface MCPResponseDto<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
  metadata: {
    tool: string;
    executionTime: number;
    timestamp: string;
    requestId?: string;
  };
}
