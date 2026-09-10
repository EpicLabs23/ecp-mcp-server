import type { ToolDef } from "./types.js";

// GET /api/user/profile -> ecp-go proxies to EHM's ecp/user-profile, which
// returns the full account profile (not just decoded JWT claims, unlike
// /api/user/me) - the richest single call to confirm the whole auth chain
// (login -> access token -> refresh_token cookie -> authenticated request)
// actually works end to end.
export const accountTools: ToolDef[] = [
  {
    name: "ecp_whoami",
    description: "Get the profile of the hosting account this MCP server is authenticated as.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "user/profile"),
  },
];
