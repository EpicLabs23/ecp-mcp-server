import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/apps.go. A few caveats worth carrying into the tool
// descriptions, discovered by reading the actual ecp-go handlers rather than
// assumed from the route list:
//
// - create-from-git's `git clone` step runs via ecp-go's fire-and-forget
//   ExecRto helper (same primitive as the blocked custom-command/execute,
//   see the plan's "Command execution" section) - the app row is created in
//   EHM immediately after the clone STARTS, not after it finishes. A large
//   repo may still be cloning when this tool returns success.
// - deploy's "install"/"build" actions use the same fire-and-forget ExecRto
//   path - there is no way to retrieve their command output via this API
//   (ecp-go only streams it to a live browser socket). "configure" runs
//   synchronously but also returns no output. Only "start"/"stop"/"restart"/
//   "remove" give a real synchronous result (they go through supervisor).

export const appsTools: ToolDef[] = [
  {
    name: "ecp_apps_list",
    description: "List all apps on this hosting account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "apps/"),
  },
  {
    name: "ecp_apps_get",
    description: "Get one app's details by id.",
    inputSchema: { id: z.union([z.string(), z.number()]) },
    handler: async (args, client) => client.request("GET", `apps/${args.id}`),
  },
  {
    name: "ecp_apps_directory_tree",
    description: "Browse the account's directory tree (used to pick a location for a new app, or to sanity-check where a git clone landed).",
    inputSchema: { directory: z.string().optional() },
    handler: async (args, client) =>
      client.request("GET", "apps/directory-tree", { query: { directory: args.directory } }),
  },
  {
    name: "ecp_apps_create_from_upload",
    description: "Register an app whose files were already uploaded to app_dir.",
    inputSchema: {
      app_name: z.string(),
      app_dir: z.string(),
      deploy_type: z.string().optional(),
      domain: z.string().optional(),
    },
    handler: async (args, client) => client.request("POST", "apps/create-from-upload", { body: args }),
  },
  {
    name: "ecp_apps_create_from_git",
    description:
      "Create an app by cloning a git repo. Either set provider+repo_full_name (clone via a connected git account, see ecp_git_* tools) or repo_url (+ optional repo_username/repo_password for a private repo). " +
      "Note: the clone runs in the background - this tool returns once the clone STARTS, not once it finishes. For a large repo, check ecp_apps_directory_tree afterward before assuming the files are all there.",
    inputSchema: {
      app_name: z.string(),
      app_dir: z.string(),
      deploy_type: z.string().optional(),
      branch: z.string().optional(),
      provider: z.string().optional(),
      repo_full_name: z.string().optional(),
      repo_url: z.string().optional(),
      repo_username: z.string().optional(),
      repo_password: z.string().optional(),
    },
    handler: async (args, client) => client.request("POST", "apps/create-from-git", { body: args }),
  },
  {
    name: "ecp_apps_delete",
    description: "Delete an app: stops its supervisor process (if any) and removes its files. Irreversible.",
    inputSchema: { id: z.union([z.string(), z.number()]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("DELETE", `apps/${args.id}`),
  },
  {
    name: "ecp_apps_update_domain",
    description: "Point an app at a domain: creates the nginx server block and updates the app's domain record.",
    inputSchema: { id: z.union([z.string(), z.number()]), domain: z.string() },
    handler: async (args, client) =>
      client.request("PATCH", `apps/update-domain/${args.id}`, { body: { domain: args.domain } }),
  },
  {
    name: "ecp_apps_update_static_domain",
    description: "Point a static-site app at a domain: creates the nginx static block and updates the app's domain record.",
    inputSchema: { id: z.union([z.string(), z.number()]), domain: z.string() },
    handler: async (args, client) =>
      client.request("PATCH", `apps/update-static-domain/${args.id}`, { body: { domain: args.domain } }),
  },
  {
    name: "ecp_apps_deploy_step",
    description:
      "Run one step of an app's deploy lifecycle. action='start'|'stop'|'restart'|'remove' manage the app's supervisor process and return a real result. " +
      "action='install'|'build' run a command in the background via app_root_directory (install_command/build_command) but this tool CANNOT show you their output - check ecp_apps_tail_logs or the app's own state afterward. " +
      "action='configure' pins an asdf runtime version (stack_version) for the app and also returns no output.",
    inputSchema: {
      action: z.enum(["configure", "install", "build", "start", "stop", "restart", "remove"]),
      app_name: z.string(),
      app_id: z.number().optional(),
      app_root_directory: z.string(),
      deploy_type: z.string().optional(),
      stack_version: z.string().optional(),
      install_command: z.string().optional(),
      build_command: z.string().optional(),
      start_command: z.string().optional(),
      env_file_path: z.string().optional(),
    },
    handler: async (args, client) => client.request("POST", "apps/deploy", { body: args }),
  },
  {
    name: "ecp_apps_tail_logs",
    description: "Tail an app's supervisor-managed process log (only meaningful after a 'start' deploy step).",
    inputSchema: { app_name: z.string(), byte_count: z.number().optional() },
    handler: async (args, client) =>
      client.request("GET", "apps/logs", {
        query: { app_name: args.app_name, byte_count: args.byte_count },
      }),
  },
  {
    name: "ecp_apps_flush_logs",
    description: "Clear an app's supervisor-managed process log.",
    inputSchema: { app_name: z.string() },
    handler: async (args, client) => client.request("GET", "apps/flush-logs", { query: { app_name: args.app_name } }),
  },
  {
    name: "ecp_apps_save_custom_command",
    description: "Save a named custom command for an app (does not run it - see the blocked command-execution phase in the plan for why 'run' isn't exposed yet).",
    inputSchema: { app_id: z.number(), commands: z.array(z.object({ title: z.string().optional(), command: z.string() })) },
    handler: async (args, client) => client.request("POST", "apps/custom-command", { body: args }),
  },
];
