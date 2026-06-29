# Brain Agent - 智能对话系统

基于 LangGraph + LangChain 的 AI Agent 对话系统，支持工具调用、对话持久化和流式输出。

## 项目结构

```
agent-monorepo2/
├── apps/
│   ├── brain-agent/          # NestJS 后端服务
│   │   └── src/
│   │       ├── agent/       # Agent 核心模块
│   │       │   ├── graph/   # LangGraph 状态图
│   │       │   │   ├── nodes/       # 图节点（conversation, tools）
│   │       │   │   ├── state.dto.ts # 状态定义（Annotation.Root）
│   │       │   │   └── graph.factory.ts
│   │       │   ├── tools/   # 工具集
│   │       │   ├── routers/ # 路由逻辑
│   │       │   └── agent.controller.ts
│   │       ├── llm/         # LLM 服务封装
│   │       └── memory/      # 对话持久化
│   │
│   └── web/                 # React 前端
│       └── src/
│           ├── components/  # 组件
│           │   ├── Chat/                # 聊天组件
│           │   └── ConversationSidebar/ # 侧边栏
│           ├── services/   # API 请求服务
│           └── App.tsx     # 主应用
│
└── packages/
    └── shared/              # 共享类型定义
        └── src/types/       # Message、Conversation、CleanEvent
```

## 技术栈

### 后端
- **NestJS** - Node.js 框架
- **LangGraph v1.4.x** - Agent 状态机（标准 ReAct 循环）
- **LangChain** - 工具系统与消息处理
- **DeepSeek API** - LLM 模型（deepseek-v4-flash）

### 前端
- **React 19** + **TypeScript**
- **Vite** - 构建工具
- **Tailwind CSS** - 样式
- **react-markdown** - Markdown 渲染

### 基础设施
- **pnpm** - 包管理器
- **turbo** - Monorepo 构建工具

## 功能特性

### 1. AI 对话
- 支持流式 SSE 输出
- Markdown 内容渲染
- 工具调用结果展示

### 2. 工具系统
| 工具名称 | 功能 |
|---------|------|
| read_file | 读取文件内容 |
| write_file | 写入文件内容 |
| move_file | 移动文件 |
| list_files | 列出目录文件 |
| store_knowledge | 存储知识到向量库 |
| search_knowledge | 搜索知识库 |
| clear_knowledge | 清除知识库 |
| web_scraper | 网页内容抓取 |
| summarize | 总结当前对话 |

### 3. 对话管理
- 对话持久化（JSON 文件存储）
- 历史对话列表
- 切换/删除对话
- 对话总结与标题生成

### 4. Agent 架构
- 标准 ReAct 循环模式
- 最大迭代次数限制（防止无限循环）
- 工具调用验证与幻觉防护

## 快速开始

### 环境要求
- Node.js >= 18
- pnpm >= 8

### 安装依赖

```bash
pnpm install
```

### 配置

编辑 `apps/brain-agent/.env`：

```env
API_KEY=your-deepseek-api-key
BASE_URL=https://api.deepseek.com
MODEL_NAME=deepseek-v4-flash
PORT=3001
```

### 启动开发服务器

```bash
# 一键启动前后端
pnpm dev

# 单独启动后端 (端口 3001)
pnpm dev:agent

# 单独启动前端 (端口 5173)
pnpm dev:web
```

### 构建生产版本

```bash
# 安装依赖
pnpm install

# 构建所有包
cd packages/shared && pnpm build
cd apps/brain-agent && pnpm build
cd apps/web && pnpm build
```

## API 接口

### 对话接口

| 方法 | 路径 | 说明 |
|-----|------|-----|
| POST | `/agent/chat` | 同步对话（非流式） |
| GET | `/agent/chat/sse` | SSE 流式对话 |
| POST | `/agent/chat/sse` | SSE 流式对话 |

