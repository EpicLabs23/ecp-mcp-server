import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/git-integrations.go + router/git-webhook-management.go.
// clone-token is NOT exposed - it hands back a real git credential and is
// only ever called server-to-server from ecp-go's own create-from-git flow
// (already used internally by ecp_apps_create_from_git), never reachable
// from ecp-ui/browser either.
//
// Webhook commands (below) are a real, intentional ECP feature - what runs
// automatically on a future git push - same posture as crontab: legitimate
// and correctly implemented (no shell injection, per docs/GIT_WEBHOOKS.md),
// but the command runs unattended later, so it's confirm-gated.

const commandsShape = z.array(z.object({ title: z.string().optional(), command: z.string() }));

export const gitIntegrationTools: ToolDef[] = [
  {
    name: "ecp_git_list_providers",
    description: "List git providers (GitHub/GitLab/Bitbucket) enabled for this install.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "account-git/providers"),
  },
  {
    name: "ecp_git_authorize_url",
    description: "Get the OAuth authorize URL to connect a git provider. Open it in a browser to complete the connection - this tool can't complete OAuth itself.",
    inputSchema: { provider: z.enum(["github", "gitlab", "bitbucket"]) },
    handler: async (args, client) => client.request("GET", `account-git/${args.provider}/authorize`),
  },
  {
    name: "ecp_git_list_connections",
    description: "List this account's connected git accounts.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "account-git/connections"),
  },
  {
    name: "ecp_git_disconnect_provider",
    description: "Disconnect a connected git provider.",
    inputSchema: { provider: z.enum(["github", "gitlab", "bitbucket"]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("DELETE", `account-git/${args.provider}`),
  },
  {
    name: "ecp_git_list_repos",
    description: "Browse repos available via a connected git provider (for picking one to deploy from).",
    inputSchema: { provider: z.enum(["github", "gitlab", "bitbucket"]), search: z.string().optional(), page: z.number().optional() },
    handler: async (args, client) =>
      client.request("GET", `account-git/${args.provider}/repos`, { query: { search: args.search, page: args.page } }),
  },

  // Per-app deploy webhook management
  {
    name: "ecp_git_webhook_get",
    description: "Get an app's git deploy-webhook config and status.",
    inputSchema: { app_id: z.union([z.string(), z.number()]) },
    handler: async (args, client) => client.request("GET", `account-git/apps/${args.app_id}/webhook`),
  },
  {
    name: "ecp_git_webhook_create",
    description: "Create a deploy webhook for an app: runs `commands` automatically whenever a matching push arrives. Review each command carefully before confirming.",
    inputSchema: {
      app_id: z.union([z.string(), z.number()]),
      provider: z.enum(["github", "gitlab", "bitbucket"]),
      branch_filter: z.string().optional(),
      commands: commandsShape.optional(),
      confirm: z.literal(true),
    },
    handler: async (args, client) => {
      const { app_id, confirm, ...body } = args;
      return client.request("POST", `account-git/apps/${app_id}/webhook`, { body });
    },
  },
  {
    name: "ecp_git_webhook_update",
    description: "Update an app's deploy-webhook branch filter and/or commands. Review each command carefully before confirming.",
    inputSchema: {
      app_id: z.union([z.string(), z.number()]),
      provider: z.enum(["github", "gitlab", "bitbucket"]),
      branch_filter: z.string().optional(),
      commands: commandsShape.optional(),
      confirm: z.literal(true),
    },
    handler: async (args, client) => {
      const { app_id, confirm, ...body } = args;
      return client.request("PATCH", `account-git/apps/${app_id}/webhook`, { body });
    },
  },
  {
    name: "ecp_git_webhook_delete",
    description: "Delete an app's deploy webhook. Irreversible.",
    inputSchema: { app_id: z.union([z.string(), z.number()]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("DELETE", `account-git/apps/${args.app_id}/webhook`),
  },
  {
    name: "ecp_git_webhook_rotate_secret",
    description: "Rotate an app's deploy-webhook secret (invalidates the old one).",
    inputSchema: { app_id: z.union([z.string(), z.number()]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", `account-git/apps/${args.app_id}/webhook/rotate`),
  },
  {
    name: "ecp_git_webhook_capabilities",
    description: "Get what webhook features the app's git provider supports.",
    inputSchema: { app_id: z.union([z.string(), z.number()]) },
    handler: async (args, client) => client.request("GET", `account-git/apps/${args.app_id}/webhook/capabilities`),
  },
  {
    name: "ecp_git_webhook_deliveries",
    description: "List an app's webhook delivery history (for debugging why a push didn't deploy).",
    inputSchema: { app_id: z.union([z.string(), z.number()]) },
    handler: async (args, client) => client.request("GET", `account-git/apps/${args.app_id}/webhook/deliveries`),
  },
];
