// apps/mcp-filesystem/src/config/configuration.ts
export interface FileSystemConfig {
  allowedRoot: string;
  maxFileSize: number;
  allowedExtensions: string[];
  forbiddenPaths: string[];
  encoding: string;
}

export default (): { filesystem: FileSystemConfig } => ({
  filesystem: {
    allowedRoot: process.env.ALLOWED_ROOT || '/data/agent-workspace',
    maxFileSize:
      (process.env.MAX_FILE_SIZE && parseInt(process.env.MAX_FILE_SIZE, 10)) ||
      10 * 1024 * 1024, // 10MB
    allowedExtensions: (
      process.env.ALLOWED_EXTENSIONS ||
      '.txt,.md,.json,.yaml,.yml,.csv,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.svg,.html,.css,.js,.ts,.py,.java,.go,.rs,.sh,.env,.log'
    ).split(','),
    forbiddenPaths: (
      process.env.FORBIDDEN_PATHS || '.git,.env,.ssh,node_modules'
    ).split(','),
    encoding: process.env.FILE_ENCODING || 'utf-8',
  },
});
