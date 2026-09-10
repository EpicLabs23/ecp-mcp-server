import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/storage_bd.go - config get/set and job status only. Per
// the plan, the job-lock protocol endpoints (job/claim, job/:id/complete,
// config/secret) are NOT exposed here - ecp-go's own router never calls
// them either (they're internal, triggered by the browser-facing /backup
// websocket routes), confirming they're not part of ECP's real API surface.

export const storageBdTools: ToolDef[] = [
  {
    name: "ecp_storage_bd_get_config",
    description: "Get this account's storage.bd backup config (client_id only - the secret is never returned).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "storage-bd/config"),
  },
  {
    name: "ecp_storage_bd_set_config",
    description: "Set this account's storage.bd backup credentials (client_id as '<tenant_id>.<install_id>', client_secret).",
    inputSchema: { client_id: z.string(), client_secret: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("PATCH", "storage-bd/config", { body: args }),
  },
  {
    name: "ecp_storage_bd_job_status",
    description: "Check whether a storage.bd backup/restore job is currently running for this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "storage-bd/job/status"),
  },
];
