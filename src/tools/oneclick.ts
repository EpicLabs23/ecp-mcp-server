import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to apps.go's oneclick/WordPress routes. ecp_oneclick_run_cmd is
// deliberately NOT exposed: oneclick.RunCmd (handler/apps/oneclick/oneclick.go)
// runs a caller-supplied `command` string through the same fire-and-forget
// ExecRto shell primitive as custom-command/execute - it's meant to carry a
// blueprint's own predefined install steps, but nothing stops the MCP
// caller from putting anything there. Same risk class as the blocked
// Phase 7 command execution, so it stays out until that's resolved.
// Consequence: ecp_oneclick_install_wordpress only scaffolds the app
// directory + nginx block + wp-config.php HTTPS fix - it does NOT actually
// run the WordPress installer (that's normally a run-cmd call using the
// blueprint's cmdSteps). Fetch the blueprint with ecp_oneclick_get_blueprint
// to see what commands would need to run, and use ecp_files_* / your own
// terminal to run them manually for now.

export const oneclickTools: ToolDef[] = [
  {
    name: "ecp_oneclick_blueprint_apps",
    description: "List available one-click app blueprints (fetched from the public EH blueprints catalog).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "apps/oneclick/blueprint-apps"),
  },
  {
    name: "ecp_oneclick_get_blueprint",
    description: "Get a blueprint's definition, including the install commands it expects to run (for you to review/run yourself - see note on why this MCP server doesn't run them automatically).",
    inputSchema: { name: z.string(), version: z.string() },
    handler: async (args, client) => client.request("GET", `apps/oneclick/blueprint/${args.name}/${args.version}`),
  },
  {
    name: "ecp_oneclick_install_wordpress",
    description: "Scaffold a WordPress app: creates the app directory, nginx server block, and patches wp-config.php for HTTPS. Does NOT install WordPress itself - see ecp_oneclick_get_blueprint and run its install commands yourself afterward.",
    inputSchema: {
      app_name: z.string(),
      app_dir: z.string(),
      domain: z.string(),
      php_version: z.string(),
    },
    handler: async (args, client) => client.request("POST", "apps/oneclick/wordpress", { body: args }),
  },
  {
    name: "ecp_oneclick_create_database",
    description: "Create a MySQL user + database in one step, for use during a one-click app install. If user creation fails (e.g. already exists), database creation is still attempted - check ecp_mysql_list_db_users/ecp_mysql_list_databases afterward if unsure.",
    inputSchema: { db_name: z.string(), db_user: z.string(), db_pass: z.string() },
    handler: async (args, client) => client.request("POST", "apps/oneclick/create-database", { body: args }),
  },
];
