// apps/mcp-filesystem/src/mcp-filesystem.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MCPFilesystemService } from './app.service';
import type { MCPRequestDto } from './dto/mcp-request.dto';
import { MCPResponseDto } from './dto/mcp-response.dto';
import { PathAllowedGuard } from './guards/path-allowed.guard';
import { MCPLoggingInterceptor } from './interceptors/mcp-logging.interceptor';

@Controller('mcp')
@UseInterceptors(MCPLoggingInterceptor)
export class MCPFilesystemController {
  constructor(private readonly filesystemService: MCPFilesystemService) {}

  @Post('call')
  @HttpCode(HttpStatus.OK)
  @UseGuards(PathAllowedGuard)
  async call(@Body() request: MCPRequestDto): Promise<MCPResponseDto> {
    const startTime = Date.now();
    const requestId = request.context?.requestId || this.generateRequestId();

    try {
      const data = await this.filesystemService.callTool(
        request.tool,
        request.params,
      );

      return {
        success: true,
        data,
        metadata: {
          tool: request.tool,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: error.name || 'UNKNOWN_ERROR',
          message: error.message,
          stack:
            process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        metadata: {
          tool: request.tool,
          executionTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          requestId,
        },
      };
    }
  }

  @Post('health')
  @HttpCode(HttpStatus.OK)
  async health(): Promise<{ status: string; root: string }> {
    return {
      status: 'ok',
      root: process.env.ALLOWED_ROOT || '/data/agent-workspace',
    };
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
}
