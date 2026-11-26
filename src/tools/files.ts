import { z } from "zod";
import path from "node:path";
import type { ToolDef } from "./types.js";
import { openLocalUpload } from "../local-files.js";

// Maps to router/file-system.go + router/code-editory.go - real local
// filesystem access on the account's own container, with no EHM-API
// equivalent at all. Genuinely useful ("show me this app's .env", "fix this
// config") and genuinely capable of damaging a live site, so every
// destructive op (delete, overwrite, move) requires confirm: true.
//
// direct-download is intentionally NOT exposed: it returns raw binary bytes,
// which don't fit an MCP tool response. upload-recursive IS exposed, as
// ecp_files_upload, by reading the file from this computer's disk - the
// bytes go straight to ECP and never through the model (see local-files.ts).

export const filesTools: ToolDef[] = [
  {
    name: "ecp_files_upload_limit",
    description: "Get the largest upload this ECP accepts, in MB (upload_max_size_mb). It also caps the SQL size for the *_import_database tools. Needs ECP 2.0.5+.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "file-system/upload-limit"),
  },
  {
    name: "ecp_files_upload",
    description:
      "Upload a file from this computer (where this MCP server runs) to the ECP account - any size up to ecp_files_upload_limit, text or binary (images, zips, videos). The file is read from disk and streamed to ECP, so use this instead of ecp_files_write for anything that isn't a small text edit. To upload a folder, zip it first, upload the zip, then ecp_files_extract it. Files outside the chat app's working folders and ECP_UPLOAD_DIRS need the user's approval in a prompt.",
    inputSchema: {
      local_path: z.string().describe("Absolute path of the file on this computer, e.g. /home/me/site/hero.jpg or ~/Downloads/site.zip"),
      destination: z.string().describe("Folder on the ECP account to put it in, e.g. 'public_html' or 'apps/my-app'. Created if missing."),
      file_name: z.string().optional().describe("Name to save it as; defaults to the local file's name"),
      overwrite: z
        .boolean()
        .optional()
        .describe("Replace a file that already exists there. Default false: the upload fails instead."),
    },
    handler: async (rawArgs, client, ctx) => {
      const args = rawArgs as { local_path: string; destination: string; file_name?: string; overwrite?: boolean };
      const name = args.file_name ?? path.basename(args.local_path);
      if (!name || name === "." || name === ".." || /[\\/]/.test(name)) {
        throw new Error(`file_name must be a plain file name (no folders), got "${name}".`);
      }
      const destination = args.destination.replace(/\/+$/, "") || "/";
      const target = `${destination}/${name}`;
      if (!args.overwrite) {
        const exists = await client.request("GET", "file-system/is-directory-exists", { query: { directory: target } });
        if (exists === true || exists === "true") {
          throw new Error(`${target} already exists on ECP. Pass overwrite: true to replace it.`);
        }
      }
      const upload = await openLocalUpload(args.local_path, `to ${target} on the ECP account`, client, ctx);
      await client.requestMultipart(
        "file-system/upload-recursive",
        { destination },
        { fieldName: "file", fileName: name, content: upload },
        { relative_path: name },
      );
      return { uploaded: upload.path, to: target, bytes: upload.size };
    },
  },
  {
    name: "ecp_files_list",
    description: "List files/folders in a directory.",
    inputSchema: { directory: z.string().optional(), hidden_files: z.boolean().optional() },
    handler: async (args, client) =>
      client.request("GET", "file-system/list", {
        query: { directory: args.directory, "hidden-files": args.hidden_files },
      }),
  },
  {
    name: "ecp_files_directory_tree",
    description: "Get the directory tree including files (for browsing/editing, unlike ecp_apps_directory_tree which is folders only).",
    inputSchema: { directory: z.string().optional(), hidden_files: z.boolean().optional() },
    handler: async (args, client) =>
      client.request("GET", "code-editor/directory-tree", {
        query: { directory: args.directory, "hidden-files": args.hidden_files },
      }),
  },
  {
    name: "ecp_files_is_directory_exists",
    description: "Check whether a directory exists.",
    inputSchema: { directory: z.string() },
    handler: async (args, client) =>
      client.request("GET", "file-system/is-directory-exists", { query: { directory: args.directory } }),
  },
  {
    name: "ecp_files_read",
    description: "Read a text file's content.",
    inputSchema: { file_path: z.string() },
    handler: async (args, client) =>
      client.request("GET", "code-editor/file", { query: { "file-path": args.file_path } }),
  },
  {
    name: "ecp_files_write",
    description: "Overwrite a text file's content (creates it if it doesn't exist). Can break a running app if it's a config/env/source file - review the current content first. For files that already exist on this computer, or anything large or binary, use ecp_files_upload instead - this one sends the content through the chat, and ECP 2.0.5+ rejects requests over 32 MB.",
    inputSchema: { file_path: z.string(), file_content: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "code-editor/file", {
        body: { "file-path": args.file_path, "file-content": args.file_content },
      }),
  },
  {
    name: "ecp_files_add_file",
    description: "Create a new empty file.",
    inputSchema: { destination: z.string(), file_name: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/add-new-file", { body: args }),
  },
  {
    name: "ecp_files_add_folder",
    description: "Create a new folder.",
    inputSchema: { destination: z.string(), folder_name: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/add-new-folder", { body: args }),
  },
  {
    name: "ecp_files_rename",
    description: "Rename a file or folder within a directory.",
    inputSchema: { current_directory: z.string(), file_name: z.string(), new_name: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/rename", { body: args }),
  },
  {
    name: "ecp_files_copy",
    description: "Copy one file/folder to a destination.",
    inputSchema: { file_path: z.string(), destination: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/copy", { body: args }),
  },
  {
    name: "ecp_files_copy_multiple",
    description: "Copy multiple files/folders to a destination.",
    inputSchema: { file_paths: z.array(z.string()), destination: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/copy-multiple", { body: args }),
  },
  {
    name: "ecp_files_move",
    description: "Move one file/folder to a destination.",
    inputSchema: { file_path: z.string(), destination: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/move", { body: args }),
  },
  {
    name: "ecp_files_move_multiple",
    description: "Move multiple files/folders to a destination.",
    inputSchema: { file_paths: z.array(z.string()), destination: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/move-multiple", { body: args }),
  },
  {
    name: "ecp_files_change_permission",
    description:
      "chmod a file or folder (e.g. new_permission: '644'). For a folder, ECP applies the mode to the folder and everything inside it unless recursive is false.",
    inputSchema: {
      current_directory: z.string(),
      file_name: z.string(),
      new_permission: z.string(),
      recursive: z
        .boolean()
        .optional()
        .describe(
          "Folders only. false changes just the folder itself; omitted or true also changes every file and subfolder to the same mode (files usually want 644, folders 755). Needs the ECP release after 2.0.6; older ECP ignores false and changes everything.",
        ),
    },
    handler: async (args, client) => client.request("POST", "file-system/change-permission", { body: args }),
  },
  {
    name: "ecp_files_compress",
    description:
      "Compress one or more files/folders (paths relative to current_directory) into an archive in current_directory. Fails if the archive already exists.",
    inputSchema: {
      file_paths: z.array(z.string()),
      output_filename: z.string(),
      current_directory: z.string(),
      format: z.enum(["zip", "tar", "tar.gz", "tar.bz2", "tar.xz"]).optional().describe("Archive format; default zip"),
    },
    handler: async (args, client) =>
      client.request("POST", "file-system/compress", {
        body: {
          filePaths: args.file_paths,
          outputFilename: args.output_filename,
          currentDirectory: args.current_directory,
          ...(args.format ? { format: args.format } : {}),
        },
      }),
  },
  {
    name: "ecp_files_extract",
    description: "Extract an archive (.zip, .tar, .tar.gz/.tgz, .tar.bz2, .tar.xz) into a destination directory.",
    inputSchema: { file_path: z.string(), destination: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/extract", { body: args }),
  },
  {
    name: "ecp_files_delete",
    description: "Delete a single file or folder. Irreversible.",
    inputSchema: { file_path: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "file-system/delete", { body: { file_path: args.file_path } }),
  },
  {
    name: "ecp_files_delete_multiple",
    description: "Delete multiple files/folders. Irreversible.",
    inputSchema: { file_paths: z.array(z.string()), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "file-system/delete-multiple", { body: { file_paths: args.file_paths } }),
  },
];
