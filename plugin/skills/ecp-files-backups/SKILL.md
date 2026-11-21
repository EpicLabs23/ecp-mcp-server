---
name: ecp-files-backups
description: Manages the files on the user's ECP hosting and their backups. Use when the user says "show my files", "edit my site's file", "change a setting in wp-config/.env", "zip/unzip", "move or rename files", "delete old files", "free up space", "disk is full", "fix permissions", "back up my site" or "restore from a backup".
---

# Files and backups

Read **ecp-assistant** first if it isn't loaded.

## Finding your way

- The account's home is `/home/<username>` (`ecp_whoami` gives the username). Apps live in `~/apps/<folder>`; `ecp_apps_get` shows an app's folder.
- `ecp_files_list` for one folder, `ecp_files_directory_tree` to explore. Describe what's there in plain words; don't dump long listings.

## Editing a file

1. `ecp_files_read` it first and show the relevant part.
2. Explain the change and keep a copy: `ecp_files_copy` to `<name>.bak` in the same folder.
3. `ecp_files_write` the whole new content with `confirm: true` after the user's yes. Never drop parts of the file you didn't mean to change.
4. Settings files (`.env`, `wp-config.php`) usually need the app restarted to take effect (`ecp_apps_deploy_step` `restart` for program-based apps).
5. Don't echo passwords or keys from these files back into chat.

## Uploading and downloading

Chat can create and edit text files. For big files, images or zips from the user's computer, send them to the File Manager in the ECP panel in the browser (port 2323 of their domain), then continue here (e.g. `ecp_files_extract` an uploaded zip). `ecp_files_upload_limit` gives the largest upload allowed.

## Organising

- `ecp_files_add_folder`, `ecp_files_add_file`, `ecp_files_rename`, `ecp_files_copy(_multiple)`, `ecp_files_move(_multiple)`.
- `ecp_files_compress` (zip by default; tar/tar.gz also) and `ecp_files_extract`.
- Permissions: files `644`, folders `755` is the safe normal. Never set `777`; if an app "needs" it, the real fix is elsewhere. For a folder, `recursive: false` changes only the folder itself.
- Deleting is permanent (`ecp_files_delete`, `_multiple`): list exactly what will go, get a yes. Offer to compress into an archive first if they might need it.

## Disk full / free up space

1. `ecp_system_disk_usage` for the big picture (files vs databases vs temp files).
2. Logs: `ecp_cleanup_log_report` (changes nothing) → show the biggest, then `ecp_cleanup_log_run` with the chosen ids after a yes.
3. Look for large leftovers in app folders: old zips, backups, `node_modules` of deleted apps, cache folders. Propose specific items with sizes; delete only what the user agrees to.
4. Large databases: see **ecp-databases** (table sizes).

## Backups

- **Off-site database backups (storage.bd)** are available from chat: see **ecp-databases**.
- **Local file snapshots**: `ecp_backup_list_snapshots` shows which exist and when. Starting a file backup or restoring one isn't possible from chat; send the user to the Backups page in the ECP panel.
- Before a risky change to a site, a quick safety copy works from chat: `ecp_files_compress` the site folder into an archive with the date in its name.
