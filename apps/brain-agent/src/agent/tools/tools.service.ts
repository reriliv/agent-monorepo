import { Injectable } from '@nestjs/common';
import { readFileTool, writeFileTool, moveFileTool, listFilesTool } from './file.tool';
import { webScraperTool } from './web-scraper.tool';
import { VectorStoreService } from './vector-store.service';
import { MemoryService } from '../../memory/memory.service';
import { LLMService } from '../../llm/llm.service';
import { createSummarizeTool } from './summarize.tool';

@Injectable()
export class ToolsService {
  private tools: any[];

  constructor(
    private readonly vectorStoreService: VectorStoreService,
    private readonly memoryService: MemoryService,
    private readonly llmService: LLMService,
  ) {
    this.tools = [
      readFileTool,
      writeFileTool,
      moveFileTool,
      listFilesTool,
      this.vectorStoreService.getStoreKnowledgeTool(),
      this.vectorStoreService.getSearchKnowledgeTool(),
      this.vectorStoreService.getClearKnowledgeTool(),
      webScraperTool,
      createSummarizeTool(this.memoryService, this.llmService),
    ];
  }

  getAllTools(): any[] {
    return this.tools;
  }

  getToolByName(name: string): any | undefined {
    return this.tools.find((tool) => tool.name === name);
  }
}
