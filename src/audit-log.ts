import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// No durable server-side record exists today for actions taken through an
// account JWT (see ehm-api's IntegrationAuditLog, which only covers
// /integration/* callers) - this file is the only audit trail this tool's
// actions get, so every tool call is logged here, not just destructive ones.

const defaultPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "audit.log",
);

const logPath = process.env.ECP_MCP_AUDIT_LOG_PATH?.trim() || defaultPath;

export interface AuditEntry {
  tool: string;
  args: unknown;
  result: "success" | "error";
  detail?: string;
}

// Several tools (DB row/document browsing, importDatabase's SQL body, etc.)
// take real secrets or bulk payloads as arguments - these must never land in
// a plaintext file on disk. Redact by key name (covers every engine's
// browseRows/insertRow/updateRow/deleteRow, which all use "password") rather
// than per-tool, so a new tool with a sensitive field is covered by default.
const REDACT_KEYS = new Set([
  "password",
  "sql_content",
  "file_content",
  "repo_password",
  "db_pass",
  "admin_pass",
  "ecp_password",
  "client_secret",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        REDACT_KEYS.has(key) ? "[redacted]" : redact(val),
      ]),
    );
  }
  return value;
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), ...entry, args: redact(entry.args) });
  await appendFile(logPath, line + "\n", "utf8");
}
