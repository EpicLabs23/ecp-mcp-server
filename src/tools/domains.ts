import { z } from "zod";
import type { ToolDef } from "./types.js";

// Maps to router/domain.go, router/dns.go, router/network.go, router/nginx.go.

const dnsRecordShape = {
  name: z.string(),
  type: z.string(),
  ttl: z.number().optional(),
  value: z.string().optional(),
  content: z.string().optional(),
  comment: z.string().optional(),
  proxied: z.boolean().optional(),
  priority: z.number().optional(),
};

export const domainTools: ToolDef[] = [
  {
    name: "ecp_domains_list_all",
    description: "List every domain (primary + additional) on this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "domain/all-domains"),
  },
  {
    name: "ecp_domains_list_additional",
    description: "List additional (addon) domains only, excluding the primary domain.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "domain/additional-domains"),
  },
  {
    name: "ecp_domains_add_domain",
    description: "Add an additional (addon) domain to this account.",
    inputSchema: { domain: z.string(), dns_server: z.string().nullable().optional() },
    handler: async (args, client) => client.request("POST", "domain/add-domain", { body: args }),
  },
  {
    name: "ecp_domains_add_subdomain",
    description: "Add a subdomain of a domain this account already owns.",
    inputSchema: { domain: z.string(), subdomain: z.string() },
    handler: async (args, client) => client.request("POST", "domain/add-subdomain", { body: args }),
  },
  {
    name: "ecp_domains_delete",
    description: "Delete a domain from this account. Cannot delete the primary domain. Irreversible.",
    inputSchema: { domain: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "domain/delete-domain", { body: { domain: args.domain } }),
  },
  {
    name: "ecp_domains_set_redirect",
    description: "Redirect a domain to another URL (e.g. www -> apex).",
    inputSchema: {
      domain: z.string(),
      redirect_target: z.string(),
      redirect_type: z.enum(["permanent", "temporary"]),
    },
    handler: async (args, client) => client.request("POST", "domain/set-redirect", { body: args }),
  },
  {
    name: "ecp_domains_remove_redirect",
    description: "Remove a domain's redirect.",
    inputSchema: { domain: z.string() },
    handler: async (args, client) => client.request("POST", "domain/remove-redirect", { body: args }),
  },

  // DNS (Bind9-backed zones only - domains on Cloudflare are managed there instead)
  {
    name: "ecp_dns_list_records",
    description: "List DNS records for a domain's zone.",
    inputSchema: { domain: z.string() },
    handler: async (args, client) => client.request("GET", `dns/records/domain/${args.domain}`),
  },
  {
    name: "ecp_dns_add_record",
    description: "Add a DNS record to a domain's zone.",
    inputSchema: { domain: z.string(), ...dnsRecordShape },
    handler: async (args, client) => client.request("POST", "dns/add-record", { body: args }),
  },
  {
    name: "ecp_dns_delete_record",
    description: "Delete a DNS record from a domain's zone. `record` must match the existing record (name/type/content) closely enough for the DNS provider to identify it.",
    inputSchema: {
      domain: z.string(),
      record: z.object(dnsRecordShape),
      confirm: z.literal(true),
    },
    handler: async (args, client) => client.request("POST", "dns/delete-record", { body: args }),
  },

  // Network / port mappings
  {
    name: "ecp_network_port_maps",
    description: "List all port mappings on this account.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "network/port-maps"),
  },
  {
    name: "ecp_network_domain_port_maps",
    description: "List port mappings for one domain.",
    inputSchema: { domain: z.string() },
    handler: async (args, client) => client.request("GET", `network/port-maps/${args.domain}`),
  },
  {
    name: "ecp_network_update_port_maps",
    description: "Update a port mapping and its nginx config. Can affect site routing.",
    inputSchema: {
      domain: z.string(),
      host_port: z.number(),
      guest_port: z.number(),
      https: z.boolean().optional(),
      description: z.string().optional(),
    },
    handler: async (args, client) => client.request("POST", "network/update-port-maps", { body: args }),
  },

  // Nginx
  {
    name: "ecp_nginx_list_domains",
    description: "List domains that have an nginx config on this container.",
    inputSchema: {},
    handler: async (_args, client) => client.request("GET", "nginx/domains"),
  },
  {
    name: "ecp_nginx_get_conf",
    description: "Read the raw nginx config for a domain.",
    inputSchema: { domain_name: z.string() },
    handler: async (args, client) => client.request("GET", "nginx/conf", { query: { domain_name: args.domain_name } }),
  },
  {
    name: "ecp_nginx_set_conf",
    description: "Overwrite the raw nginx config for a domain. Malformed content can break the site - verify the config is valid before writing.",
    inputSchema: { domain_name: z.string(), file_content: z.string(), confirm: z.literal(true) },
    handler: async (args, client) => client.request("POST", "nginx/conf", { body: args }),
  },
];
