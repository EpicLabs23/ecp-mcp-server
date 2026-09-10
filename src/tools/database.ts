import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/database.go (MySQL + engine-agnostic status/connection-info)
// and the MySQL-user/privilege portion of router/database.go that proxies to
// ehm-api's mysql.controller.ts. db_name you pass is NOT pre-prefixed -
// ehm-api applies the account's own a<id>_ prefix server-side.
//
// createBackup (ehm-api's ecp/database/createBackup) is intentionally NOT
// exposed - ecp-go's own router/database.go never calls it either (ecp-ui
// doesn't use it), so per the "match the real client's own surface"
// architecture rule, it's not part of this MCP server either.

// Matches MYSQL_GRANTABLE_PRIVILEGES in ehm-api's mysql-identifier.util.ts
// exactly - ehm-api validates this server-side too, but constraining it
// here as well means a bad value fails fast in the tool schema instead of
// round-tripping to the server first, and the AI sees the real option list
// instead of guessing at free-form strings.
const MYSQL_PRIVILEGES = [
  "SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "INDEX",
  "REFERENCES", "CREATE TEMPORARY TABLES", "LOCK TABLES", "EXECUTE",
  "CREATE VIEW", "SHOW VIEW", "CREATE ROUTINE", "ALTER ROUTINE", "EVENT", "TRIGGER",
] as const;

const privilegesShape = {
  db_name: z.string(),
  db_username: z.string(),
  privileges: z.array(z.enum(MYSQL_PRIVILEGES)),
};
const rowCredsShape = { db_name: z.string(), table_name: z.string(), db_username: z.string(), password: z.string() };

