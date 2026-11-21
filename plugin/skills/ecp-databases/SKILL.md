---
name: ecp-databases
description: Creates, inspects, backs up and restores databases on the user's ECP hosting (MySQL/MariaDB, PostgreSQL, MongoDB, MSSQL). Use when the user says "create a database", "my app needs a database", "database password", "look at my data", "change a record", "export/import my database", "back up my database", "restore my database", or "database is too big".
---

# Databases

Read **ecp-assistant** first if it isn't loaded.

## Which engine

MySQL/MariaDB is always available and is what WordPress and most PHP apps use; default to it. Others only when the app needs them: check `ecp_db_services_status` first (PostgreSQL, MongoDB, MSSQL may be off or unreachable). Tools follow the same pattern per engine: `ecp_mysql_*`, `ecp_postgres_*`, `ecp_mongo_*`, `ecp_mssql_*`.

## Create a database for an app

1. Pick short lowercase names; ECP adds the account prefix automatically. Generate a strong password.
2. `ecp_mysql_create_db_user` (name + password), then `ecp_mysql_create_database` with that user.
3. Give the app the details: `ecp_db_connection_info` for host and port. Write them into the app's settings file if the user wants (show what you'll write first). Report the database name and user; give the password once.

## Look at or change data

- Size overview: `ecp_mysql_database_sizes`, `ecp_mysql_table_sizes`.
- Structure: `ecp_mysql_list_columns`.
- Browsing rows needs a database user and its password (`ecp_mysql_browse_rows`). If the user doesn't have it, it's often in the app's settings file (`wp-config.php` / `.env`); read it with `ecp_files_read` and use it without repeating it in chat.
- Changing or deleting rows: show the exact row and change in plain words, get a yes, then `ecp_mysql_update_row` / `ecp_mysql_delete_row` with `confirm: true`. For more than a handful of rows, back up first.
- Emptying or deleting a table or database is permanent: back up first, say what's lost, get a yes.

## Backups

- **Off-site (storage.bd)**: `ecp_storage_bd_get_config`. If it isn't set up, the user creates a Space in their storage.bd dashboard and gives you the Space ID, access key ID and secret key; save them with `ecp_storage_bd_set_config` (after a yes). Then `ecp_mysql_backup_to_storage_bd`; check progress with `ecp_storage_bd_job_status`.
- **Restore**: `ecp_mysql_restore_from_storage_bd` overwrites the current data. Take a fresh backup first, confirm the snapshot date with the user, get a yes.
- **Quick copy**: `ecp_mysql_export_database` returns SQL text; fine for small databases only. For large ones use storage.bd.
- **Import** (`ecp_mysql_import_database`) overwrites the database. The SQL size limit is `ecp_files_upload_limit`; bigger files should be uploaded in the ECP panel.

## Users and permissions

- `ecp_mysql_list_db_users`, `ecp_mysql_list_privileges`. Grant only what the app needs (`SELECT, INSERT, UPDATE, DELETE` covers most apps); explain before granting more.
- Changing a database user's password isn't a separate tool for MySQL: create a new user, switch the database to it (`ecp_mysql_change_db_user`), update the app's settings, then delete the old user after a yes. For MongoDB use `ecp_mongo_update_user_password`.
