---
name: ecp-launch-website
description: Puts a new website or web app online on the user's ECP hosting account. Use when the user says things like "make me a WordPress site", "start a blog/shop", "put my site online", "deploy my app", "host my GitHub repo", "upload my website", "move my site from cPanel", or "set up a Node/Python/PHP/Laravel app".
---

# Launch a website on ECP

Read the **ecp-assistant** skill first if it isn't loaded: plain language, connection check, safety rules.

## 1. Work out what they're launching

Ask at most one question if it isn't clear:
- **"I just want a website / blog / shop"** with no code of their own → **WordPress** (section 2). This is the right default for non-technical users.
- **They have code** (a GitHub link, a zip, "my developer gave me…") → **app from code** (section 3).
- **They have a site on another host running cPanel** → **cPanel import** (section 4).

Then pick the web address. Call `ecp_domains_list_all`. If the domain they want isn't there, add it first (`ecp_domains_add_domain`, or `ecp_domains_add_subdomain` for something like `shop.example.com`) and follow the **ecp-domains-https** skill for pointing the domain at the hosting.

## 2. WordPress

1. Collect only: site title, admin email. Choose everything else yourself:
   - `admin_user`: something not guessable (not "admin"), e.g. based on their name.
   - `admin_password`, `db_password`: strong random (20+ chars, letters, digits, symbols safe for shells: avoid quotes, `$`, backticks, spaces).
   - `app_name` / `app_dir`: short lowercase from the domain, e.g. `myshop`.
   - `db_name` / `db_username`: short lowercase, e.g. `myshop` / `myshop` (ECP adds the account prefix).
2. Call `ecp_managed_wordpress_install`.
3. Follow progress with `ecp_managed_wordpress_status` and `ecp_managed_wordpress_events` until it's ready or a step failed. If one failed, read the event's detail, explain it simply and fix the cause (often: domain not pointed yet, disk full).
4. Turn on HTTPS for the domain (**ecp-domains-https**).
5. Tell the user: the site address, the admin username, the password **once**, and offer a one-click login with `ecp_managed_wordpress_sso_login` (the link works once and expires in about a minute, so they should open it right away). Suggest they save the password in a password manager.

Afterwards these help: `ecp_managed_wordpress_purge_cache` (changes not showing), `ecp_managed_wordpress_reset_admin_password` (locked out; needs their OK), `ecp_managed_wordpress_security` (security check).

## 3. App from code

1. **Get the code onto the account**:
   - GitHub/GitLab/Bitbucket: check `ecp_git_list_connections`. If connected, find the repo with `ecp_git_list_repos` and use `ecp_apps_create_from_git` with `provider` + `repo_full_name`. If not connected and the repo is private, either give them the link from `ecp_git_authorize_url` to approve in the browser, or use `repo_url` with a username + access token they create. Public repo: `repo_url` alone.
   - A zip they have: they upload it in the ECP panel's File Manager into `~/apps/<folder>` (chat can't receive large uploads), then `ecp_files_extract` it and register it with `ecp_apps_create_from_upload`.
2. **Find out what it is**: `ecp_apps_detect` on the app folder. It tells you the stack, runtime, web root, whether it needs a database, and suggested install/build/start commands. If `root_ambiguous`, pick the right candidate and call again.
3. **Runtime**: if detect gave no exact version, `ecp_asdf_recommend` with its `runtime_constraints`; install with `ecp_asdf_install` if missing (it takes minutes; poll `ecp_asdf_list_installed_versions`), then `ecp_apps_deploy_step` action `configure` with `stack_version` + `asdf_key`.
4. **Database** if needed: create one (**ecp-databases**) and put the connection details in the app's settings file (usually `.env`) with `ecp_files_write`, after showing the user what you'll write. Get host/port from `ecp_db_connection_info`.
5. **Install, build, start**: `ecp_apps_deploy_step` with `install`, then `build` (if any), then `start`. Install/build show no output: check with `ecp_apps_tail_logs` and wait for them to finish before the next step. For a plain static site or PHP app there's nothing to start.
6. **Connect the address**: static site → `ecp_apps_update_static_domain`; PHP → `ecp_apps_update_domain` (with `php_version` from `ecp_lsphp_installed_versions` if needed); a program listening on a port (Node, Python, Go…) → `ecp_apps_update_domain` then `ecp_network_update_port_maps` with the app's port and `app_id`.
7. **HTTPS** (**ecp-domains-https**), then open the site address and check it loads. If not, use **ecp-fix-my-site**.
8. Offer automatic deploys on every push (`ecp_git_webhook_create`), explaining the commands it will run and getting a yes.

## 4. Moving from cPanel

1. Ask for the old server's SSH address, username and password or key (that's the cPanel login for most hosts; SSH must be enabled there).
2. `ecp_cpanel_discover`: shows the sites found and the server's fingerprint. Show the list in plain words and ask which to move. Mention the fingerprint so they can compare it if their old host shows one.
3. `ecp_cpanel_import_start` with the chosen sites (needs their OK), then poll `ecp_cpanel_import_status`. Relay any warnings in plain language (e.g. PHP version changed).
4. When done: point the domain here (**ecp-domains-https**), turn on HTTPS, check the site.
