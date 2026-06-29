import { BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple, ChannelVersions, PendingWrite } from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import { promises as fs } from "fs";
import * as path from "path";

export class FileCheckpointSaver extends BaseCheckpointSaver {
  private readonly checkpointDir: string;
  private readonly writesDir: string;

  constructor(basePath: string = "data/checkpoints") {
    super();
    this.checkpointDir = path.join(basePath, "checkpoints");
    this.writesDir = path.join(basePath, "writes");
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.checkpointDir, { recursive: true });
    await fs.mkdir(this.writesDir, { recursive: true });
  }

  private getThreadDir(threadId: string): string {
    return path.join(this.checkpointDir, threadId);
  }

  private getCheckpointPath(threadId: string, checkpointId: string): string {
    return path.join(this.getThreadDir(threadId), `${checkpointId}.json`);
  }

  private getWritesPath(threadId: string, taskId: string): string {
    return path.join(this.writesDir, `${threadId}-${taskId}.json`);
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return undefined;
    }

    const threadDir = this.getThreadDir(threadId);
    try {
      const files = await fs.readdir(threadDir);
      if (files.length === 0) {
        return undefined;
      }

      const checkpointIds = files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort((a, b) => Number(a) - Number(b));

      const latestId = checkpointIds[checkpointIds.length - 1];
      const checkpointPath = this.getCheckpointPath(threadId, latestId);
      const data = await fs.readFile(checkpointPath, "utf-8");

      const [, deserialized] = await this.serde.loadsTyped("json", data);
      const checkpoint: Checkpoint = deserialized;

      return {
        config,
        checkpoint,
        metadata: checkpoint as unknown as CheckpointMetadata,
      };
    } catch {
      return undefined;
    }
  }

  async *list(
    config: RunnableConfig,
    options?: { limit?: number; before?: RunnableConfig }
  ): AsyncGenerator<CheckpointTuple> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    const threadDir = this.getThreadDir(threadId);
    try {
      const files = await fs.readdir(threadDir);
      const checkpointIds = files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort((a, b) => b.localeCompare(a));

      const limit = options?.limit || checkpointIds.length;
      for (const id of checkpointIds.slice(0, limit)) {
        const checkpointPath = this.getCheckpointPath(threadId, id);
        const data = await fs.readFile(checkpointPath, "utf-8");

        const [, deserialized] = await this.serde.loadsTyped("json", data);
        const checkpoint: Checkpoint = deserialized;

        yield {
          config,
          checkpoint,
          metadata: checkpoint as unknown as CheckpointMetadata,
        };
      }
    } catch {
      return;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    _metadata: CheckpointMetadata,
    _newVersions: ChannelVersions
  ): Promise<RunnableConfig> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return config;
    }

    await this.ensureDirs();

    const threadDir = this.getThreadDir(threadId);
    await fs.mkdir(threadDir, { recursive: true });

    const checkpointPath = this.getCheckpointPath(threadId, checkpoint.id);
    const [, serialized] = await this.serde.dumpsTyped(checkpoint);
    await fs.writeFile(checkpointPath, serialized);

    return config;
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string
  ): Promise<void> {
    const threadId = config.configurable?.thread_id;
    if (!threadId) {
      return;
    }

    await this.ensureDirs();

    const writesPath = this.getWritesPath(threadId, taskId);
    const [, serialized] = await this.serde.dumpsTyped(writes);
    await fs.writeFile(writesPath, serialized);
  }

  async deleteThread(threadId: string): Promise<void> {
    const threadDir = this.getThreadDir(threadId);
    try {
      await fs.rm(threadDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