export const databaseTools: ToolDef[] = [
  {
    name: "ecp_db_services_status",
    description: "Check whether Postgres/MSSQL/Mongo are enabled/configured/reachable for this account (MySQL is always available - it's EHM's own DB engine, not an optional one).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "database/services-status"),
  },
  {
    name: "ecp_db_connection_info",
    description: "Get the static host/port connection info for each database engine, for apps running in this account's own container.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "database/connection-info"),
  },
  {
    name: "ecp_mysql_create_database",
    description: "Create a MySQL database. db_name gets the account's own prefix applied automatically.",
    inputSchema: { db_name: z.string(), db_username: z.string().optional() },
    handler: async (args, client) => client.request("POST", "database/createMySqlDatabase", { body: args }),
  },
  {
    name: "ecp_mysql_delete_database",
    description: "Delete a MySQL database. Irreversible.",
    inputSchema: { db_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/deleteMySqlDatabase", { body: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mysql_list_databases",
    description: "List this account's MySQL databases.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "database/getMySqlDatabases"),
  },
  {
    name: "ecp_mysql_database_sizes",
    description: "Get size (in bytes) of each MySQL database.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "database/getDatabaseSizes"),
  },
  {
    name: "ecp_mysql_table_sizes",
    description: "Get size of each table in a MySQL database.",
    inputSchema: { db_name: z.string() },
    handler: async (args, client) => client.request("GET", "database/getTableSizes", { query: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mysql_list_columns",
    description: "List a table's columns (metadata only, no row data).",
    inputSchema: { db_name: z.string(), table_name: z.string() },
    handler: async (args, client) =>
      client.request("GET", "database/listColumns", { query: { db_name: args.db_name, table_name: args.table_name } }),
  },
  {
    name: "ecp_mysql_truncate_table",
    description: "Delete all rows from a table. Irreversible.",
    inputSchema: { db_name: z.string(), table_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "database/truncateTable", { body: { db_name: args.db_name, table_name: args.table_name } }),
  },
  {
    name: "ecp_mysql_drop_table",
    description: "Drop (delete) a table entirely. Irreversible.",
    inputSchema: { db_name: z.string(), table_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "database/dropTable", { body: { db_name: args.db_name, table_name: args.table_name } }),
  },
  {
    name: "ecp_mysql_browse_rows",
    description: "Browse rows in a table. Connects as the given MySQL user (db_username/password), which must be a user this account owns.",
    inputSchema: {
      ...rowCredsShape,
      page: z.number().optional(),
      page_size: z.number().optional(),
      sort_column: z.string().optional(),
      sort_direction: z.enum(["asc", "desc"]).optional(),
      filters: z.record(z.string(), z.unknown()).optional(),
    },
    handler: async (args, client) => client.request("POST", "database/browseRows", { body: args }),
  },
  {
    name: "ecp_mysql_insert_row",
    description: "Insert a row into a table.",
    inputSchema: { ...rowCredsShape, values: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/insertRow", { body: args }),
  },
  {
    name: "ecp_mysql_update_row",
    description: "Update a row in a table, identified by primary_key.",
    inputSchema: {
      ...rowCredsShape,
      primary_key: z.record(z.string(), z.unknown()),
      values: z.record(z.string(), z.unknown()),
      confirm: z.literal(true),
    },
    handler: async (args, client) => client.request("POST", "database/updateRow", { body: args }),
  },
  {
    name: "ecp_mysql_delete_row",
    description: "Delete a row from a table, identified by primary_key. Irreversible.",
    inputSchema: { ...rowCredsShape, primary_key: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/deleteRow", { body: args }),
  },
  {
    name: "ecp_mysql_export_database",
    description: "Export a MySQL database as a .sql dump (returned as text - large databases will produce a large result, consider ecp_mysql_backup_to_storage_bd instead for anything beyond a quick look).",
    inputSchema: { db_name: z.string() },
    handler: async (args, client) => client.request("GET", "database/exportDatabase", { query: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mysql_import_database",
    description: "Import a .sql dump into an existing MySQL database, overwriting its content. Irreversible - pass the full SQL as text.",
    inputSchema: { db_name: z.string(), sql_content: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.requestMultipart(
        "database/importDatabase",
        { db_name: args.db_name },
        {
          fieldName: "file",
          fileName: `${args.db_name}.sql`,
          content: String(args.sql_content),
          contentType: "application/sql",
        },
      ),
  },
  {
    name: "ecp_mysql_backup_to_storage_bd",
    description: "Back up a MySQL database to the account's storage.bd tenant.",
    inputSchema: { db_name: z.string() },
    handler: async (args, client) => client.request("POST", "database/backup-to-storage-bd", { body: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mysql_restore_from_storage_bd",
    description: "Restore a MySQL database from a storage.bd snapshot, overwriting its current content. Irreversible.",
    inputSchema: { db_name: z.string(), snapshot_id: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "database/restore-from-storage-bd", {
        body: { db_name: args.db_name, snapshot_id: args.snapshot_id },
      }),
  },

  // MySQL additional users + privileges (mysql.controller.ts, proxied via database.go)
  {
    name: "ecp_mysql_list_db_users",
    description: "List additional MySQL users on this account (beyond the account's own default user).",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "database/getDbUserList"),
  },
  {
    name: "ecp_mysql_create_db_user",
    description: "Create an additional MySQL user. db_username gets the account's own prefix applied automatically.",
    inputSchema: { db_username: z.string(), password: z.string() },
    handler: async (args, client) => client.request("POST", "database/createMySqlDbUser", { body: args }),
  },
  {
    name: "ecp_mysql_delete_db_user",
    description: "Delete an additional MySQL user. Irreversible.",
    inputSchema: { db_username: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/deleteDbUser", { body: { db_username: args.db_username } }),
  },
  {
    name: "ecp_mysql_change_db_user",
    description: "Reassign a database to be owned by a different MySQL user (both must already belong to this account).",
    inputSchema: { db_name: z.string(), db_username: z.string() },
    handler: async (args, client) => client.request("POST", "database/changeDbUser", { body: args }),
  },
  {
    name: "ecp_mysql_list_privileges",
    description: "List a MySQL user's privileges on a database.",
    inputSchema: { db_name: z.string(), db_username: z.string() },
    handler: async (args, client) => client.request("GET", "database/listPrivileges", { query: args }),
  },
  {
    name: "ecp_mysql_grant_privileges",
    description: "Grant privileges (e.g. ['SELECT','INSERT']) to a MySQL user on a database. Security-sensitive - review carefully before confirming.",
    inputSchema: { ...privilegesShape, confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/grantPrivileges", { body: args }),
  },
  {
    name: "ecp_mysql_revoke_privileges",
    description: "Revoke privileges from a MySQL user on a database.",
    inputSchema: { ...privilegesShape, confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "database/revokePrivileges", { body: args }),
  },
];
