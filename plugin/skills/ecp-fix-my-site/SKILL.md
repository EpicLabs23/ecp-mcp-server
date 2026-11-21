---
name: ecp-fix-my-site
description: Diagnoses and fixes a broken or slow website on the user's ECP hosting. Use when the user says "my site is down", "site not loading", "500 error", "502 bad gateway", "white screen", "it's slow", "changes don't show", "I can't log into WordPress", "my app crashed", "not secure warning" or "something broke after I changed X".
---

# Fix a broken site

Read **ecp-assistant** first if it isn't loaded. Work like a calm support engineer: check facts before guessing, change one thing at a time, and tell the user in plain words what you found and what you did.

## 1. Find the site

`ecp_apps_list` (and `ecp_apps_get` for the one they mean). Note its type (WordPress, PHP, static, or a program like Node/Python), its folder and its domain.

## 2. Check the account isn't the problem

- `ecp_resource_status`: suspended, over quota or under pressure?
- `ecp_system_disk_usage`: a full disk breaks uploads, databases and logins. If it's full, see **ecp-files-backups** (clear logs with `ecp_cleanup_log_report` → `ecp_cleanup_log_run`, find large files).
- `ecp_notifications_list` (unread): recent warnings often name the problem.

## 3. Check by site type

**WordPress**
- `ecp_managed_wordpress_status`: is the container running, does the site answer?
- `ecp_managed_wordpress_events`: a recent failed step?
- Changes not showing → `ecp_managed_wordpress_purge_cache`.
- Locked out → `ecp_managed_wordpress_sso_login` (one-time link), or reset with `ecp_managed_wordpress_reset_admin_password` after a yes.
- White screen / error after installing a plugin or theme: find it in `wp-content/plugins` or `wp-content/themes` with `ecp_files_list`, and with the user's OK disable it by renaming its folder (`ecp_files_rename`, e.g. add `.disabled`). Explain this is reversible.
- `ecp_managed_wordpress_security`: integrity or permission findings.

**Program-based app (Node, Python, Go, Ruby…)**
- `ecp_supervisor_list_processes` / `ecp_supervisor_process_info`: is it running or crash-looping?
- `ecp_apps_tail_logs` with the `app_id`: read the last errors and translate them (missing setting, can't reach database, port in use, missing package).
- Fix the cause, then `ecp_apps_deploy_step` `restart` (or `install` then `restart` after missing packages). Re-check the log.
- 502 Bad Gateway usually means the program isn't running or listens on a different port than the domain's port map (`ecp_network_domain_port_maps`).

**PHP / static**
- Check the files are where the domain expects (`ecp_files_list` on the app's folder / web root).
- PHP errors after a version change: compare with `ecp_lsphp_installed_versions` and set an older one via `ecp_apps_update_domain` `php_version` if the app needs it.

**Git apps after an update**
- `ecp_apps_git_info`: what changed, local edits. Rolling back code needs a shell command (`git reset`), so explain and use `ecp_shell_exec` only with their approval.

## 4. Domain and HTTPS

- Site "not found" or someone else's page → the domain doesn't point here: see **ecp-domains-https**.
- "Not secure" or certificate warning → `ecp_ssl_available_certificates` for expiry and covered names; re-issue with `ecp_ssl_request_lets_encrypt` after a yes.

## 5. Database

"Error establishing a database connection" → check the database exists (`ecp_mysql_list_databases`), disk isn't full, and the app's settings file has the right name/user/host (`ecp_files_read` on `wp-config.php` or `.env`; never paste the password back into chat).

## 6. Wrap up

Tell the user: what was wrong (one sentence, no jargon), what you changed, and that the site works now (you checked). If you couldn't fix it, say what you ruled out and suggest the next step, e.g. contacting their host's support with the specific error you found.
