# ECP plugin for Claude

Run your ECP (Epic Control Panel) hosting account by chatting with Claude. You don't need to know anything about servers: say what you want in your own words, and Claude does it in your account, explains what it's doing, and asks before anything risky.

## What you can ask

- **"Make me a WordPress site for my bakery on bakery.com"**: full install, HTTPS, and a one-click login to your new site.
- **"Put my GitHub project online"**, **"Move my site from my old cPanel host"**
- **"Connect my domain"**, **"Add the DNS record Google gave me"**, **"Send www to my main address"**, **"Get the padlock on my site"**
- **"My site is down"**, **"It shows a 502 error"**, **"I'm locked out of WordPress"**
- **"Create a database for my app"**, **"Back up my database"**, **"Restore yesterday's backup"**
- **"Change the email address in my site's settings file"**, **"My disk is full, what can I delete?"**
- **"How's my hosting doing?"**: a quick checkup of sites, space, traffic, HTTPS and warnings.

## Before you start

You need:

1. An ECP hosting account, with the **panel address** (the address you open to log into ECP, like `https://example.com:2323`), your **username** and your **password**.
2. **Node.js** installed on your computer (version 18 or newer, from [nodejs.org](https://nodejs.org), the "LTS" download). The plugin uses it to talk to your account.
3. Claude Code (terminal, desktop app, or VS Code / JetBrains extension).

## Install

In Claude, type:

```
/plugin marketplace add EpicLabs23/ecp-mcp-server
/plugin install ecp@epiclabs23
```

Claude then asks for your panel address, username and password. The password is kept in your computer's secure storage, not in a plain file. Restart Claude when it's done, then say **"check my hosting"** to make sure it's connected.

To change those details later: `/plugin`, choose **ecp**, then its options.

## How it keeps you safe

- It acts only on the one account you log in with, with the same permissions you have in the ECP panel.
- Before anything that deletes, overwrites or could take a site offline, Claude explains in plain words what will happen and waits for your "yes".
- Running a command on the server always shows you the exact command in an approval prompt first. Saying no runs nothing.
- Every action is written to a local log file on your computer.

Don't turn on any "approve everything automatically" setting for this plugin.

## What still needs the ECP panel

A few things need your web browser: uploading big files from your computer (use the panel's File Manager), starting or restoring a full file backup, and approving a GitHub/GitLab/Bitbucket connection. Claude tells you exactly where to click when you hit one of these.

## What's inside

- The [ECP MCP server](https://github.com/EpicLabs23/ecp-mcp-server) (about 200 actions across websites, domains, HTTPS, databases, files, backups and settings), run on your computer with `npx`.
- Guides that teach Claude how to do common jobs step by step for non-technical users: launching a website, domains and HTTPS, fixing a broken site, databases, files and backups, and account checkups.

## Help

Problems or ideas: [open an issue](https://github.com/EpicLabs23/ecp-mcp-server/issues).

## License

MIT
