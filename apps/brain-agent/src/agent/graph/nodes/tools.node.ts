import { Injectable } from '@nestjs/common';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ToolsService } from '../../tools/tools.service';

@Injectable()
export class ToolsNode {
  private toolNode: ToolNode;

  constructor(private toolsService: ToolsService) {
    const tools = this.toolsService.getAllTools();
    this.toolNode = new ToolNode(tools);
  }

  getNode() {
    return this.toolNode;
  }
}