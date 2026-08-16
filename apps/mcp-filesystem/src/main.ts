// apps/mcp-filesystem/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { MCPFilesystemModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(MCPFilesystemModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 允许跨域（便于 Agent 调用）
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['POST', 'GET'],
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`MCP Filesystem 服务已启动: http://localhost:${port}/mcp`);
}
bootstrap();
