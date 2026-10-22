import type { z } from "zod";
import type { EcpClient } from "../ecp-client.js";

export interface ToolContext {
  /**
   * Ask the human at the MCP client to approve an action through MCP
   * elicitation. Resolves true only on an explicit accept; throws if the
   * client can't show the prompt, so a caller relying on it fails closed.
   */
  askUser: (message: string) => Promise<boolean>;
}

export interface ToolDef<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>, client: EcpClient, ctx: ToolContext) => Promise<unknown>;
}
