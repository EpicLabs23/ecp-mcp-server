import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/file-system.go + router/code-editory.go - real local
// filesystem access on the account's own container, with no EHM-API
// equivalent at all. Genuinely useful ("show me this app's .env", "fix this
// config") and genuinely capable of damaging a live site, so every
// destructive op (delete, overwrite, move) requires confirm: true.
//
// direct-download and upload-recursive are intentionally NOT exposed here:
// both move raw binary bytes, which doesn't fit an MCP tool response well
// (same reasoning as the DB import/export punt in the plan) - revisit later
// if there's a concrete need.

export const filesTools: ToolDef[] = [
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
    description: "Overwrite a text file's content (creates it if it doesn't exist). Can break a running app if it's a config/env/source file - review the current content first.",
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
    description: "chmod a file (e.g. new_permission: '644').",
    inputSchema: { current_directory: z.string(), file_name: z.string(), new_permission: z.string() },
    handler: async (args, client) => client.request("POST", "file-system/change-permission", { body: args }),
  },
  {
    name: "ecp_files_compress",
    description: "Compress one or more files/folders into an archive.",
    inputSchema: {
      file_paths: z.array(z.string()),
      output_filename: z.string(),
      current_directory: z.string(),
    },
    handler: async (args, client) =>
      client.request("POST", "file-system/compress", {
        body: {
          filePaths: args.file_paths,
          outputFilename: args.output_filename,
          currentDirectory: args.current_directory,
        },
      }),
  },
  {
    name: "ecp_files_extract",
    description: "Extract an archive into a destination directory.",
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
