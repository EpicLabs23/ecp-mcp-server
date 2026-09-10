import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/resource-monitor.go - account resource/quota status and
// notifications. All read-only or low-risk state changes (dismiss/mark
// read) - nothing here is destructive to app/data state.

export const resourceMonitorTools: ToolDef[] = [
  {
    name: "ecp_resource_status",
    description: "Get this account's resource/quota status (e.g. disk or CPU pressure, suspension warnings).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "resource-status"),
  },
  {
    name: "ecp_resource_status_dismiss",
    description: "Dismiss a resource-status warning banner.",
    inputSchema: { resource_type: z.string() },
    handler: async (args, client) => client.request("PATCH", `resource-status/${args.resource_type}/dismiss`),
  },
  {
    name: "ecp_notifications_list",
    description: "List this account's notifications.",
    inputSchema: { unread: z.boolean().optional() },
    handler: async (args, client) => client.request("GET", "notifications", { query: { unread: args.unread } }),
  },
  {
    name: "ecp_notifications_mark_read",
    description: "Mark one notification read.",
    inputSchema: { id: z.union([z.string(), z.number()]) },
    handler: async (args, client) => client.request("PATCH", `notifications/${args.id}/read`),
  },
  {
    name: "ecp_notifications_mark_all_read",
    description: "Mark all notifications read.",
    inputSchema: {},
    handler: async (_args, client) => client.request("PATCH", "notifications/read-all"),
  },
  {
    name: "ecp_notifications_delete",
    description: "Delete one notification. Irreversible.",
    inputSchema: { id: z.union([z.string(), z.number()]), confirm: z.literal(true) },
    handler: async (args, client) => client.request("DELETE", `notifications/${args.id}`),
  },
  {
    name: "ecp_notifications_clear_all",
    description: "Delete all notifications. Irreversible.",
    inputSchema: { confirm: z.literal(true) },
    handler: async (_args, client) => client.request("DELETE", "notifications"),
  },
];
