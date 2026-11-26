import { realpath, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EcpClient, LocalFile } from "./ecp-client.js";
import type { ToolContext } from "./tools/types.js";

// Uploads read a file from the machine this server runs on and send it to
// ECP, so the bytes never pass through the model (which is what capped
// ecp_files_write / sql_content at whatever fits in a chat message, and made
// binary files impossible).
//
// Reading a local file is also the risky part: a model steered by text it
// read somewhere could try to send ~/.ssh/id_rsa to the hosting account,
// where a public folder would serve it. So a file is sent without asking
// only if it's inside a folder the user already gave the client (MCP roots,
// e.g. Claude Code's working folders) or listed in ECP_UPLOAD_DIRS.
// Anything else needs the user's yes in an approval prompt, and fails closed
// when the client can't show one.

function configuredDirs(): string[] {
  const raw = process.env.ECP_UPLOAD_DIRS?.trim() ?? "";
  // An unfilled plugin option arrives as the literal "${...}" placeholder.
  if (!raw || /^\$\{[^}]*\}$/.test(raw)) return [];
  return raw
    .split(path.delimiter)
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("~") ? path.join(os.homedir(), d.slice(1)) : d));
}

async function allowedDirs(ctx: ToolContext): Promise<string[]> {
  const dirs = [...configuredDirs(), ...(await ctx.listRoots())];
  const resolved: string[] = [];
  for (const dir of dirs) {
    try {
      resolved.push(await realpath(path.resolve(dir)));
    } catch {
      // A configured folder that doesn't exist just allows nothing.
    }
  }
  return resolved;
}

function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function formatSize(bytes: number): string {
  if (bytes >= 1 << 30) return `${(bytes / (1 << 30)).toFixed(1)} GB`;
  if (bytes >= 1 << 20) return `${(bytes / (1 << 20)).toFixed(1)} MB`;
  if (bytes >= 1 << 10) return `${(bytes / (1 << 10)).toFixed(1)} KB`;
  return `${bytes} bytes`;
}

/** ECP's per-upload limit in bytes, or null on an ECP too old to say (pre-2.0.5). */
async function uploadLimitBytes(client: EcpClient): Promise<number | null> {
  try {
    const res = await client.request<{ upload_max_size_mb?: number }>("GET", "file-system/upload-limit");
    return typeof res?.upload_max_size_mb === "number" ? res.upload_max_size_mb * (1 << 20) : null;
  } catch {
    return null;
  }
}

/**
 * Resolve, check and open a local file for upload. `purpose` describes where
 * it's going, for the approval prompt (e.g. "to ~/public_html on ECP").
 */
export async function openLocalUpload(
  localPath: string,
  purpose: string,
  client: EcpClient,
  ctx: ToolContext,
): Promise<LocalFile> {
  const given = localPath.startsWith("file://")
    ? fileURLToPath(localPath)
    : localPath.startsWith("~")
      ? path.join(os.homedir(), localPath.slice(1))
      : localPath;
  if (!path.isAbsolute(given)) {
    throw new Error(`local_path must be an absolute path on this computer, got "${localPath}".`);
  }

  let real: string;
  try {
    real = await realpath(given);
  } catch {
    throw new Error(`No file at ${given} on this computer.`);
  }
  const info = await stat(real);
  if (!info.isFile()) throw new Error(`${given} isn't a file. To send a folder, compress it into a .zip first, upload that, then ecp_files_extract it.`);

  const limit = await uploadLimitBytes(client);
  if (limit !== null && info.size > limit) {
    throw new Error(
      `${given} is ${formatSize(info.size)}, over this ECP's ${formatSize(limit)} upload limit. The hosting admin can raise the account's upload limit in EHM.`,
    );
  }

  const dirs = await allowedDirs(ctx);
  if (!dirs.some((dir) => isInside(real, dir))) {
    const shown = real === given ? real : `${given} (which points to ${real})`;
    let ok: boolean;
    try {
      ok = await ctx.askUser(
        `Send ${shown} (${formatSize(info.size)}) from this computer ${purpose}? It's outside the folders this server may upload from without asking.`,
      );
    } catch {
      throw new Error(
        `${shown} is outside the folders this server may upload from (the chat app's working folders and ECP_UPLOAD_DIRS), and this chat app can't show an approval prompt. Move the file into one of those folders, or add its folder to ECP_UPLOAD_DIRS (the plugin's "Upload folder" option).`,
      );
    }
    if (!ok) throw new Error("The user declined sending this file.");
  }

  return { path: real, size: info.size };
}

/**
 * The SQL for an *_import_database tool: either pasted text (sql_content, for
 * a small dump) or a .sql file on this computer (sql_file_path, any size up
 * to the upload limit). Exactly one must be given.
 */
export async function importSqlSource(
  args: { db_name: string; sql_content?: string; sql_file_path?: string },
  client: EcpClient,
  ctx: ToolContext,
): Promise<string | LocalFile> {
  const hasText = typeof args.sql_content === "string" && args.sql_content !== "";
  const hasFile = typeof args.sql_file_path === "string" && args.sql_file_path !== "";
  if (hasText === hasFile) throw new Error("Pass exactly one of sql_content (the SQL as text) or sql_file_path (a .sql file on this computer).");
  if (hasText) return args.sql_content as string;
  return openLocalUpload(
    args.sql_file_path as string,
    `to ECP, to import into database ${args.db_name} (overwriting it)`,
    client,
    ctx,
  );
}
