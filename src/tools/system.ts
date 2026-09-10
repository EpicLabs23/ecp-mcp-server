import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/php.go, router/ssl.go, router/system.go, router/supervisor.go,
// router/crontab.go.
//
// php install/uninstall use the same fire-and-forget ExecRto primitive as
// the blocked custom-command/execute (confirmed by reading
// handler/php/*.go) - they start a real apt-get install/remove but the
// "output" field in the response is always empty. Flagged in the tool
// descriptions; verify success via ecp_php_installed_versions afterward.
//
// crontab/supervisor commands route through ecp-cli's buildArgs, which
// base64-encodes the JSON body into a single --body= flag before shelling
// out (ecp-cli.service.ts:38-54) - safe from shell injection regardless of
// content, unlike custom-command/execute's raw string. Crontab entries are
// a real, intentional ECP self-service feature (ecp-ui exposes it too), not
// a way around the Phase 7 command-execution block - but scheduling a
// command that runs repeatedly and unattended is still meaningfully
// different from a one-shot action, so it gets `confirm: true` too.

export const systemTools: ToolDef[] = [
  // PHP
  {
    name: "ecp_php_installed_versions",
    description: "List PHP versions installed on this account's container.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "php/installed-versions"),
  },
  {
    name: "ecp_php_installed_packages",
    description: "List installed PHP extensions for a version.",
    inputSchema: { version: z.string() },
    handler: async (args, client) => client.request("GET", `php/installed-packages/${args.version}`),
  },
  {
    name: "ecp_php_get_ini",
    description: "Get php.ini values for a PHP version.",
    inputSchema: { version: z.string() },
    handler: async (args, client) => client.request("GET", "php/ini", { query: { version: args.version } }),
  },
  {
    name: "ecp_php_set_ini",
    description: "Overwrite php.ini for a PHP version. Can break every app using that version if malformed.",
    inputSchema: { version: z.string(), file_content: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "php/ini", { body: args }),
  },
  {
    name: "ecp_php_install",
    description: "Install a PHP version (apt-get, takes time). This tool cannot show install output - check ecp_php_installed_versions afterward to confirm it succeeded.",
    inputSchema: { version: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "php/install", { body: { version: args.version } }),
  },
  {
    name: "ecp_php_uninstall",
    description: "Uninstall a PHP version. Breaks any app still configured to use it. This tool cannot show uninstall output - check ecp_php_installed_versions afterward.",
    inputSchema: { version: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "php/uninstall", { body: { version: args.version } }),
  },

  // SSL
  {
    name: "ecp_ssl_available_certificates",
    description: "List certificates available for a domain (pass certificate_name: 'lets_encrypt' or 'self_signed').",
    inputSchema: { domain: z.string().optional(), certificate_name: z.enum(["lets_encrypt", "self_signed"]).optional() },
    handler: async (args, client) => client.request("GET", "ssl/available-certificates", { query: args }),
  },
  {
    name: "ecp_ssl_request_lets_encrypt",
    description: "Issue a new Let's Encrypt certificate for a domain (does not apply it to nginx - see ecp_ssl_update_lets_encrypt or ecp_ssl_apply_certificate).",
    inputSchema: { domain: z.string() },
    handler: async (args, client) => client.request("POST", "ssl/request-lets-encrypt-certificate", { body: { domain: args.domain } }),
  },
  {
    name: "ecp_ssl_update_lets_encrypt",
    description: "Issue and apply a Let's Encrypt certificate to a domain's nginx config. Can break HTTPS for that domain if it fails partway.",
    inputSchema: { domain: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "ssl/update-lets-encrypt-certificate", { body: { domain: args.domain, certificate_name: "lets_encrypt" } }),
  },
  {
    name: "ecp_ssl_request_self_signed",
    description: "Generate a new self-signed certificate for a domain (does not apply it to nginx).",
    inputSchema: { domain: z.string() },
    handler: async (args, client) => client.request("POST", "ssl/request-self-signed-certificate", { body: { domain: args.domain } }),
  },
  {
    name: "ecp_ssl_update_self_signed",
    description: "Generate and apply a self-signed certificate to a domain's nginx config. Can break HTTPS for that domain if it fails partway.",
    inputSchema: { domain: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "ssl/update-self-signed-certificate", { body: { domain: args.domain, certificate_name: "self_signed" } }),
  },
  {
    name: "ecp_ssl_apply_certificate",
    description: "Apply an already-generated certificate to a domain's nginx config, without regenerating it. Can break HTTPS for that domain if misapplied.",
    inputSchema: { domain: z.string(), certificate_name: z.enum(["lets_encrypt", "self_signed"]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "ssl/apply-certificate", { body: args }),
  },

  // System
  {
    name: "ecp_system_disk_usage",
    description: "Get disk, container-temp-file, and database usage/quota for this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "system/quota/disk-usage"),
  },
  {
    name: "ecp_system_check_for_update",
    description: "Check whether an ECP/system update is available.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "system/update/check-for-update"),
  },
  {
    name: "ecp_system_update",
    description: "Update account/hosting settings (hosting_environment, hosting_version) or ECP password. Requires the account's own current password. Account-wide impact - review carefully.",
    inputSchema: {
      ecp_password: z.string(),
      hosting_environment: z.string().optional(),
      hosting_version: z.string().optional(),
      confirm: z.literal(true),
    },
    handler: async (args, client) => client.request("POST", "system/update", { body: args }),
  },
  {
    name: "ecp_system_get_config",
    description: "Get this account's ECP config key/values.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "system/config"),
  },
  {
    name: "ecp_system_set_config",
    description: "Update ECP config key/values for this account.",
    inputSchema: { config: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "system/config", { body: args.config }),
  },

  // Supervisor (process management)
  {
    name: "ecp_supervisor_list_processes",
    description: "List all supervised processes on this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "supervisor/processes"),
  },
  {
    name: "ecp_supervisor_process_info",
    description: "Get status/info for one supervised process.",
    inputSchema: { app_name: z.string() },
    handler: async (args, client) => client.request("GET", `supervisor/process-info/${args.app_name}`),
  },
  {
    name: "ecp_supervisor_add_process",
    description: "Register a new supervised (auto-restarting) process.",
    inputSchema: {
      name: z.string(),
      command: z.string(),
      directory: z.string(),
      autostart: z.boolean().optional(),
      environment: z.record(z.string(), z.string()).optional(),
    },
    handler: async (args, client) => client.request("POST", "supervisor/add-process", { body: args }),
  },
  {
    name: "ecp_supervisor_remove_process",
    description: "Remove a supervised process. Irreversible (config is deleted, not just stopped).",
    inputSchema: { app_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", `supervisor/remove-process/${args.app_name}`),
  },
  {
    name: "ecp_supervisor_start_process",
    description: "Start a supervised process.",
    inputSchema: { app_name: z.string() },
    handler: async (args, client) => client.request("POST", `supervisor/start-process/${args.app_name}`),
  },
  {
    name: "ecp_supervisor_stop_process",
    description: "Stop a supervised process.",
    inputSchema: { app_name: z.string() },
    handler: async (args, client) => client.request("POST", `supervisor/stop-process/${args.app_name}`),
  },
  {
    name: "ecp_supervisor_restart_process",
    description: "Restart a supervised process.",
    inputSchema: { app_name: z.string() },
    handler: async (args, client) => client.request("POST", `supervisor/restart-process/${args.app_name}`),
  },

  // Crontab
  {
    name: "ecp_crontab_list",
    description: "List this account's scheduled cron jobs.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "crontab/list"),
  },
  {
    name: "ecp_crontab_add",
    description: "Schedule a cron job. cron_expression is a standard 5-field schedule (e.g. '0 3 * * *'). The command runs unattended, repeatedly, as this account's own system user - review carefully before confirming.",
    inputSchema: { cron_expression: z.string(), command: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "crontab/add", { body: { cronExpression: args.cron_expression, command: args.command } }),
  },
  {
    name: "ecp_crontab_remove",
    description: "Remove a scheduled cron job. Must match an existing entry's cron_expression and command exactly (see ecp_crontab_list).",
    inputSchema: { cron_expression: z.string(), command: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("DELETE", "crontab/remove", { body: { cronExpression: args.cron_expression, command: args.command } }),
  },
];
