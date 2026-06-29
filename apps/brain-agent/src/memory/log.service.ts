import { Injectable } from "@nestjs/common";
import { promises as fs } from "fs";
import * as path from "path";

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  sessionId?: string;
  node?: string;
  message: string;
  data?: unknown;
}

@Injectable()
export class LogService {
  private readonly logDir: string;
  private readonly errorLogDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), "data", "logs");
    this.errorLogDir = path.join(this.logDir, "errors");
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
    await fs.mkdir(this.errorLogDir, { recursive: true });
  }

  private getLogFileName(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`;
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    await this.ensureDirs();

    const logLine = JSON.stringify(entry) + "\n";
    const logPath = path.join(this.logDir, this.getLogFileName());

    await fs.appendFile(logPath, logLine);

    if (entry.level === "error") {
      const errorLogPath = path.join(this.errorLogDir, this.getLogFileName());
      await fs.appendFile(errorLogPath, logLine);
    }
  }

  debug(message: string, data?: unknown, sessionId?: string, node?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: "debug",
      sessionId,
      node,
      message,
      data,
    });
  }

  info(message: string, data?: unknown, sessionId?: string, node?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      sessionId,
      node,
      message,
      data,
    });
  }

  warn(message: string, data?: unknown, sessionId?: string, node?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      sessionId,
      node,
      message,
      data,
    });
  }

  error(message: string, data?: unknown, sessionId?: string, node?: string): void {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: "error",
      sessionId,
      node,
      message,
      data,
    });
  }

  async logNodeExecution(node: string, sessionId: string, input?: unknown, output?: unknown): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      sessionId,
      node,
      message: `Node execution completed`,
      data: { input, output },
    });
  }

  async logToolCall(toolName: string, sessionId: string, args?: unknown, result?: unknown): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      sessionId,
      node: "tools",
      message: `Tool executed: ${toolName}`,
      data: { toolName, args, result },
    });
  }

  async logGraphStart(sessionId: string): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      sessionId,
      message: "Graph execution started",
    });
  }

  async logGraphEnd(sessionId: string): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      level: "info",
      sessionId,
      message: "Graph execution completed",
    });
  }

  async logError(error: Error, sessionId?: string, node?: string): Promise<void> {
    await this.writeLog({
      timestamp: new Date().toISOString(),
      level: "error",
      sessionId,
      node,
      message: error.message,
      data: { stack: error.stack },
    });
  }
}
