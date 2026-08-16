import { model } from '../core/model';
import { add, divide, multiply } from './math.tool';

export const toolsByName = {
  [add.name]: add,
  [multiply.name]: multiply,
  [divide.name]: divide,
};
export const tools = Object.values(toolsByName);
export type ToolNames = keyof typeof toolsByName;
export const modelWithTools = model.bindTools(tools);
