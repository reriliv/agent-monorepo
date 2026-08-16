// apps/mcp-filesystem/src/mcp-filesystem.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MCPFilesystemController } from './app.controller';
import { MCPFilesystemService } from './app.service';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
  ],
  controllers: [MCPFilesystemController],
  providers: [MCPFilesystemService],
})
export class MCPFilesystemModule {}
