// apps/mcp-filesystem/src/guards/path-allowed.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  // BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PathAllowedGuard implements CanActivate {
  private allowedRoot: string;
  private forbiddenPaths: string[];

  constructor(private configService: ConfigService) {
    this.allowedRoot = this.configService.get<string>(
      'filesystem.allowedRoot',
    )!;
    this.forbiddenPaths = this.configService.get<string[]>(
      'filesystem.forbiddenPaths',
    )!;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const params = request.body?.params || {};

    // 从参数中提取所有路径
    const paths = this.extractPaths(params);

    for (const filePath of paths) {
      if (!filePath) continue;

      // 1. 检查路径是否在允许的根目录内
      const resolvedPath = path.resolve(this.allowedRoot, filePath);
      if (!resolvedPath.startsWith(this.allowedRoot)) {
        throw new ForbiddenException(
          `路径 "${filePath}" 不在允许的根目录 "${this.allowedRoot}" 内`,
        );
      }

      // 2. 检查是否在禁止路径列表中
      const normalizedPath = resolvedPath.replace(this.allowedRoot, '');
      if (
        this.forbiddenPaths.some((forbidden) =>
          normalizedPath.includes(forbidden),
        )
      ) {
        throw new ForbiddenException(`路径 "${filePath}" 在禁止访问列表中`);
      }

      // 3. 检查文件扩展名是否允许（如果文件存在）
      if (fs.existsSync(resolvedPath)) {
        const stats = fs.statSync(resolvedPath);
        if (stats.isFile()) {
          const ext = path.extname(resolvedPath);
          const allowedExtensions = this.configService.get<string[]>(
            'filesystem.allowedExtensions',
          );
          if (allowedExtensions && !allowedExtensions.includes(ext)) {
            throw new ForbiddenException(`文件类型 "${ext}" 不在允许列表中`);
          }
        }
      }
    }

    return true;
  }

  private extractPaths(obj: any): string[] {
    const paths: string[] = [];
    const extract = (o: any) => {
      for (const key in o) {
        if (
          typeof o[key] === 'string' &&
          (key.includes('path') ||
            key.includes('Path') ||
            key === 'path' ||
            key === 'filePath' ||
            key === 'directory' ||
            key === 'source' ||
            key === 'destination' ||
            key === 'target')
        ) {
          paths.push(o[key]);
        } else if (typeof o[key] === 'object' && o[key] !== null) {
          extract(o[key]);
        }
      }
    };
    extract(obj);
    return paths;
  }
}
