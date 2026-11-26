# ecp-mcp-server

An [MCP](https://modelcontextprotocol.io) server for [ECP](https://github.com/EpicLabs23) (Epic Control Panel) — manage a hosting account's apps, domains, databases, files, PHP, SSL, and more conversationally through Claude Code, Claude Desktop, or any other MCP-compatible client.

It talks to ECP's own API (the same one ECP's web UI uses) as the hosting account you configure it with — nothing about this project modifies EHM or ECP themselves.

## What it can do

~200 tools across:

- **Apps** — detect an app's stack/runtime/commands, deploy, create from git/upload, pull the latest commits for git apps (and manage their saved git login), manage domains and PHP version, tail logs, custom commands
- **Domains / DNS** — add/remove domains and subdomains, DNS records, claim a domain's DNS zone held by another install (TXT challenge), redirects, port maps
- **Files** — browse, read/write, move/copy/rename/delete, compress/extract
- **Databases** — MySQL, MongoDB, MSSQL, and PostgreSQL: create/delete DBs and users, privileges, browse/edit rows or documents, backups
- **PHP / SSL / System** — available PHP (lsphp) versions, Let's Encrypt/self-signed/uploaded certificates, WAF on/off, disk usage, log cleanup, account settings
- **Supervisor / Crontab** — manage long-running processes and scheduled jobs
- **asdf** — language runtime version management
- **Git integrations** — connect GitHub/GitLab/Bitbucket, browse repos, manage per-app deploy webhooks
- **Managed WordPress** — full install, status/event history, cache mode and purge, security status, XML-RPC toggle, admin password reset, one-time wp-admin login
- **Resource monitoring / notifications** — resource status, current-cycle bandwidth use
- **storage.bd** — backup config and job status
- **cPanel import** — discover and import sites from a cPanel server over SSH
- **Shell** — run a command in the account's container and get its exit code and output, with your approval for every command (see Security notes)

**What it deliberately does *not* do:** start a local file backup or restore. Those need a live browser connection for progress; use ECP's own web UI.

## Easiest: the ECP plugin for Claude

For people who just want to run their hosting from chat, without editing config files: install the **ECP plugin**, which bundles this server with step-by-step guides for websites, domains, HTTPS, databases, files and troubleshooting. In Claude Code:

```
/plugin marketplace add EpicLabs23/ecp-mcp-server
/plugin install ecp@epiclabs23
```

It asks for your ECP panel address, username and password (the password goes to your system's secure storage). See [`plugin/README.md`](./plugin/README.md).

The rest of this page is for using the server directly with any MCP client.

## Requirements

- Node.js 18+
- An ECP hosting account (username + password)
- Some tools need a recent ECP: `ecp_shell_exec` and cPanel import need ECP 2.0.3+, DNS claim needs 2.0.4+, and the `ecp_apps_git_*` tools, `ecp_files_upload_limit` and `ecp_resource_bandwidth_usage` need 2.0.5+ (bandwidth also needs EHM 2.0.8+). On an older ECP these tools return a 404 error.
- For `ecp_shell_exec`: an MCP client that supports elicitation (form mode)

## Install

```bash
npx ecp-mcp-server
```

or install globally:

```bash
npm install -g ecp-mcp-server
```

You don't need to do either manually if you're adding it to an MCP client below — the client runs it for you.

## Configure

This server is configured entirely through environment variables — no config file needed. See [`.env.sample`](./.env.sample) for the full list. The essentials:

| Variable | Required | Description |
|---|---|---|
| `ECP_URL` | yes | Your ECP address: `yourdomain.com`, the panel address `https://yourdomain.com:2323`, or the API URL `https://yourdomain.com:2324/api` all work. (`ECP_API_BASE_URL` is the older name and still works.) |
| `ECP_ACCOUNT_USERNAME` | yes | The hosting account to log in as. One server instance manages one account. |
| `ECP_ACCOUNT_PASSWORD` | yes | That account's password. |
| `ECP_REMEMBER` | no | `true` for a 30-day session instead of 24h. |
| `ECP_UPLOAD_DIRS` | no | Folders on this computer that `ecp_files_upload` and the `sql_file_path` imports may read from without asking, separated by `:` (`;` on Windows). Your MCP client's own working folders (MCP roots, e.g. Claude Code's project folder) are always allowed. |
| `ECP_TLS_INSECURE` | no | Dev-only escape hatch for a self-signed ECP instance. Never set this for a real account — see the comment in `.env.sample`. |

## Use it

### Claude Code

```bash
claude mcp add ecp-mcp-server \
  --scope user \
  -e ECP_URL=https://yourdomain.com:2323 \
  -e ECP_ACCOUNT_USERNAME=youraccount \
  -e ECP_ACCOUNT_PASSWORD=yourpassword \
  -- npx ecp-mcp-server
```

Restart Claude Code (MCP servers load at session start), then just ask — "list my apps," "check disk usage," "show me the last few notifications."

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ecp": {
      "command": "npx",
      "args": ["ecp-mcp-server"],
      "env": {
        "ECP_URL": "https://yourdomain.com:2323",
        "ECP_ACCOUNT_USERNAME": "youraccount",
        "ECP_ACCOUNT_PASSWORD": "yourpassword"
      }
    }
  }
}
```

### Other MCP clients

This is a standard stdio MCP server (`@modelcontextprotocol/sdk`) — any compliant client can spawn `npx ecp-mcp-server` with the env vars above and use it.

## Security notes

Worth understanding before you point this at an account you care about:

- **Scope**: one server instance = one hosting account, authenticated exactly as that account (same permissions, same rate limits as logging into ECP's web UI yourself). It cannot reach any other account.
- **Destructive/security-sensitive actions require `confirm: true`** as an explicit tool argument (dropping a table, deleting a file, granting privileges, etc.) — this makes the intent unambiguous in both your MCP client's approval prompt and the audit log below. Don't run this with your client's "auto-approve all tools" setting on.
- **Local audit log**: every tool call is appended to a local file (`ECP_MCP_AUDIT_LOG_PATH`, defaults to `audit.log` next to the installed package) with secrets redacted — since ECP itself doesn't currently keep a durable record of actions taken this way.
- **Uploads read files from your computer, so they're limited to folders you chose.** `ecp_files_upload` and the `sql_file_path` option of the import tools stream a local file straight to ECP (it never goes through the chat). They read without asking only inside your MCP client's working folders and `ECP_UPLOAD_DIRS`, checked after resolving symlinks. Any other file needs your yes in an elicitation prompt that names the file, and the upload is refused if your client can't show one. This keeps an AI that was steered by text it read from sending something like `~/.ssh` to your hosting account.
- **Credentials** live only in the environment variables you provide and in-process memory — never written to disk beyond what you configure.
- **Shell commands need your approval for each command.** `ecp_shell_exec` runs a command as the account user, with the same reach as ECP's browser terminal. Before anything runs, the server shows you the exact command through an MCP elicitation prompt. Declining runs nothing. The `confirm: true` pattern above isn't enough here, because the AI fills in that argument itself and could be steered by text it reads. If your client can't show elicitation prompts, the tool refuses to run. Commands are non-interactive and are killed after their timeout (max 300s). Every command is recorded in the audit log.

## Development

```bash
git clone https://github.com/EpicLabs23/ecp-mcp-server.git
cd ecp-mcp-server
npm install
cp .env.sample .env   # fill in your own values
npm run build
npm run inspect        # opens the MCP Inspector to test tools manually
```

Releasing the server and the plugin: see [`docs/RELEASE.md`](./docs/RELEASE.md).

## License

MIT
