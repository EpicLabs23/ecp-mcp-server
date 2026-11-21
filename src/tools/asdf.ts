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
    name: "ecp_asdf_recommend",
    description:
      "Pick a runtime version for an app that doesn't pin one exactly (ecp_apps_detect returned no runtime_version). " +
      "Pass runtime_constraints from ecp_apps_detect as constraints (or [] if there were none). Returns the newest LTS release " +
      "(newest stable for tools with no LTS, like python) that satisfies all of them - e.g. engines.node \">=22\" gets the latest Node LTS, not 22. " +
      "installed_match is an installed version on that line to use as-is; otherwise install `version`. relaxed=true means no release met every upper bound, so only minimums were applied. " +
      "Prefer this over choosing a version yourself.",
    inputSchema: { name: z.string(), constraints: z.array(z.string()).default([]) },
    handler: async (args, client) =>
      client.request("POST", "asdf/recommend", { body: { name: args.name, constraints: args.constraints } }),
  },
  {
    name: "ecp_asdf_install",
    description:
      "Start installing a plugin version. Returns once the install STARTS - building can take minutes (python compiles from source). " +
      "This tool cannot show install output: poll ecp_asdf_list_installed_versions, which only lists a version once its install has actually produced files.",
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
