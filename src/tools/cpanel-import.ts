import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router.CpanelImport's routes (ecp-go) - see
// ehm-api/docs/CPANEL_IMPORT.md. The SSH private key is only ever taken as a
// *path to a file already inside the account's home directory*, never as key
// content: ecp-ui's paste box is the only place the key itself is accepted,
// so a key never has to pass through an AI conversation. The import itself
// runs server-to-server inside the account's container (ecp-go), so unlike
// the blind custom-command route this has a real status to poll.
const connection = z.object({
  host: z.string().describe("cPanel server hostname or IP"),
  port: z.number().int().optional().describe("SSH port, default 22"),
  username: z.string().describe("cPanel account username"),
  private_key_path: z
    .string()
    .describe(
      "Path to the SSH private key file inside this hosting account's home directory, e.g. '~/.ssh/cpanel_key'. Upload it there first (ECP's File Manager). Passphrase-protected keys aren't supported.",
    ),
});

export const cpanelImportTools: ToolDef[] = [
  {
    name: "ecp_cpanel_discover",
    description:
      "Connect to a cPanel server over SSH and list its websites: domain, document root, PHP version (and the nearest version available here), whether it's WordPress, and its database name. Read-only on both sides. Also returns the server's SSH host key fingerprint - show it to the user so they can confirm it's the right server.",
    inputSchema: { connection },
    handler: async (args, client) =>
      client.request("POST", "cpanel-import/discover", { body: { connection: args.connection } }),
  },
  {
    name: "ecp_cpanel_import_start",
    description:
      "Import websites from a cPanel server into this account as PHP apps: copies each site's files and its MySQL database (into a new database here), rewrites a WordPress site's wp-config.php to the new database, and optionally attaches the site's domain if this account already has it. Runs in the background - returns a job_id; poll ecp_cpanel_import_status until state isn't 'running'. Nothing on the cPanel server is changed. For a non-WordPress site whose database should come along, pass its cPanel database credentials in `database`; otherwise only files are copied.",
    inputSchema: {
      connection,
      sites: z
        .array(
          z.object({
            domain: z.string().describe("A domain exactly as returned by ecp_cpanel_discover"),
            app_name: z.string().optional(),
            app_dir: z.string().optional().describe("Folder under ~/apps; defaults to the suggested_app_dir. Must not exist yet."),
            php_version: z.string().optional().describe("e.g. '8.3'; defaults to the discovered php_version"),
            attach_domain: z.boolean().optional().describe("Serve the app on its domain here. Only works if this account already has the domain."),
            skip_database: z.boolean().optional(),
            database: z
              .object({
                name: z.string(),
                user: z.string(),
                password: z.string(),
                host: z.string().optional(),
              })
              .optional()
              .describe("Only for non-WordPress sites - WordPress credentials are read from wp-config.php automatically."),
          }),
        )
        .min(1),
      confirm: z.literal(true),
    },
    handler: async (args, client) =>
      client.request("POST", "cpanel-import/import", {
        body: { connection: args.connection, sites: args.sites },
      }),
  },
  {
    name: "ecp_cpanel_import_status",
    description:
      "Get the progress of a cPanel import job: overall state (running/completed/failed) and, per site, each step's status, the new app id, the new database name, and any warnings the user should act on (e.g. a PHP version change, or where a non-WordPress site's new database credentials were saved).",
    inputSchema: { job_id: z.string() },
    handler: async (args, client) => client.request("GET", `cpanel-import/jobs/${encodeURIComponent(String(args.job_id))}`),
  },
];
