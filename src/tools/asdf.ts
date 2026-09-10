import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/asdf.go - language runtime version management (node,
// python, etc. via the asdf version manager). install/uninstall use the
// same fire-and-forget ExecRto primitive as PHP install/uninstall (see
// tools/system.ts) - no output, verify via list-installed afterward.
// global runs synchronously (utils.Exec) but still doesn't return output,
// just a clean error if it fails.

export const asdfTools: ToolDef[] = [
  {
    name: "ecp_asdf_plugin_list_all",
    description: "List all asdf plugins available to install (e.g. nodejs, python, ruby).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "asdf/plugin-list-all"),
  },
  {
    name: "ecp_asdf_plugin_list",
    description: "List asdf plugins currently installed on this account's container.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "asdf/plugin-list"),
  },
  {
    name: "ecp_asdf_list_all_versions",
    description: "List all available versions for a plugin (e.g. nodejs).",
    inputSchema: { name: z.string() },
    handler: async (args, client) => client.request("GET", `asdf/list-all/${args.name}`),
  },
  {
    name: "ecp_asdf_list_installed_versions",
    description: "List installed versions for a plugin.",
    inputSchema: { name: z.string() },
    handler: async (args, client) => client.request("GET", `asdf/list-installed/${args.name}`),
  },
  {
    name: "ecp_asdf_install",
    description: "Install a plugin version (takes time). This tool cannot show install output - check ecp_asdf_list_installed_versions afterward to confirm it succeeded.",
    inputSchema: { name: z.string(), version: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "asdf/install", { body: { name: args.name, version: args.version } }),
  },
  {
    name: "ecp_asdf_uninstall",
    description: "Uninstall a plugin version. Breaks anything still configured to use it. This tool cannot show output - check ecp_asdf_list_installed_versions afterward.",
    inputSchema: { name: z.string(), version: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "asdf/uninstall", { body: { name: args.name, version: args.version } }),
  },
  {
    name: "ecp_asdf_set_global",
    description: "Set the global default version for a plugin.",
    inputSchema: { name: z.string(), version: z.string() },
    handler: async (args, client) => client.request("POST", "asdf/global", { body: args }),
  },
];
