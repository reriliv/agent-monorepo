import { Injectable, Logger } from '@nestjs/common';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Document } from '@langchain/core/documents';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class VectorStoreService {
  private readonly logger = new Logger(VectorStoreService.name);
  private storedDocuments: Document[] = [];
  private storeFile: string;
  private storeDir: string;

  constructor() {
    this.storeDir = path.join(process.cwd(), 'data', 'vector-store');
    this.storeFile = path.join(this.storeDir, 'store.json');

    if (!fs.existsSync(this.storeDir)) {
      fs.mkdirSync(this.storeDir, { recursive: true });
    }

    this.loadPersistedDocuments();
  }

  private loadPersistedDocuments(): void {
    if (fs.existsSync(this.storeFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.storeFile, 'utf-8'));
        if (data.documents && Array.isArray(data.documents)) {
          this.storedDocuments = data.documents.map((d: any) => new Document({
            pageContent: d.pageContent,
            metadata: d.metadata,
          }));
          this.logger.log(`Loaded ${this.storedDocuments.length} documents from persistent storage`);
        }
      } catch (error) {
        this.logger.warn(`Failed to load persistent storage: ${(error as Error).message}`);
      }
    }
  }

  private persistStore(): void {
    try {
      if (!fs.existsSync(this.storeDir)) {
        fs.mkdirSync(this.storeDir, { recursive: true });
      }

      const data = {
        documents: this.storedDocuments.map((d) => ({
          pageContent: d.pageContent,
          metadata: d.metadata,
        })),
        savedAt: new Date().toISOString(),
      };

      fs.writeFileSync(this.storeFile, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.debug(`Persisted ${this.storedDocuments.length} documents to ${this.storeFile}`);
    } catch (error) {
      this.logger.error(`Failed to persist storage: ${(error as Error).message}`);
    }
  }

  async storeKnowledge(title: string, content: string, source?: string): Promise<string> {
    try {
      const doc = new Document({
        pageContent: `${title}\n${content}`,
        metadata: {
          title,
          source: source || '',
          savedAt: new Date().toISOString(),
        },
      });

      this.storedDocuments.push(doc);
      this.persistStore();

      return `已成功存入知识库:\n标题: ${title}\n来源: ${source || '无'}\n当前知识库共有 ${this.storedDocuments.length} 条知识`;
    } catch (error) {
      return `存入失败: ${(error as Error).message}`;
    }
  }

  async searchKnowledge(query: string, limit: number = 3): Promise<string> {
    try {
      const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 1);

      const scoredDocs = this.storedDocuments.map(doc => {
        const content = doc.pageContent.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (content.includes(kw)) {
            score++;
          }
        }
        return { doc, score };
      }).filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.doc);

      if (scoredDocs.length === 0) {
        return '知识库中没有找到相关内容';
      }

      return scoredDocs.map((r, i) => {
        return `[结果 ${i + 1}]\n标题: ${r.metadata.title}\n内容: ${r.pageContent.slice(0, 400)}\n来源: ${r.metadata.source || '无'}\n`;
      }).join('\n---\n');
    } catch (error) {
      return `搜索失败: ${(error as Error).message}`;
    }
  }

  async clearKnowledge(): Promise<string> {
    try {
      this.storedDocuments = [];

      if (fs.existsSync(this.storeFile)) {
        fs.unlinkSync(this.storeFile);
      }

      return '知识库已清空';
    } catch (error) {
      return `清空失败: ${(error as Error).message}`;
    }
  }

  getStoreKnowledgeTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'store_knowledge',
      description: '将文本内容存入知识库，供后续检索使用。输入应包括标题和正文内容。',
      schema: z.object({
        title: z.string().describe('知识的标题'),
        content: z.string().describe('知识的正文内容'),
        source: z.string().optional().describe('来源URL或备注信息'),
      }),
      func: async ({ title, content, source }) => {
        return this.storeKnowledge(title, content, source);
      },
    });
  }

  getSearchKnowledgeTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'search_knowledge',
      description: '搜索知识库中与查询相关的内容，返回匹配的文本片段',
      schema: z.object({
        query: z.string().describe('搜索关键词或问题描述'),
        limit: z.number().default(3).describe('最多返回多少条结果'),
      }),
      func: async ({ query, limit }) => {
        return this.searchKnowledge(query, limit);
      },
    });
  }

  getClearKnowledgeTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
      name: 'clear_knowledge',
      description: '清空知识库中的所有内容',
      schema: z.object({}),
      func: async () => {
        return this.clearKnowledge();
      },
    });
  }
}
