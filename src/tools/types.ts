import type { z } from "zod";
import type { EcpClient } from "../ecp-client.js";

export interface ToolDef<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>, client: EcpClient) => Promise<unknown>;
}