**SSE 事件类型**：
```typescript
type CleanEvent = 
  | { type: 'token', content: string }      // 流式 token
  | { type: 'message', content: string }    // 完整消息
  | { type: 'tool_end', toolResult: string } // 工具结果
  | { type: 'error', content: string }      // 错误信息
```

### 对话管理

| 方法 | 路径 | 说明 |
|-----|------|-----|
| GET | `/agent/conversations` | 获取对话列表 |
| GET | `/agent/conversation/:sessionId` | 获取对话详情 |
| DELETE | `/agent/conversation/:sessionId` | 删除对话 |

## 数据存储

对话数据存储在 `data/conversations/` 目录，格式为 JSON 文件：

```json
{
  "sessionId": "uuid",
  "messages": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ],
  "title": "对话标题",
  "summary": "对话摘要",
  "createdAt": "...",
  "updatedAt": "..."
}
```

向量知识库存储在 `data/vector-store/store.json`。

## Agent 工作原理

### ReAct 循环流程

```
START → conversation(调用LLM) → router → [tools | END]
           ↑                               |
           └────────── tools(执行工具) ←────┘
```

**循环机制**：

1. **conversation 节点**：调用 LLM，根据对话历史决定是否调用工具
2. **router 路由**：检查 LLM 返回是否包含 `tool_calls`
   - 有工具调用 → 路由到 `tools` 节点
   - 无工具调用 → 结束（END）
3. **tools 节点**：执行工具，将结果添加到消息历史
4. **循环回到 conversation**：LLM 根据工具结果继续决策

### LangGraph 边的作用

**addEdge** - 固定边，无条件跳转：
```typescript
.addEdge(START, 'conversation')   // 从起点直接到 conversation
.addEdge('tools', 'conversation') // 工具执行完直接回到 conversation
```

**addConditionalEdges** - 条件边，根据状态动态决定下一个节点：
```typescript
.addConditionalEdges('conversation', (state) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (lastMessage.tool_calls?.length > 0) {
    return 'tools';  // 有工具调用 → 去执行工具
  }
  return END;        // 无工具调用 → 结束
})
```

### 幻觉防护

1. **最大迭代次数**：限制循环最多执行 10 次
2. **提示词约束**：引导 LLM 不要重复调用同一工具
3. **反馈回路**：工具执行结果（成功/失败）会作为消息添加到历史，LLM 可看到并调整策略

## 开发指南

### 添加新工具

1. 在 `apps/brain-agent/src/agent/tools/` 创建工具文件
2. 在 `tools.service.ts` 中注册工具
3. 工具描述使用中文，便于 LLM 理解

示例：
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export const myTool = new DynamicStructuredTool({
  name: 'my_tool',
  description: '工具描述',
  schema: z.object({
    param: z.string().describe('参数描述'),
  }),
  func: async ({ param }) => {
    // 工具逻辑
    return '结果';
  },
});
```

### 共享类型

在 `packages/shared/src/types/` 定义跨应用共享的类型：

```typescript
// Message 类型
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: string[];
}
```

### 状态定义

使用 LangGraph 标准的 `Annotation.Root` 定义状态：

```typescript
import { Annotation } from '@langchain/langgraph';

const GraphStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (left, right) => left.concat(right),
    default: () => [],
  }),
  // ... 其他字段
});
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|-------|------|-------|
| API_KEY | DeepSeek API 密钥 | - |
| BASE_URL | API 基础地址 | https://api.deepseek.com |
| MODEL_NAME | 模型名称 | deepseek-v4-flash |
| PORT | 后端服务端口 | 3001 |

## 注意事项

1. **API Key 安全**：不要将 `.env` 文件提交到版本控制
2. **文件工具**：使用 agent 的文件操作工具时，注意路径是相对于服务运行目录
3. **向量存储**：当前使用关键词匹配作为降级方案，需要 OpenAI API Key 才能启用语义搜索
4. **循环限制**：最大迭代次数为 10，复杂任务可能需要调整
