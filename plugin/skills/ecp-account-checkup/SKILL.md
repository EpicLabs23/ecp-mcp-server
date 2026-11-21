---
name: ecp-account-checkup
description: Gives a plain-language health check of the user's ECP hosting account and handles routine upkeep. Use when the user says "how's my hosting", "check my account", "what's on my server", "how much space/bandwidth am I using", "any problems?", "notifications", "is there an update", "run something every night", "schedule a task", or "update ECP".
---

# Account checkup and upkeep

Read **ecp-assistant** first if it isn't loaded.

## Health check

Gather these (they're all read-only), then report in a short summary, problems first:

1. `ecp_whoami`: account and main domain.
2. `ecp_resource_status`: any warning or suspension risk.
3. `ecp_system_disk_usage`: space used vs allowed, as "X of Y GB (Z%)".
4. `ecp_resource_bandwidth_usage`: traffic this cycle vs limit (skip if not tracked).
5. `ecp_apps_list` and, for WordPress sites, `ecp_managed_wordpress_status`: each site and whether it's up.
6. `ecp_domains_list_all` and for each site domain `ecp_ssl_available_certificates` (`lets_encrypt`): HTTPS present and its expiry. Flag anything expiring within 21 days and offer to renew it (`ecp_ssl_request_lets_encrypt`, after a yes).
7. `ecp_notifications_list` with `unread: true`.
8. `ecp_storage_bd_get_config`: are off-site backups configured?

Format: a few lines like "✅ 3 sites online", "⚠️ Disk 91% full", "⚠️ shop.example.com has no HTTPS", each problem with a one-line offer to fix it. No raw numbers in bytes; round to MB/GB.

## Notifications

Summarise unread ones in plain words. Mark read (`ecp_notifications_mark_read` / `_mark_all_read`) when the user has seen them. Deleting needs a yes.

## Updates

`ecp_system_check_for_update` and report. If one is available, `ecp_system_update` applies it, like the Update button in the panel: files and databases stay, but the account is rebuilt and every site restarts and is briefly offline (usually a few minutes). Suggest a quiet time, get a yes, then run it and re-check the sites afterwards.

## Scheduled tasks

- "Run X every night": translate to a 5-field schedule (e.g. `0 3 * * *` = every day at 3am, server time) and a command. Explain both in plain words, then `ecp_crontab_add` with `confirm: true` after a yes. The command runs unattended and repeatedly, so be conservative.
- List with `ecp_crontab_list`; remove with `ecp_crontab_remove` (must match exactly).

## Background programs

`ecp_supervisor_list_processes` shows programs kept running (usually one per app). Start/stop/restart are safe to explain and do; removing one needs a yes.

## Account password and settings

- The ECP login password can't be changed from ECP or from chat; the hosting provider changes it. If it changes, the plugin's saved password must be updated too (plugin settings), or the next session can't log in.
- Firewall (`ecp_system_set_waf`): keep it on. Turning it off removes protection for every site; only with a clear reason and a yes.
