# Changelog

## 0.3.0 — 2026-10-26

Matches ECP 2.0.5 / EHM 2.0.8.

### Added
- `ecp_resource_bandwidth_usage`: the account's bandwidth use for the current billing cycle and recent cycles. Needs ECP 2.0.5+ on EHM 2.0.8+.
- `ecp_files_upload_limit`: the largest upload ECP accepts (also the size cap for SQL imports). Needs ECP 2.0.5+.

### Changed
- `ecp_domains_add_domain` no longer takes `dns_server` (ECP dropped it).
- `ecp_domains_list_additional` says it includes subdomains, which it always did.
- `ecp_files_write` notes ECP 2.0.5's 32 MB cap on non-upload requests.
- The `ecp_apps_git_*` tools need ECP 2.0.5+ (was "the release after 2.0.4").

## 0.2.0 — 2026-10-22

### Added
- `ecp_shell_exec`: runs a shell command in the account's container and returns its exit code and stdout/stderr. You approve every command through an MCP elicitation prompt, and the tool refuses to run on clients without elicitation support. Needs ECP 2.0.3+.
- Git tools for apps created from git: `ecp_apps_git_info`, `ecp_apps_git_pull` (`discard_local_changes` also needs `confirm: true`), `ecp_apps_git_save_credential` and `ecp_apps_git_delete_credential`. Need the ECP release after 2.0.4.
- DNS zone claim tools: `ecp_dns_claim_status`, `ecp_dns_claim_request` and `ecp_dns_claim_verify`. Need ECP 2.0.4+.
- cPanel import: `ecp_cpanel_discover`, `ecp_cpanel_import_start` and `ecp_cpanel_import_status`.
- Managed WordPress tools, `ecp_apps_detect`, SSL certificate upload, WAF toggle, lsphp versions and log cleanup.

### Changed
- `ecp_apps_deploy_step`: the app's process now gets its `.env` as its environment. Pass `start_command` with `restart` to pick up `.env` changes.
- `ecp_apps_deploy_step` `configure` needs `asdf_key`. `ecp_ssl_request_lets_encrypt` sends `certificate_name`.
- storage.bd config tools describe the credentials as Space ID / access key.
- The server reports its version from package.json.

### Removed
- `ecp_nginx_*` and the PHP-FPM tools. Their ECP endpoints no longer exist.

## 0.1.0 — 2026-09-10

First public release.
