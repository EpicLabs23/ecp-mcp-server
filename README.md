# ecp-mcp-server

An [MCP](https://modelcontextprotocol.io) server for [ECP](https://github.com/EpicLabs23) (Epic Control Panel) — manage a hosting account's apps, domains, databases, files, PHP, SSL, and more conversationally through Claude Code, Claude Desktop, or any other MCP-compatible client.

It talks to ECP's own API (the same one ECP's web UI uses) as the hosting account you configure it with — nothing about this project modifies EHM or ECP themselves.

## What it can do

~190 tools across:

- **Apps** — deploy, create from git/upload, manage domains, tail logs, custom commands
- **Domains / DNS / Nginx** — add/remove domains and subdomains, DNS records, raw nginx config, redirects
- **Files** — browse, read/write, move/copy/rename/delete, compress/extract
- **Databases** — MySQL, MongoDB, MSSQL, and PostgreSQL: create/delete DBs and users, privileges, browse/edit rows or documents, backups
- **PHP / SSL / System** — PHP versions and `php.ini`, Let's Encrypt/self-signed certificates, disk usage, account settings
- **Supervisor / Crontab** — manage long-running processes and scheduled jobs
- **asdf** — language runtime version management
- **Git integrations** — connect GitHub/GitLab/Bitbucket, browse repos, manage per-app deploy webhooks
- **One-click installers** — WordPress and other blueprint scaffolding
- **Resource monitoring / notifications**
- **storage.bd** — backup config and job status

**What it deliberately does *not* do:** run arbitrary shell commands. ECP's own command-execution primitives are either broken for non-interactive callers (they silently drop output) or don't fit a single request/response tool call (an interactive terminal). Rather than build something unsafe or blind, this server tells the connecting AI to send you to ECP's own browser terminal for anything that genuinely needs a shell.

## Requirements

- Node.js 18+
- An ECP hosting account (username + password)

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
| `ECP_API_BASE_URL` | yes | Your ECP instance's own API base URL, e.g. `https://yourdomain.com:2324/api` — **not** EHM's API. |
| `ECP_ACCOUNT_USERNAME` | yes | The hosting account to log in as. One server instance manages one account. |
| `ECP_ACCOUNT_PASSWORD` | yes | That account's password. |
| `ECP_REMEMBER` | no | `true` for a 30-day session instead of 24h. |
| `ECP_TLS_INSECURE` | no | Dev-only escape hatch for a self-signed ECP instance. Never set this for a real account — see the comment in `.env.sample`. |

## Use it

### Claude Code

```bash
claude mcp add ecp-mcp-server \
  --scope user \
  -e ECP_API_BASE_URL=https://yourdomain.com:2324/api \
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
        "ECP_API_BASE_URL": "https://yourdomain.com:2324/api",
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
- **Credentials** live only in the environment variables you provide and in-process memory — never written to disk beyond what you configure.
- **No shell command execution** — see "What it deliberately does not do" above.

## Development

```bash
git clone https://github.com/EpicLabs23/ecp-mcp-server.git
cd ecp-mcp-server
npm install
cp .env.sample .env   # fill in your own values
npm run build
npm run inspect        # opens the MCP Inspector to test tools manually
```

## License

MIT
