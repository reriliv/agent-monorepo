import { tool } from 'langchain';
import fs from "fs/promises";
import path from 'path';
import z from 'zod';

export const readFileTool = tool(
  async (filePath) => {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return content;
    } catch (error) {
      return `Error reading file: ${(error as Error).message}`;
    }
  }, {
  name: "read-file",
  description: "Reads the content of a file at the specified path.",
  schema: z.string().describe("The path to the file to read.")
});

export const writeFileTool = tool(
  async ({ filePath, content }) => {
    try {
      const dir = path.dirname(filePath);
      if (!await fs.access(dir).then(() => true).catch(() => false)) {
        await fs.mkdir(dir, { recursive: true });
      }
      await fs.writeFile(filePath, content, "utf-8");
      return `File written successfully to ${filePath}`;
    } catch (error) {
      return `Error writing file: ${(error as Error).message}`;
    }
  }, {
  name: "write-file",
  description: "Writes content to a file at the specified path.",
  schema: z.object({
    filePath: z.string().describe("The path to the file to write."),
    content: z.string().describe("The content to write to the file.")
  }),
});

export const moveFileTool = tool(async ({ filePath, newFilePath }) => {
  try {
    const dir = path.dirname(newFilePath);
    if (!await fs.access(dir).then(() => true).catch(() => false)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.rename(filePath, newFilePath);
    return `File moved successfully from ${filePath} to ${newFilePath}`;
  } catch (e) {
    return `Error moving file: ${(e as Error).message}`;
  }
}, {
  "name": "move-file",
  description: "Moves a file from the source path to the destination path.",
  schema: z.object({
    filePath: z.string().describe('The path of the file to move.'),
    newFilePath: z.string().describe('The destination path where the file will be moved to.')
  })
});

export const listFilesTool = tool(async ({ dirPath }) => {
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    const result = files.map(file => {
      return file.isDirectory()
        ? `[DIR] ${file.name}`
        : `[FILE] ${file.name}`;
    }).join('\n');
    return result || 'Directory is empty';
  } catch (e) {
    return `Error listing files: ${(e as Error).message}`;
  }
}, {
  "name": "list-files",
  description: "Lists all files and directories in the specified directory.",
  schema: z.object({
    dirPath: z.string().describe('The path of the directory to list.')
  })
});
