import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/mongodb.go -> ehm-api's ecp-mongodb controller. Document-
// shaped (collections/documents), not table/row-shaped like the other three
// engines, so it's hand-written rather than run through sql-engine-factory.
//
// exportDatabase/importDatabase are NOT exposed: Mongo's dump format is a
// binary .archive (application/octet-stream), unlike the other engines'
// plain-text .sql - doesn't fit an MCP tool response/input well, same
// reasoning as the file-system direct-download/upload punt. Use
// ecp_mongo_backup_to_storage_bd / restore_from_storage_bd instead.

const rowCredsShape = { db_name: z.string(), collection_name: z.string(), db_username: z.string(), password: z.string() };

export const mongodbTools: ToolDef[] = [
  {
    name: "ecp_mongo_create_database",
    description: "Create a MongoDB database. db_name gets the account's own prefix applied automatically. db_username must already exist (see ecp_mongo_create_user).",
    inputSchema: { db_name: z.string(), db_username: z.string() },
    handler: async (args, client) => client.request("POST", "mongodb/createDatabase", { body: args }),
  },
  {
    name: "ecp_mongo_delete_database",
    description: "Delete a MongoDB database. Irreversible.",
    inputSchema: { db_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/deleteDatabase", { body: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mongo_list_databases",
    description: "List this account's MongoDB databases.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "mongodb/getDatabaseByUser"),
  },
  {
    name: "ecp_mongo_database_sizes",
    description: "Get size of each MongoDB database.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "mongodb/getDatabaseSizes"),
  },
  {
    name: "ecp_mongo_list_collections",
    description: "List collections in a database (metadata only, no document data).",
    inputSchema: { db_name: z.string() },
    handler: async (args, client) => client.request("GET", "mongodb/listCollections", { query: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mongo_create_collection",
    description: "Create a collection in a database.",
    inputSchema: { db_name: z.string(), collection_name: z.string() },
    handler: async (args, client) => client.request("POST", "mongodb/createCollection", { body: args }),
  },
  {
    name: "ecp_mongo_drop_collection",
    description: "Drop (delete) a collection entirely. Irreversible.",
    inputSchema: { db_name: z.string(), collection_name: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "mongodb/dropCollection", { body: { db_name: args.db_name, collection_name: args.collection_name } }),
  },
  {
    name: "ecp_mongo_browse_documents",
    description: "Browse documents in a collection. Connects as the given db_username/password, which must be a user this account owns.",
    inputSchema: {
      ...rowCredsShape,
      page: z.number().optional(),
      page_size: z.number().optional(),
      sort_field: z.string().optional(),
      sort_direction: z.enum(["asc", "desc"]).optional(),
      filter: z.record(z.string(), z.unknown()).optional(),
    },
    handler: async (args, client) => client.request("POST", "mongodb/browseDocuments", { body: args }),
  },
  {
    name: "ecp_mongo_insert_document",
    description: "Insert a document into a collection.",
    inputSchema: { ...rowCredsShape, document: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/insertDocument", { body: args }),
  },
  {
    name: "ecp_mongo_update_document",
    description: "Update a document, identified by id.",
    inputSchema: { ...rowCredsShape, id: z.string(), values: z.record(z.string(), z.unknown()), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/updateDocument", { body: args }),
  },
  {
    name: "ecp_mongo_delete_document",
    description: "Delete a document, identified by id. Irreversible.",
    inputSchema: { ...rowCredsShape, id: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/deleteDocument", { body: args }),
  },
  {
    name: "ecp_mongo_backup_to_storage_bd",
    description: "Back up a MongoDB database to the account's storage.bd tenant.",
    inputSchema: { db_name: z.string() },
    handler: async (args, client) => client.request("POST", "mongodb/backup-to-storage-bd", { body: { db_name: args.db_name } }),
  },
  {
    name: "ecp_mongo_restore_from_storage_bd",
    description: "Restore a MongoDB database from a storage.bd snapshot, overwriting its current content. Irreversible.",
    inputSchema: { db_name: z.string(), snapshot_id: z.string(), confirm: z.literal(true) },
    handler: async (args, client) =>
      client.request("POST", "mongodb/restore-from-storage-bd", { body: { db_name: args.db_name, snapshot_id: args.snapshot_id } }),
  },

  // Users
  {
    name: "ecp_mongo_list_users",
    description: "List additional MongoDB users on this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "mongodb/getUserList"),
  },
  {
    name: "ecp_mongo_create_user",
    description: "Create a MongoDB user. db_username gets the account's own prefix applied automatically. Grants readWrite on this account's default database - MongoDB here has no read-only role option, unlike MySQL/Postgres's granular privilege grants.",
    inputSchema: { db_username: z.string(), password: z.string() },
    handler: async (args, client) => client.request("POST", "mongodb/create-user", { body: args }),
  },
  {
    name: "ecp_mongo_delete_user",
    description: "Delete a MongoDB user. Irreversible.",
    inputSchema: { db_username: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/deleteUser", { body: { db_username: args.db_username } }),
  },
  {
    name: "ecp_mongo_update_user_password",
    description: "Change a MongoDB user's password.",
    inputSchema: { db_username: z.string(), password: z.string() },
    handler: async (args, client) => client.request("POST", "mongodb/updateUserPassword", { body: args }),
  },
  {
    name: "ecp_mongo_assign_user_to_database",
    description: "Grant a MongoDB user readWrite access to a database (both must already belong to this account). MongoDB only supports whole-database readWrite here - no read-only or per-collection grants like MySQL/Postgres. Security-sensitive - review carefully before confirming.",
    inputSchema: { db_name: z.string(), db_username: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "mongodb/assignUserToDatabase", { body: args }),
  },
];

// There is no ecp_mongo_grant_new_db tool: the endpoint it would have
// wrapped (ehm-api's mongodb/grantNewDb) had no caller anywhere in ecp-ui or
// ecp-go, used a mismatched {username, dbname} body shape, and skipped the
// identifier validation its sibling assignUserToDatabase applies - it was
// removed from ehm-api and ecp-go entirely rather than left as dead/unsafe
// code. assignUserToDatabase above is the one real way to grant access.
