import type { ToolDef } from "./types.js";

// Maps to router/backup.go - local restic snapshots of host paths, separate
// from storage.bd's own backup/restore (tools/storage-bd.ts). Only the read
// side is exposed:
//
// ecp_backup_path/ecp_backup_restore are NOT built. Both require a
// socket_id and run through the same job-claim/complete + WS-progress
// machinery as the already-excluded storage-bd job endpoints (confirmed by
// reading handler/backup/backup.go's BackupPath/RestorePath - they call
// claimJob/completeJob and stream progress to that socket) - same
// fire-and-forget, output-blind shape as the blocked command-execution
// tools, not just "needs an extra field." ListSnapshots has no such
// requirement - it runs `restic snapshots --json` synchronously and
// returns real output directly.

export const backupTools: ToolDef[] = [
  {
    name: "ecp_backup_list_snapshots",
    description: "List local restic snapshots of this account's host paths (separate from storage.bd's own backups).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "backup/snapshots"),
  },
];
