import { Injectable, Logger } from '@nestjs/common';
import { AgentState } from '../agent/graph/state.dto';
import { HumanMessage, AIMessage } from 'langchain';
import * as fs from 'fs';
import * as path from 'path';

interface Conversation {
  sessionId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly storageDir = path.join(process.cwd(), 'data', 'conversations');

  private stateStore = new Map<string, AgentState>();
  private checkpointStore = new Map<string, any>();

  constructor() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async saveState(sessionId: string, state: AgentState) {
    this.logger.debug(`Saving state for session: ${sessionId}`);
    const existingState = this.stateStore.get(sessionId);
    this.stateStore.set(sessionId, {
      ...state,
      summary: existingState?.summary || state.summary,
      title: existingState?.title || state.title,
    });
    await this.persistConversation(sessionId, this.stateStore.get(sessionId)!);
  }

  async saveTitleAndSummary(sessionId: string, title: string, summary: string) {
    const state = this.stateStore.get(sessionId);
    if (state) {
      state.title = title;
      state.summary = summary;
      this.stateStore.set(sessionId, state);
      await this.persistConversation(sessionId, state);
    } else {
      const loadedState = await this.loadConversation(sessionId);
      if (loadedState) {
        loadedState.title = title;
        loadedState.summary = summary;
        this.stateStore.set(sessionId, loadedState);
        await this.persistConversation(sessionId, loadedState);
      }
    }
    this.logger.log(`Saved title and summary for session: ${sessionId}`);
  }

  async loadState(sessionId: string) {
    this.logger.debug(`Loading state for session: ${sessionId}`);

    const cachedState = this.stateStore.get(sessionId);
    if (cachedState) {
      return cachedState;
    }

    const persistedState = await this.loadConversation(sessionId);
    if (persistedState) {
      this.stateStore.set(sessionId, persistedState);
      return persistedState;
    }

    return null;
  }

  async saveCheckPoint(sessionId: string, checkpoint: any) {
    this.checkpointStore.set(sessionId, checkpoint);
  }

  async loadCheckPoint(sessionId: string) {
    return this.checkpointStore.get(sessionId) || null;
  }

  async cleanExpiredSessions() {
    this.logger.log('Running memory cleanup...');
  }

  async listConversations(): Promise<Array<{ sessionId: string; title: string; summary: string; updatedAt: string }>> {
    try {
      const files = fs.readdirSync(this.storageDir);
      const conversations: Array<{ sessionId: string; title: string; summary: string; updatedAt: string }> = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const filePath = path.join(this.storageDir, file);
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            conversations.push({
              sessionId,
              title: data.title || '',
              summary: data.summary || '',
              updatedAt: data.updatedAt || '',
            });
          } catch {
            this.logger.warn(`Failed to read conversation file: ${file}`);
          }
        }
      }

      return conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      this.logger.error(`Failed to list conversations: ${(error as Error).message}`);
      return [];
    }
  }

  async deleteConversation(sessionId: string): Promise<boolean> {
    try {
      const filePath = this.getFilePath(sessionId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        this.stateStore.delete(sessionId);
        this.checkpointStore.delete(sessionId);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to delete conversation: ${(error as Error).message}`);
      return false;
    }
  }

  private getFilePath(sessionId: string): string {
    return path.join(this.storageDir, `${sessionId}.json`);
  }

  private async persistConversation(sessionId: string, state: AgentState): Promise<void> {
    try {
      const filePath = this.getFilePath(sessionId);
      const existingData = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
        : {};

      const conversation: Conversation = {
        sessionId,
        messages: state.messages.map((msg) => ({
          role: msg._getType() === 'human' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          timestamp: new Date().toISOString(),
        })),
        title: state.title || existingData.title || '',
        summary: state.summary || existingData.summary || '',
        createdAt: existingData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2), 'utf-8');
      this.logger.debug(`Conversation persisted to: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to persist conversation: ${(error as Error).message}`);
    }
  }

  private async loadConversation(sessionId: string): Promise<AgentState | null> {
    try {
      const filePath = this.getFilePath(sessionId);
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const messages = (data.messages || []).map((msg: any) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else {
          return new AIMessage(msg.content);
        }
      });

      const state: AgentState = {
        messages,
        title: data.title || '',
        summary: data.summary || '',
        sessionId: data.sessionId,
      };

      return state;
    } catch (error) {
      this.logger.error(`Failed to load conversation: ${(error as Error).message}`);
      return null;
    }
  }
}
