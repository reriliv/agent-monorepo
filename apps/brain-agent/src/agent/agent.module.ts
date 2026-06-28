import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentController } from './agent.controller';
import { GraphFactory } from './graph/graph.factory';
import { ConversationNode } from './graph/nodes/conversation.node';
import { ConversationRouter } from './routers/conversation.router';
import { MemoryService } from '../memory/memory.service';
import { LLMModule } from '../llm/llm.module';
import { ToolsService } from './tools/tools.service';
import { VectorStoreService } from './tools/vector-store.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    LLMModule,
  ],
  controllers: [AgentController],
  providers: [
    GraphFactory,
    ConversationNode,
    ConversationRouter,
    MemoryService,
    ToolsService,
    VectorStoreService,
  ],
})
export class AgentModule { }
