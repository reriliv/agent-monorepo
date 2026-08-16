// src/memory/memory.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

type MessageRole = 'human' | 'ai' | 'system' | 'tool';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // 会话管理
  // ============================================

  async createSession(
    sessionId: string,
    options?: { title?: string; userId?: string },
  ) {
    return this.prisma.session.create({
      data: {
        id: sessionId,
        title: options?.title || '新对话',
        userId: options?.userId || null,
        status: 'active',
      },
    });
  }

  async getSession(sessionId: string) {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        _count: { select: { messages: true } },
      },
    });
  }

  async sessionExists(sessionId: string): Promise<boolean> {
    const count = await this.prisma.session.count({
      where: { id: sessionId },
    });
    return count > 0;
  }

  async listSessions(options?: {
    userId?: string;
    status?: 'active' | 'paused' | 'completed';
    limit?: number;
    offset?: number;
  }) {
    return this.prisma.session.findMany({
      where: {
        userId: options?.userId || undefined,
        status: options?.status || undefined,
      },
      orderBy: { updatedAt: 'desc' },
      skip: options?.offset || 0,
      take: options?.limit || 50,
      include: {
        _count: { select: { messages: true } },
      },
    });
  }

  async updateTitle(sessionId: string, title: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { title },
    });
  }

  async updateSummary(sessionId: string, summary: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { summary },
    });
  }

  async updateStatus(
    sessionId: string,
    status: 'active' | 'paused' | 'completed',
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { status },
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.prisma.session.delete({
      where: { id: sessionId },
    });
    this.logger.log(`Session deleted: ${sessionId}`);
  }

  // ============================================
  // 消息管理
  // ============================================

  async saveMessages(
    sessionId: string,
    messages: BaseMessage[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.message.deleteMany({
        where: { sessionId },
      });

      if (messages.length > 0) {
        await tx.message.createMany({
          data: messages.map((msg, index) => ({
            sessionId,
            role: this.getRole(msg),
            content: this.getMessageContent(msg),
            toolCalls: (msg as any).tool_calls || null,
            toolCallId: (msg as any).tool_call_id || null,
            order: index,
          })),
        });
      }

      await tx.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    });

    this.logger.debug(
      `Messages saved: ${sessionId} (${messages.length} messages)`,
    );
  }

  async appendMessage(sessionId: string, message: BaseMessage): Promise<void> {
    const lastMessage = await this.prisma.message.findFirst({
      where: { sessionId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    const nextOrder = (lastMessage?.order ?? -1) + 1;

    await this.prisma.$transaction(async (tx) => {
      await tx.message.create({
        data: {
          sessionId,
          role: this.getRole(message),
          content: this.getMessageContent(message),
          toolCalls: (message as any).tool_calls || null,
          toolCallId: (message as any).tool_call_id || null,
          order: nextOrder,
        },
      });

      await tx.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    });
  }

  async loadMessages(sessionId: string): Promise<BaseMessage[]> {
    const records = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' },
    });

    return records.map((record) => this.instantiateMessage(record));
  }

  async loadRecentMessages(
    sessionId: string,
    limit: number = 10,
  ): Promise<BaseMessage[]> {
    const records = await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { order: 'desc' },
      take: limit,
    });

    return records.reverse().map((record) => this.instantiateMessage(record));
  }

  async getMessageCount(sessionId: string): Promise<number> {
    return this.prisma.message.count({
      where: { sessionId },
    });
  }

  async clearMessages(sessionId: string): Promise<void> {
    await this.prisma.message.deleteMany({
      where: { sessionId },
    });
  }

  // ============================================
  // 辅助方法
  // ============================================

  private getRole(message: BaseMessage): MessageRole {
    if (message instanceof HumanMessage) return 'human';
    if (message instanceof AIMessage) return 'ai';
    if (message instanceof SystemMessage) return 'system';
    if (message instanceof ToolMessage) return 'tool';
    return 'human';
  }

  private getMessageContent(message: BaseMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    return JSON.stringify(message.content);
  }

  private instantiateMessage(record: any): BaseMessage {
    const params: any = {
      id: record.id,
      content: record.content,
    };

    if (record.toolCalls) {
      params.tool_calls = record.toolCalls;
    }
    if (record.toolCallId) {
      params.tool_call_id = record.toolCallId;
    }

    switch (record.role) {
      case 'human':
        return new HumanMessage(params);
      case 'ai':
        return new AIMessage(params);
      case 'system':
        return new SystemMessage(params);
      case 'tool':
        return new ToolMessage(params);
      default:
        return new HumanMessage(params);
    }
  }
}
