// apps/mcp-filesystem/src/mcp-filesystem.service.ts
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FileSystemTool } from './dto/mcp-request.dto';
import type { FileSystemToolSet } from './dto/mcp-request.dto';

@Injectable()
export class MCPFilesystemService {
  private readonly logger = new Logger(MCPFilesystemService.name);
  private readonly allowedRoot: string;
  private readonly maxFileSize: number;
  private readonly encoding: string;

  constructor(private configService: ConfigService) {
    this.allowedRoot = this.configService.get<string>(
      'filesystem.allowedRoot',
    )!;
    this.maxFileSize = this.configService.get<number>(
      'filesystem.maxFileSize',
    )!;
    this.encoding = this.configService.get<string>('filesystem.encoding')!;
    this.ensureRootDirectory();
  }

  // ============ 公共方法 ============

  async callTool<K in FileSystemToolSet>(tool: K, params: any): Promise<any> {
    this.logger.debug(`调用工具: ${tool}`, { tool, params });

    switch (tool) {
      case FileSystemTool.READ_FILE:
        return this.readFile(params);
      case FileSystemTool.WRITE_FILE:
        return this.writeFile(params);
      case FileSystemTool.APPEND_FILE:
        return this.appendFile(params);
      case FileSystemTool.DELETE_FILE:
        return this.deleteFile(params);
      case FileSystemTool.LIST_DIRECTORY:
        return this.listDirectory(params);
      case FileSystemTool.CREATE_DIRECTORY:
        return this.createDirectory(params);
      case FileSystemTool.SEARCH_FILES:
        return this.searchFiles(params);
      case FileSystemTool.GET_FILE_INFO:
        return this.getFileInfo(params);
      case FileSystemTool.COPY_FILE:
        return this.copyFile(params);
      case FileSystemTool.MOVE_FILE:
        return this.moveFile(params);
      case FileSystemTool.READ_FILE_BINARY:
        return this.readFileBinary(params);
      default:
        throw new BadRequestException(`未知工具: ${tool}`);
    }
  }

  // ============ 读文件 ============

  private async readFile(params: {
    path: string;
    encoding?: string;
  }): Promise<string> {
    const fullPath = this.resolvePath(params.path);
    this.checkFileExists(fullPath);
    this.checkFileSize(fullPath);

    const encoding = params.encoding || this.encoding;
    return fs.promises.readFile(fullPath, {
      encoding: encoding as BufferEncoding,
    });
  }

  // ============ 写文件 ============

  private async writeFile(params: {
    path: string;
    content: string;
    encoding?: string;
  }): Promise<{ path: string; size: number }> {
    const fullPath = this.resolvePath(params.path);
    this.ensureDirectoryExists(path.dirname(fullPath));

    const encoding = params.encoding || this.encoding;
    await fs.promises.writeFile(fullPath, params.content, {
      encoding: encoding as BufferEncoding,
      mode: 0o644,
    });

    const stats = await fs.promises.stat(fullPath);
    return {
      path: params.path,
      size: stats.size,
    };
  }

  // ============ 追加文件 ============

  private async appendFile(params: {
    path: string;
    content: string;
    encoding?: string;
  }): Promise<{ path: string; size: number }> {
    const fullPath = this.resolvePath(params.path);
    this.checkFileExists(fullPath);
    this.checkFileSize(fullPath);

    const encoding = params.encoding || this.encoding;
    await fs.promises.appendFile(fullPath, params.content, {
      encoding: encoding as BufferEncoding,
    });

    const stats = await fs.promises.stat(fullPath);
    return {
      path: params.path,
      size: stats.size,
    };
  }

  // ============ 删除文件 ============

  private async deleteFile(params: {
    path: string;
  }): Promise<{ path: string; deleted: boolean }> {
    const fullPath = this.resolvePath(params.path);
    this.checkFileExists(fullPath);

    await fs.promises.unlink(fullPath);
    return {
      path: params.path,
      deleted: true,
    };
  }

  // ============ 列出目录 ============

