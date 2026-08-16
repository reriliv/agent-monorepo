// apps/mcp-filesystem/src/interceptors/mcp-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class MCPLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MCPLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { tool, params, context: ctx } = request.body;
    const requestId = ctx?.requestId || 'unknown';
    const startTime = Date.now();

    this.logger.debug(`[${requestId}] 调用工具: ${tool}`, {
      tool,
      params: this.sanitizeParams(params),
      requestId,
    });

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - startTime;
          this.logger.debug(
            `[${requestId}] 工具执行完成: ${tool} (${duration}ms)`,
            {
              tool,
              success: response.success,
              requestId,
            },
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `[${requestId}] 工具执行失败: ${tool} (${duration}ms)`,
            error.stack,
            {
              tool,
              error: error.message,
              requestId,
            },
          );
        },
      }),
    );
  }

  private sanitizeParams(params: any): any {
    // 脱敏处理，避免日志包含敏感内容
    const sanitized = { ...params };
    if (sanitized.content) {
      sanitized.content =
        sanitized.content.length > 100
          ? `${sanitized.content.slice(0, 100)}... (截断)`
          : sanitized.content;
    }
    return sanitized;
  }
}
