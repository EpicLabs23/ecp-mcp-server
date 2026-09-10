import { makeSqlEngineTools } from "./sql-engine-factory.js";

export const mssqlTools = makeSqlEngineTools({
  key: "mssql",
  label: "MSSQL",
  routePrefix: "database/mssql",
  createDatabaseNeedsPassword: true,
  hasExportImport: false,
  // Exact allowlist from ehm-api's MSSQL_GRANTABLE_TABLE_PERMISSIONS.
  grantablePrivileges: ["SELECT", "INSERT", "UPDATE", "DELETE", "REFERENCES"],
  privilegeScopeNote:
    "Note: MSSQL's privilege model here is coarser than MySQL/Postgres - only these 5 DML permissions, applied schema-wide (SCHEMA::dbo), not per-table.",
});

export const postgresTools = makeSqlEngineTools({
  key: "postgres",
  label: "Postgres",
  routePrefix: "database/postgres",
  createDatabaseNeedsPassword: false,
  hasExportImport: true,
  // Exact allowlist from ehm-api's POSTGRES_GRANTABLE_TABLE_PRIVILEGES.
  grantablePrivileges: ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"],
  privilegeScopeNote: "Applied per-table (all tables in the public schema) plus default privileges for future tables.",
});