  private async listDirectory(params: {
    path: string;
    showHidden?: boolean;
    recursive?: boolean;
  }): Promise<{
    path: string;
    files: Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      size: number;
      modified: Date;
    }>;
  }> {
    const fullPath = this.resolvePath(params.path);
    this.ensureDirectoryExists(fullPath);

    const items: any[] = [];
    const readDir = async (dirPath: string, relativePath: string) => {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const name = entry.name;
        // 是否显示隐藏文件
        if (!params.showHidden && name.startsWith('.')) continue;

        const fullEntryPath = path.join(dirPath, name);
        const relativeEntryPath = path.join(relativePath, name);
        const stats = await fs.promises.stat(fullEntryPath);

        items.push({
          name: entry.name,
          path: relativeEntryPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          modified: stats.mtime,
        });

        // 递归子目录
        if (params.recursive && entry.isDirectory()) {
          await readDir(fullEntryPath, relativeEntryPath);
        }
      }
    };

    await readDir(fullPath, '');
    return {
      path: params.path,
      files: items,
    };
  }

  // ============ 创建目录 ============

  private async createDirectory(params: {
    path: string;
    recursive?: boolean;
  }): Promise<{ path: string; created: boolean }> {
    const fullPath = this.resolvePath(params.path);
    const recursive = params.recursive !== false;

    await fs.promises.mkdir(fullPath, { recursive });
    return {
      path: params.path,
      created: true,
    };
  }

  // ============ 搜索文件 ============

  private async searchFiles(params: {
    directory: string;
    pattern?: string;
    extension?: string;
    maxDepth?: number;
  }): Promise<string[]> {
    const fullPath = this.resolvePath(params.directory);
    this.ensureDirectoryExists(fullPath);

    const results: string[] = [];
    const maxDepth = params.maxDepth || 10;
    const regex = params.pattern ? new RegExp(params.pattern, 'i') : null;
    const extension = params.extension ? params.extension.toLowerCase() : null;

    const search = async (dirPath: string, depth: number) => {
      if (depth > maxDepth) return;

      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullEntryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          await search(fullEntryPath, depth + 1);
        } else {
          // 检查扩展名
          const ext = path.extname(entry.name).toLowerCase();
          if (extension && ext !== extension) continue;

          // 检查模式
          if (regex && !regex.test(entry.name)) continue;

          // 计算相对路径
          const relativePath = path.relative(this.allowedRoot, fullEntryPath);
          results.push(relativePath);
        }
      }
    };

    await search(fullPath, 0);
    return results;
  }

  // ============ 获取文件信息 ============

  private async getFileInfo(params: { path: string }): Promise<{
    path: string;
    exists: boolean;
    isDirectory: boolean;
    isFile: boolean;
    size?: number;
    created?: Date;
    modified?: Date;
    accessed?: Date;
    permissions?: string;
    extension?: string;
    hash?: string;
  }> {
    const fullPath = this.resolvePath(params.path);

    try {
      const stats = await fs.promises.stat(fullPath);

      // 计算文件哈希（仅对小文件）
      let hash: string | undefined;
      if (stats.isFile() && stats.size < 10 * 1024 * 1024) {
        // < 10MB
        const content = await fs.promises.readFile(fullPath);
        hash = crypto.createHash('md5').update(content).digest('hex');
      }

      return {
        path: params.path,
        exists: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        permissions: (stats.mode & 0o777).toString(8),
        extension: stats.isFile() ? path.extname(params.path) : undefined,
        hash,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {
          path: params.path,
          exists: false,
          isDirectory: false,
          isFile: false,
        };
      }
      throw error;
    }
  }

  // ============ 复制文件 ============

  private async copyFile(params: {
    source: string;
    destination: string;
  }): Promise<{ source: string; destination: string; size: number }> {
    const sourcePath = this.resolvePath(params.source);
    const destPath = this.resolvePath(params.destination);

    this.checkFileExists(sourcePath);
    this.ensureDirectoryExists(path.dirname(destPath));

    await fs.promises.copyFile(sourcePath, destPath);

    const stats = await fs.promises.stat(destPath);
    return {
      source: params.source,
      destination: params.destination,
      size: stats.size,
    };
  }

  // ============ 移动文件 ============

  private async moveFile(params: {
    source: string;
    destination: string;
  }): Promise<{ source: string; destination: string; size: number }> {
    const sourcePath = this.resolvePath(params.source);
    const destPath = this.resolvePath(params.destination);

    this.checkFileExists(sourcePath);
    this.ensureDirectoryExists(path.dirname(destPath));

    await fs.promises.rename(sourcePath, destPath);

    const stats = await fs.promises.stat(destPath);
    return {
      source: params.source,
      destination: params.destination,
      size: stats.size,
    };
  }

  // ============ 读取二进制文件 ============

  private async readFileBinary(params: { path: string }): Promise<{
    path: string;
    content: Buffer;
    size: number;
    mimeType: string;
  }> {
    const fullPath = this.resolvePath(params.path);
    this.checkFileExists(fullPath);
    this.checkFileSize(fullPath);

    const content = await fs.promises.readFile(fullPath);

    // 简单 MIME 类型检测
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
    };

    return {
      path: params.path,
      content,
      size: content.length,
      mimeType: mimeTypes[ext] || 'application/octet-stream',
    };
  }

  // ============ 私有辅助方法 ============

  private resolvePath(filePath: string): string {
    // 如果是绝对路径，确保它在 allowedRoot 内
    if (path.isAbsolute(filePath)) {
      if (!filePath.startsWith(this.allowedRoot)) {
        throw new BadRequestException(
          `路径 "${filePath}" 必须在 "${this.allowedRoot}" 内`,
        );
      }
      return filePath;
    }
    // 相对路径，拼接 allowedRoot
    return path.resolve(this.allowedRoot, filePath);
  }

  private checkFileExists(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`文件不存在: ${filePath}`);
    }
  }

  private checkFileSize(filePath: string): void {
    const stats = fs.statSync(filePath);
    if (stats.size > this.maxFileSize) {
      throw new BadRequestException(
        `文件大小 ${stats.size} 超过限制 ${this.maxFileSize}`,
      );
    }
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
    }
  }

  private ensureRootDirectory(): void {
    this.ensureDirectoryExists(this.allowedRoot);
    this.logger.log(`文件系统根目录: ${this.allowedRoot}`);
  }
}
