# Releasing

This repo ships two things that are released together but versioned separately:

| What | Version lives in | Users get it via |
|---|---|---|
| **MCP server** (`ecp-mcp-server` on npm) | `package.json` | `npx ecp-mcp-server`, or the plugin |
| **ECP plugin for Claude** (`plugin/`) | `plugin/.claude-plugin/plugin.json` | the `epiclabs23` marketplace (this repo), or the `ecp.plugin` file on the GitHub release |

The plugin doesn't contain the server. Its `plugin/.mcp.json` runs `npx -y ecp-mcp-server@^X.Y.0`, so **the npm package must be published before anyone can use a plugin release that points at it**.

## How the two versions relate

- On a `0.x` version, `^0.4.0` means `>=0.4.0 <0.5.0`. Patch releases of the server (0.4.1, 0.4.2) reach plugin users automatically, with no plugin release.
- A minor server release (0.4 → 0.5) is **not** picked up by the plugin until you change the range in `plugin/.mcp.json` and release the plugin.
- Claude Code decides a plugin has an update by its `version` in `plugin.json`. Any change under `plugin/` (skills, README, `.mcp.json`) needs a version bump there, or installed users won't get it.

## Checklist

### 1. Prepare

- [ ] `CHANGELOG.md`: move "Unreleased" under the new version heading with today's date. Note which ECP/EHM version each new tool needs.
- [ ] `npm version <x.y.z> --no-git-tag-version` (updates `package.json` and `package-lock.json`).
- [ ] If tools were added, removed or renamed: update `plugin/skills/ecp-assistant/references/tool-map.md`, and any skill that names the tool.
- [ ] If a skill describes what a tool does, check the claim against the real behaviour in ecp-go / ehm-api, not only the tool's description.
- [ ] Minor or major server bump: update the range in `plugin/.mcp.json` (e.g. `ecp-mcp-server@^0.5.0`).
- [ ] Anything under `plugin/` changed: bump `version` in `plugin/.claude-plugin/plugin.json`.
- [ ] `README.md` and `plugin/README.md` still match (install commands, settings names, what's possible).

### 2. Check

```bash
npm ci
rm -rf dist && npm run build      # tsc doesn't delete files for removed tools
npx tsc --noEmit
npm pack --dry-run                # only dist/, README, LICENSE, CHANGELOG, .env.sample
claude plugin validate plugin --profile directory
claude plugin validate .          # the marketplace file
```

Smoke test the built server against a real account (`npm run inspect`, then call `ecp_whoami` and a read-only tool like `ecp_apps_list`). For plugin changes, load it from disk and try a real request:

```bash
claude --plugin-dir ./plugin
```

### 3. Commit, tag, push

```bash
git add -A
git commit -m "x.y.z: <short summary>"
git tag vx.y.z
git push origin master
git push origin vx.y.z
```

Tags are `v`-prefixed (`v0.4.0`) and follow the server version. A plugin-only release (no server change) still gets a commit, but no new tag or npm publish.

### 4. Publish to npm

```bash
npm whoami                        # if not logged in: npm login
git checkout vx.y.z               # publish exactly the tagged code
rm -rf dist
npm publish                       # prepublishOnly runs the build; add --otp=<code> if 2FA is on
git checkout master
npm view ecp-mcp-server version   # should print x.y.z
```

Published versions can't be reused: if something is wrong, fix it and publish the next patch version.

### 5. GitHub release

Package the plugin as a single file and attach it:

```bash
cd plugin && rm -f /tmp/ecp.plugin && zip -qr /tmp/ecp.plugin . -x "*.DS_Store" && cd ..
gh release create vx.y.z --title "x.y.z — <summary>" --notes-file <notes.md> /tmp/ecp.plugin
```

Release notes: what's new for plugin users in plain words first, then the server changes, linking to `CHANGELOG.md`.

### 6. Verify the install path

```bash
claude plugin marketplace add EpicLabs23/ecp-mcp-server
claude plugin marketplace list    # epiclabs23 should be listed
```

Then, in a fresh session with the plugin installed, ask "check my hosting". Claude should load the ecp-assistant skill and call `ecp_whoami` through the published server. Remove the marketplace afterwards if it was only for the check (`claude plugin marketplace remove epiclabs23`).

## Plugin directory (optional)

`claude plugin validate plugin --profile directory` runs the checks the Claude plugin directory refuses a submission for (README, license, icon). The directory also runs a safety scan and policy review. The icon at `plugin/.claude-plugin/icon.png` becomes the listing icon only the first time the plugin is submitted; changing it later doesn't update the listing.
