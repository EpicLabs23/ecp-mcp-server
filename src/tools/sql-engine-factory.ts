import { z } from "zod";
import type { ToolDef } from "./types.js";

// Generates the tool set for MSSQL and Postgres - router/mssql.go and
// router/postgres.go proxy to ehm-api's ecp-mssql/ecp-postgresql controllers,
// which share MySQL's shape (db/user CRUD, privileges, row browsing) closely
// enough to generate from one config, with the real per-engine differences
// captured explicitly rather than papered over:
//
// - MSSQL's createDatabase creates the login together with the database
//   (needs a password); Postgres's (like MySQL's) expects db_username to
//   already exist via createDatabaseUser first.
// - Postgres's ecp-go router proxies a changeDbUser route to an EHM endpoint
//   that doesn't actually exist on the controller (dead route, confirmed by
//   reading ecp-postgresql.controller.ts - only changeDatabaseOwner is
//   real) - so neither engine gets a changeDbUser tool, only
//   changeDatabaseOwner, which both genuinely have.
// - MSSQL has no exportDatabase/importDatabase route in ecp-go at all
//   (ecp-ui never wired it up) - Postgres does, and its dump is plain-text
//   .sql like MySQL's, so it's handled the same way (returned/uploaded as
//   text, no binary handling needed).

export interface SqlEngineConfig {
  key: string; // e.g. "mssql", "postgres" - used in tool names: ecp_<key>_...
  label: string; // human-readable, e.g. "MSSQL", "Postgres"
  routePrefix: string; // e.g. "database/mssql"
  createDatabaseNeedsPassword: boolean;
  hasExportImport: boolean;
  // Exact allowlist ehm-api validates server-side (mssql-identifier.util.ts /
  // postgres-identifier.util.ts) - mirrored here so a bad value fails fast
  // in the tool schema and the AI sees real options instead of guessing.
  // MSSQL's is deliberately narrower (5 items, schema-wide) than Postgres's
  // (7, per-table) or MySQL's (17) - a real engine limitation, not an
  // oversight, so it's surfaced in the tool description below rather than
  // silently offering the same shape for every engine.
  grantablePrivileges: readonly [string, ...string[]];
  privilegeScopeNote: string;
}

const rowCredsShape = { db_name: z.string(), table_name: z.string(), db_username: z.string(), password: z.string() };

