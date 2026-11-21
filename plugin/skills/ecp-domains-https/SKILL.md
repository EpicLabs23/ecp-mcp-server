---
name: ecp-domains-https
description: Connects domains to the user's ECP hosting and secures them with HTTPS. Use when the user says "add my domain", "connect my domain", "my domain doesn't work", "set up a subdomain", "redirect www", "add a DNS record", "verify my domain for Google/Microsoft", "get the padlock", "SSL", "HTTPS", "certificate expired", or "not secure warning".
---

# Domains, DNS and HTTPS

Read **ecp-assistant** first if it isn't loaded.

## Key idea to explain (once, simply)

A domain is bought at a **registrar** (GoDaddy, Namecheap, Cloudflare…). For it to show the user's site, the registrar must point it at this hosting. You can manage everything on the hosting side; the registrar step the user does themselves, and you guide them click by click in words.

## Add a domain or subdomain

1. `ecp_domains_list_all` to see what's there.
2. New domain: `ecp_domains_add_domain`. Subdomain (`blog.example.com`) of a domain already on the account: `ecp_domains_add_subdomain`.
3. Check DNS: `ecp_dns_list_records` for the domain.
   - The **NS** records are the nameservers. Tell the user to set exactly those as the domain's nameservers at their registrar ("Nameservers" or "DNS" section → "Custom nameservers"). It can take from minutes to a day to take effect.
   - If the user prefers to keep DNS at their registrar (e.g. Cloudflare), instead tell them to add an **A record** for the domain (and `www`) pointing to the hosting's IP address, which is the A record value shown in this zone.
4. If adding or managing the zone fails because **another hosting install already holds it**, use the claim flow: `ecp_dns_claim_status` → `ecp_dns_claim_request` gives a TXT record; tell the user to add it at their current DNS provider; then `ecp_dns_claim_verify` (retry later if still pending).
5. Attach the domain to a site: see **ecp-launch-website** step "Connect the address".

## DNS records

- Common asks, translated: "verify my domain for Google" → TXT record with the value they were given; "set up email with Google/Microsoft" → the MX and TXT records that provider lists (this hosting doesn't provide mailboxes itself); "point a subdomain somewhere else" → CNAME or A record.
- `ecp_dns_add_record` with name, type, value, ttl (3600 is fine). Read back with `ecp_dns_list_records`.
- Deleting (`ecp_dns_delete_record`) can break email or the site: say what the record does and get a yes.

## Redirects

- "Send www to the main address" or "old domain to new one": `ecp_domains_set_redirect` (`redirect_type: "permanent"` is the normal choice). Undo with `ecp_domains_remove_redirect`.

## HTTPS (the padlock)

1. The domain must already point to this hosting (step 3 above), or the free certificate can't be issued. If unsure, check by asking the user to open `http://<domain>` and see if it shows their site or the hosting's page.
2. Explain: "I'll get a free HTTPS certificate from Let's Encrypt for <domain>. The site may blink for a moment while it switches over." Get a yes, then `ecp_ssl_request_lets_encrypt` with `confirm: true`. Do the same for `www.<domain>` if they use it.
3. Check with `ecp_ssl_available_certificates` (`certificate_name: "lets_encrypt"`): show the expiry date in plain words. Let's Encrypt certificates last 90 days. Don't promise automatic renewal: tell the user to ask for a checkup now and then (it flags certificates close to expiry), and renewing is the same request again.
4. If it fails: most often the domain doesn't point here yet (wait and retry), or a typo. Explain and offer to retry later.
5. Bought certificate: they paste the certificate, private key and CA bundle text; `ecp_ssl_upload_certificate` validates and applies it. Remind them the private key is secret.
6. Self-signed certificates show browser warnings: only for testing, never for a real site.
