import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router.WordpressHosting's routes (ecp-go) - the Managed WordPress
// Hosting pipeline (OpenLiteSpeed + lsphp, not nginx/PHP-FPM), see
// ehm-api/docs/MANAGED_WORDPRESS.md. Replaces the old oneclick-based
// WordPress tools entirely (ecp_oneclick_install_wordpress,
// ecp_oneclick_blueprint_apps, ecp_oneclick_get_blueprint,
// ecp_oneclick_create_database) - those called into ecp-go's legacy
// oneclick engine, which has since been removed. Unlike the old
// ecp_oneclick_install_wordpress (which only ever scaffolded the app
// directory/nginx block, because actually running the installer meant
// going through oneclick's RunCmd - a caller-supplied shell command, the
// same risk class as the blocked terminal/command-execution tools, so it
// was deliberately left unexposed), this tool completes a real install:
// database creation, `wp core download/config/install`, and the
// LSCache/Wordfence/Yoast SEO plugin activations, all server-side as
// pre-built, argv-safe Go code - no shell string ever built from tool
// input, so there's no RunCmd-style risk to gate here.
export const wordpressHostingTools: ToolDef[] = [
  {
    name: "ecp_managed_wordpress_install",
    description:
      "Install a complete, working WordPress site via Managed WordPress Hosting (OpenLiteSpeed + lsphp): creates the database, runs the full WordPress install (core download/config/install), and activates LSCache, Wordfence, and Yoast SEO. This actually finishes the install - unlike the old one-click tool, there's no manual follow-up step.",
    inputSchema: {
      domain: z.string(),
      app_name: z.string(),
      app_dir: z.string(),
      site_title: z.string(),
      admin_user: z.string(),
      admin_password: z.string(),
      admin_email: z.string(),
      db_name: z.string(),
      db_username: z.string(),
      db_password: z.string(),
    },
    handler: async (args, client) =>
      client.request("POST", "wordpress-hosting/install", {
        body: {
          domain: args.domain,
          app_name: args.app_name,
          app_dir: args.app_dir,
          site_title: args.site_title,
          admin_user: args.admin_user,
          admin_password: args.admin_password,
          admin_email: args.admin_email,
          db_name: args.db_name,
          db_username: args.db_username,
          db_password: args.db_password,
        },
      }),
  },
  {
    name: "ecp_managed_wordpress_sso_login",
    description:
      "Get a one-time login link into a Managed WordPress site's wp-admin, without needing the WordPress admin password. The link is single-use and expires in about a minute - open it right away.",
    inputSchema: { app_id: z.number() },
    handler: async (args, client) =>
      client.request("POST", `wordpress-hosting/${args.app_id}/sso-login`),
  },
  {
    name: "ecp_managed_wordpress_purge_cache",
    description: "Purge the LiteSpeed page cache for a Managed WordPress site.",
    inputSchema: { app_id: z.number() },
    handler: async (args, client) =>
      client.request("POST", `wordpress-hosting/${args.app_id}/cache/purge`),
  },
  {
    name: "ecp_managed_wordpress_status",
    description: "Get a Managed WordPress site's status: provisioning state, WordPress version, cache mode, whether its container is running, and whether the site answers on port 80.",
    inputSchema: { app_id: z.number() },
    handler: async (args, client) => client.request("GET", `wordpress-hosting/${args.app_id}/status`),
  },
  {
    name: "ecp_managed_wordpress_events",
    description: "List a Managed WordPress site's install/maintenance event history (each step's action, started/succeeded/failed/skipped status, and detail), oldest first - use it to see where an install failed.",
    inputSchema: { app_id: z.number() },
    handler: async (args, client) => client.request("GET", `wordpress-hosting/${args.app_id}/events`),
  },
  {
    name: "ecp_managed_wordpress_set_cache_mode",
    description: "Set a Managed WordPress site's LiteSpeed cache mode: 'off', 'page' (full-page cache), or 'object' (page + object cache).",
    inputSchema: { app_id: z.number(), mode: z.enum(["off", "page", "object"]) },
    handler: async (args, client) =>
      client.request("PATCH", `wordpress-hosting/${args.app_id}/cache-mode`, { body: { mode: args.mode } }),
  },
  {
    name: "ecp_managed_wordpress_reset_admin_password",
    description:
      "Reset a WordPress admin user's password (the wp-admin login, not the hosting account's). Omit new_password to have a random one generated - the new password is returned in the result. " +
      "To just get into wp-admin once, ecp_managed_wordpress_sso_login is usually the better choice.",
    inputSchema: { app_id: z.number(), admin_user: z.string(), new_password: z.string().optional(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", `wordpress-hosting/${args.app_id}/reset-admin-password`, {
        body: { admin_user: args.admin_user, new_password: args.new_password },
      }),
  },
  {
    name: "ecp_managed_wordpress_security",
    description: "Get a Managed WordPress site's security status: whether XML-RPC is enabled, the wp-login rate limit in effect, the latest core-file integrity check, and file-permission findings.",
    inputSchema: { app_id: z.number() },
    handler: async (args, client) => client.request("GET", `wordpress-hosting/${args.app_id}/security`),
  },
  {
    name: "ecp_managed_wordpress_set_xmlrpc",
    description: "Turn WordPress XML-RPC (xmlrpc.php) on or off for a Managed WordPress site. It is a common brute-force target - only enable it if something needs it (e.g. Jetpack or the WordPress mobile app).",
    inputSchema: { app_id: z.number(), enabled: z.boolean() },
    handler: async (args, client) =>
      client.request("POST", `wordpress-hosting/${args.app_id}/xmlrpc`, { body: { enabled: args.enabled } }),
  },
];