export function makeSqlEngineTools(cfg: SqlEngineConfig): ToolDef[] {
  const p = (path: string) => `${cfg.routePrefix}/${path}`;
  const name = (suffix: string) => `ecp_${cfg.key}_${suffix}`;
  const privilegesShape = {
    db_name: z.string(),
    db_username: z.string(),
    privileges: z.array(z.enum(cfg.grantablePrivileges)),
  };

  const createDatabaseSchema = {
    db_name: z.string(),
    db_username: z.string(),
    ...(cfg.createDatabaseNeedsPassword ? { password: z.string() } : {}),
  };

  const tools: ToolDef[] = [
    {
      name: name("create_database"),
      description: `Create a ${cfg.label} database. db_name gets the account's own prefix applied automatically.${cfg.createDatabaseNeedsPassword ? " Creates the login together with the database." : " db_username must already exist (see " + name("create_database_user") + ")."}`,
      inputSchema: createDatabaseSchema,
      handler: async (args, client) => client.request("POST", p("createDatabase"), { body: args }),
    },
    {
      name: name("delete_database"),
      description: `Delete a ${cfg.label} database. Irreversible.`,
      inputSchema: { db_name: z.string(), confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("deleteDatabase"), { body: { db_name: args.db_name } }),
    },
    {
      name: name("list_databases"),
      description: `List this account's ${cfg.label} databases.`,
      inputSchema: {},
      handler: async (_args, client) => client.request("GET", p("getDatabaseByUser")),
    },
    {
      name: name("database_sizes"),
      description: `Get size of each ${cfg.label} database.`,
      inputSchema: {},
      handler: async (_args, client) => client.request("GET", p("getDatabaseSizes")),
    },
    {
      name: name("table_sizes"),
      description: `Get size of each table in a ${cfg.label} database.`,
      inputSchema: { db_name: z.string() },
      handler: async (args, client) => client.request("GET", p("getTableSizes"), { query: { db_name: args.db_name } }),
    },
    {
      name: name("list_columns"),
      description: "List a table's columns (metadata only, no row data).",
      inputSchema: { db_name: z.string(), table_name: z.string() },
      handler: async (args, client) =>
        client.request("GET", p("listColumns"), { query: { db_name: args.db_name, table_name: args.table_name } }),
    },
    {
      name: name("truncate_table"),
      description: "Delete all rows from a table. Irreversible.",
      inputSchema: { db_name: z.string(), table_name: z.string(), confirm: z.literal(true) },
      handler: async (args, client) =>
        client.request("POST", p("truncateTable"), { body: { db_name: args.db_name, table_name: args.table_name } }),
    },
    {
      name: name("drop_table"),
      description: "Drop (delete) a table entirely. Irreversible.",
      inputSchema: { db_name: z.string(), table_name: z.string(), confirm: z.literal(true) },
      handler: async (args, client) =>
        client.request("POST", p("dropTable"), { body: { db_name: args.db_name, table_name: args.table_name } }),
    },
    {
      name: name("browse_rows"),
      description: "Browse rows in a table. Connects as the given db_username/password, which must be a user this account owns.",
      inputSchema: {
        ...rowCredsShape,
        page: z.number().optional(),
        page_size: z.number().optional(),
        sort_column: z.string().optional(),
        sort_direction: z.enum(["asc", "desc"]).optional(),
        filters: z.record(z.string(), z.unknown()).optional(),
      },
      handler: async (args, client) => client.request("POST", p("browseRows"), { body: args }),
    },
    {
      name: name("insert_row"),
      description: "Insert a row into a table.",
      inputSchema: { ...rowCredsShape, values: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("insertRow"), { body: args }),
    },
    {
      name: name("update_row"),
      description: "Update a row in a table, identified by primary_key.",
      inputSchema: {
        ...rowCredsShape,
        primary_key: z.record(z.string(), z.unknown()),
        values: z.record(z.string(), z.unknown()),
        confirm: z.literal(true),
      },
      handler: async (args, client) => client.request("POST", p("updateRow"), { body: args }),
    },
    {
      name: name("delete_row"),
      description: "Delete a row from a table, identified by primary_key. Irreversible.",
      inputSchema: { ...rowCredsShape, primary_key: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("deleteRow"), { body: args }),
    },
    {
      name: name("backup_to_storage_bd"),
      description: `Back up a ${cfg.label} database to the account's storage.bd tenant.`,
      inputSchema: { db_name: z.string() },
      handler: async (args, client) => client.request("POST", p("backup-to-storage-bd"), { body: { db_name: args.db_name } }),
    },
    {
      name: name("restore_from_storage_bd"),
      description: `Restore a ${cfg.label} database from a storage.bd snapshot, overwriting its current content. Irreversible.`,
      inputSchema: { db_name: z.string(), snapshot_id: z.string(), confirm: z.literal(true) },
      handler: async (args, client) =>
        client.request("POST", p("restore-from-storage-bd"), {
          body: { db_name: args.db_name, snapshot_id: args.snapshot_id },
        }),
    },
    {
      name: name("list_db_users"),
      description: `List additional ${cfg.label} users on this account.`,
      inputSchema: {},
      handler: async (_args, client) => client.request("GET", p("getDbUserList")),
    },
    {
      name: name("create_database_user"),
      description: `Create an additional ${cfg.label} user. db_username gets the account's own prefix applied automatically.`,
      inputSchema: { db_username: z.string(), password: z.string() },
      handler: async (args, client) => client.request("POST", p("createDatabaseUser"), { body: args }),
    },
    {
      name: name("delete_user"),
      description: `Delete a ${cfg.label} user. Irreversible.`,
      inputSchema: { db_username: z.string(), confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("deleteUser"), { body: { db_username: args.db_username } }),
    },
    {
      name: name("change_database_owner"),
      description: "Change a database's owning user (both must already belong to this account).",
      inputSchema: { db_name: z.string(), db_username: z.string() },
      handler: async (args, client) => client.request("POST", p("changeDatabaseOwner"), { body: args }),
    },
    {
      name: name("list_privileges"),
      description: `List a ${cfg.label} user's privileges on a database. ${cfg.privilegeScopeNote}`,
      inputSchema: { db_name: z.string(), db_username: z.string() },
      handler: async (args, client) => client.request("GET", p("listPrivileges"), { query: args }),
    },
    {
      name: name("grant_privileges"),
      description: `Grant privileges to a user on a database. ${cfg.privilegeScopeNote} Security-sensitive - review carefully before confirming.`,
      inputSchema: { ...privilegesShape, confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("grantPrivileges"), { body: args }),
    },
    {
      name: name("revoke_privileges"),
      description: `Revoke privileges from a user on a database. ${cfg.privilegeScopeNote}`,
      inputSchema: { ...privilegesShape, confirm: z.literal(true) },
      handler: async (args, client) => client.request("POST", p("revokePrivileges"), { body: args }),
    },
  ];

  if (cfg.hasExportImport) {
    tools.push(
      {
        name: name("export_database"),
        description: `Export a ${cfg.label} database as a .sql dump (returned as text - large databases will produce a large result, consider ${name("backup_to_storage_bd")} instead for anything beyond a quick look).`,
        inputSchema: { db_name: z.string() },
        handler: async (args, client) => client.request("GET", p("exportDatabase"), { query: { db_name: args.db_name } }),
      },
      {
        name: name("import_database"),
        description: `Import a .sql dump into an existing ${cfg.label} database, overwriting its content. Irreversible - pass the full SQL as text.`,
        inputSchema: { db_name: z.string(), sql_content: z.string(), confirm: z.literal(true) },
        handler: async (args, client) =>
          client.requestMultipart(
            p("importDatabase"),
            { db_name: args.db_name },
            {
              fieldName: "file",
              fileName: `${args.db_name}.sql`,
              content: String(args.sql_content),
              contentType: "application/sql",
            },
          ),
      },
    );
  }

  return tools;
}
