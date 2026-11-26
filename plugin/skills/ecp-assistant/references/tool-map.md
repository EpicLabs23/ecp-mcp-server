# ECP tool map

All tools act on the one hosting account the plugin is logged into. Tools marked ⚠ need `confirm: true`, which you pass only after the user has agreed in plain words.

## Account and health
- `ecp_whoami`: who we're logged in as (connection check).
- `ecp_system_disk_usage`: disk, temp files and database space used vs quota.
- `ecp_resource_status` / `ecp_resource_status_dismiss`: resource pressure or suspension warnings.
- `ecp_resource_bandwidth_usage`: traffic this billing cycle.
- `ecp_notifications_list`, `_mark_read`, `_mark_all_read`, `_delete` ⚠, `_clear_all` ⚠.
- `ecp_system_check_for_update`, `ecp_system_get_config`, `ecp_system_set_config` ⚠, `ecp_system_update` ⚠ (applies an ECP update: rebuilds the account, sites restart; files and databases kept).
- `ecp_system_set_waf` ⚠: web application firewall on/off for all sites. Keep it on.

## Websites and apps
- `ecp_apps_list`, `ecp_apps_get`.
- `ecp_managed_wordpress_install`: complete WordPress site in one call. Then `_status`, `_events` (install progress/failures), `_sso_login` (one-time wp-admin link, open within a minute), `_reset_admin_password` ⚠, `_purge_cache`, `_set_cache_mode`, `_security`, `_set_xmlrpc`.
- From code: `ecp_apps_create_from_git` or `ecp_apps_create_from_upload`, then `ecp_apps_detect` (what the app is and how to run it), `ecp_asdf_recommend` / `ecp_asdf_install` ⚠ (language runtime), `ecp_apps_deploy_step` (configure/install/build/start/stop/restart), `ecp_apps_update_domain` or `ecp_apps_update_static_domain`, `ecp_network_update_port_maps` (connect a running app to its web address).
- `ecp_apps_tail_logs`, `ecp_apps_flush_logs`: the app program's own log.
- Git apps: `ecp_apps_git_info`, `ecp_apps_git_pull` (⚠ when discarding edits), `ecp_apps_git_save_credential`, `ecp_apps_git_delete_credential` ⚠.
- Git providers: `ecp_git_list_providers`, `ecp_git_authorize_url` (user opens link), `ecp_git_list_connections`, `ecp_git_list_repos`, `ecp_git_disconnect_provider` ⚠.
- Auto-deploy on push: `ecp_git_webhook_get/create ⚠/update ⚠/delete ⚠/rotate_secret ⚠/capabilities/deliveries`.
- `ecp_apps_delete` ⚠: removes the app and its files.
- PHP: `ecp_lsphp_installed_versions`, then `ecp_apps_update_domain` with `php_version`.
- Moving from cPanel: `ecp_cpanel_discover`, `ecp_cpanel_import_start` ⚠, `ecp_cpanel_import_status`.

## Domains, DNS, HTTPS
- `ecp_domains_list_all`, `ecp_domains_list_additional`, `ecp_domains_add_domain`, `ecp_domains_add_subdomain`, `ecp_domains_delete` ⚠.
- `ecp_domains_set_redirect`, `ecp_domains_remove_redirect`.
- `ecp_dns_list_records`, `ecp_dns_add_record`, `ecp_dns_delete_record` ⚠.
- `ecp_dns_claim_status`, `ecp_dns_claim_request`, `ecp_dns_claim_verify`: take over a domain's DNS zone held by another install.
- `ecp_ssl_request_lets_encrypt` ⚠ (free HTTPS, the usual choice), `ecp_ssl_available_certificates` (what's installed, expiry), `ecp_ssl_upload_certificate` ⚠ (a bought certificate), self-signed variants (testing only).
- `ecp_network_port_maps`, `ecp_network_domain_port_maps`.

## Files
- `ecp_files_list`, `ecp_files_directory_tree`, `ecp_files_read`, `ecp_files_write` ⚠, `ecp_files_upload` (a file from the user's computer, any size), `ecp_files_add_file`, `ecp_files_add_folder`, `ecp_files_rename`, `ecp_files_copy(_multiple)`, `ecp_files_move(_multiple)`, `ecp_files_delete(_multiple)` ⚠, `ecp_files_change_permission`, `ecp_files_compress`, `ecp_files_extract`, `ecp_files_upload_limit`.
- Home folder is `/home/<username>`; apps live in `~/apps/<folder>`.

## Databases
- `ecp_db_services_status` (which engines are available), `ecp_db_connection_info` (host/port for app settings).
- MySQL/MariaDB (always available): `ecp_mysql_*` create/list/delete ⚠ databases and users, privileges, sizes, browse/insert/update/delete rows, export, import ⚠, `backup_to_storage_bd`, `restore_from_storage_bd` ⚠.
- PostgreSQL `ecp_postgres_*`, MongoDB `ecp_mongo_*`, MSSQL `ecp_mssql_*`: same shape where the engine is enabled.

## Backups
- `ecp_storage_bd_get_config`, `ecp_storage_bd_set_config` ⚠, `ecp_storage_bd_job_status`: storage.bd off-site backup space.
- `ecp_backup_list_snapshots`: local file snapshots (list only; restoring is in the panel).

## Background programs and schedules
- `ecp_supervisor_list_processes`, `_process_info`, `_start/_stop/_restart_process`, `_add_process`, `_remove_process` ⚠.
- `ecp_crontab_list`, `ecp_crontab_add` ⚠, `ecp_crontab_remove` ⚠ (5-field schedule, e.g. `0 3 * * *` = 3am daily).
- Language runtimes: `ecp_asdf_*`.
- Log space: `ecp_cleanup_log_report` (dry run), `ecp_cleanup_log_run` ⚠.

## Last resort
- `ecp_shell_exec`: one non-interactive command, user approves each one. Only when no tool above fits.
