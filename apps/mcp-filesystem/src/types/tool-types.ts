// apps/mcp-filesystem/src/types/tool-types.ts
import z from 'zod/v4';

// ============ 工具参数 Schema 定义 ============
export const ReadFileSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  encoding: z.string().optional().default('utf-8'),
});

export const WriteFileSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  content: z.string(),
  encoding: z.string().optional().default('utf-8'),
});

export const AppendFileSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  content: z.string(),
  encoding: z.string().optional().default('utf-8'),
});

export const DeleteFileSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
});

export const ListDirectorySchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  showHidden: z.boolean().optional().default(false),
  recursive: z.boolean().optional().default(false),
});

export const CreateDirectorySchema = z.object({
  path: z.string().min(1, '路径不能为空'),
  recursive: z.boolean().optional().default(true),
});

export const SearchFilesSchema = z.object({
  directory: z.string().min(1, '目录不能为空'),
  pattern: z.string().optional(),
  extension: z.string().optional(),
  maxDepth: z.number().optional().default(10),
});

export const GetFileInfoSchema = z.object({
  path: z.string().min(1, '路径不能为空'),
});

export const CopyFileSchema = z.object({
  source: z.string().min(1, '源路径不能为空'),
  destination: z.string().min(1, '目标路径不能为空'),
});

export const MoveFileSchema = z.object({
  source: z.string().min(1, '源路径不能为空'),
  destination: z.string().min(1, '目标路径不能为空'),
});

export const ReadFileBinarySchema = z.object({
  path: z.string().min(1, '路径不能为空'),
});

// ============ 工具返回类型定义 ============
export interface ReadFileResult {
  content: string;
  path: string;
  size: number;
  encoding: string;
}

export interface WriteFileResult {
  path: string;
  size: number;
  created: boolean;
}

export interface AppendFileResult {
  path: string;
  size: number;
}

export interface DeleteFileResult {
  path: string;
  deleted: boolean;
}

export interface ListDirectoryResult {
  path: string;
  files: Array<{
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modified: Date;
  }>;
  total: number;
}

export interface CreateDirectoryResult {
  path: string;
  created: boolean;
}

export interface SearchFilesResult {
  directory: string;
  files: string[];
  total: number;
}

export interface GetFileInfoResult {
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
}

export interface CopyFileResult {
  source: string;
  destination: string;
  size: number;
}

export interface MoveFileResult {
  source: string;
  destination: string;
  size: number;
}

export interface ReadFileBinaryResult {
  path: string;
  content: Buffer;
  size: number;
  mimeType: string;
}

// ============ 工具类型映射 ============
export type ToolSchemaMap = {
  read_file: {
    params: z.infer<typeof ReadFileSchema>;
    result: ReadFileResult;
  };
  write_file: {
    params: z.infer<typeof WriteFileSchema>;
    result: WriteFileResult;
  };
  append_file: {
    params: z.infer<typeof AppendFileSchema>;
    result: AppendFileResult;
  };
  delete_file: {
    params: z.infer<typeof DeleteFileSchema>;
    result: DeleteFileResult;
  };
  list_directory: {
    params: z.infer<typeof ListDirectorySchema>;
    result: ListDirectoryResult;
  };
  create_directory: {
    params: z.infer<typeof CreateDirectorySchema>;
    result: CreateDirectoryResult;
  };
  search_files: {
    params: z.infer<typeof SearchFilesSchema>;
    result: SearchFilesResult;
  };
  get_file_info: {
    params: z.infer<typeof GetFileInfoSchema>;
    result: GetFileInfoResult;
  };
  copy_file: {
    params: z.infer<typeof CopyFileSchema>;
    result: CopyFileResult;
  };
  move_file: {
    params: z.infer<typeof MoveFileSchema>;
    result: MoveFileResult;
  };
  read_file_binary: {
    params: z.infer<typeof ReadFileBinarySchema>;
    result: ReadFileBinaryResult;
  };
};

export type ToolName = keyof ToolSchemaMap;
