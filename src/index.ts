#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EcpClient } from "./ecp-client.js";
import { auditLog } from "./audit-log.js";
import { accountTools } from "./tools/account.js";
import { appsTools } from "./tools/apps.js";
import { domainTools } from "./tools/domains.js";
import { filesTools } from "./tools/files.js";
import { databaseTools } from "./tools/database.js";
import { mongodbTools } from "./tools/mongodb.js";
import { mssqlTools, postgresTools } from "./tools/relational-engines.js";
import { systemTools } from "./tools/system.js";
import { asdfTools } from "./tools/asdf.js";
import { oneclickTools } from "./tools/oneclick.js";
import { gitIntegrationTools } from "./tools/git-integrations.js";
import { resourceMonitorTools } from "./tools/resource-monitor.js";
import { storageBdTools } from "./tools/storage-bd.js";
import { backupTools } from "./tools/backup.js";
import type { ToolDef } from "./tools/types.js";

// Dev-only escape hatch for a self-signed target (see .env.sample). Process-
// wide and opt-in only - never the default, since it weakens every HTTPS
// request this process makes, not just ones to the configured ECP host.
if ((process.env.ECP_TLS_INSECURE ?? "false").toLowerCase() === "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.error(
    "[ecp-mcp-server] WARNING: ECP_TLS_INSECURE=true - TLS certificate verification is disabled for this process.",
  );
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${name} (see .env.sample)`);
  }
  return value;
}

const apiBaseUrl = requireEnv("ECP_API_BASE_URL");

const client = new EcpClient({
  baseUrl: apiBaseUrl,
  username: requireEnv("ECP_ACCOUNT_USERNAME"),
  password: requireEnv("ECP_ACCOUNT_PASSWORD"),
  remember: (process.env.ECP_REMEMBER ?? "false").toLowerCase() === "true",
});

// ecp-go serves its browser UI on port 2323 and its API (what this server
// talks to) on 2324, same host - derived here so the "go do this in ecp-ui"
// guidance below points at a real, clickable URL instead of a vague
// pointer.
const ecpUiUrl = apiBaseUrl.replace(/:2324\/api\/?$/, ":2323");

const server = new McpServer(
  { name: "ecp-mcp-server", version: "0.1.0" },
  {
    instructions: `This server manages one ECP hosting account's apps, domains, databases, files, PHP, SSL, and related settings.

No arbitrary shell command execution is available through any tool here - by design, not oversight. ecp-go's own command-execution routes (custom-command/execute, oneclick's run-cmd, the interactive terminal) are either fire-and-forget with no way to see output, or don't fit a single tool-call shape at all. Do not try to route around this by improvising a command through another tool (e.g. stuffing a shell command into a deploy step's install/build fields expecting to see its output back - those have the identical blind-execution problem).

For the same reason, triggering a local file backup or restore isn't available either (ecp_backup_list_snapshots is - listing is fine) - starting one requires the same fire-and-forget, no-visible-outcome mechanism.

When a task genuinely needs a shell command or a backup/restore trigger this server has no tool for, tell the user to do it themselves in ECP's own UI in the browser: ${ecpUiUrl} - don't guess at a workaround.`,
  },
);

const allTools: ToolDef[] = [
  ...accountTools,
  ...appsTools,
  ...domainTools,
  ...filesTools,
  ...databaseTools,
  ...mongodbTools,
  ...mssqlTools,
  ...postgresTools,
  ...systemTools,
  ...asdfTools,
  ...oneclickTools,
  ...gitIntegrationTools,
  ...resourceMonitorTools,
  ...storageBdTools,
  ...backupTools,
];

for (const tool of allTools) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.inputSchema },
    async (args) => {
      try {
        const result = await tool.handler(args, client);
        await auditLog({ tool: tool.name, args, result: "success" });
        return {
          content: [{ type: "text", text: JSON.stringify(result ?? null, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await auditLog({ tool: tool.name, args, result: "error", detail: message });
        return {
          content: [{ type: "text", text: `Error calling ${tool.name}: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting ecp-mcp-server:", err);
  process.exit(1);
});
