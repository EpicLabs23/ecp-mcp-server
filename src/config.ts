// Turns whatever the user typed as their ECP address into ecp-go's API base
// URL. People know the panel they log into (https://example.com:2323), not
// the API behind it, so all of these work:
//   example.com
//   https://example.com:2323            (the panel itself)
//   https://example.com:2323/dashboard  (a copied panel link)
//   https://example.com:2324/api        (the API, as older configs had it)
// ecp-go always serves the panel on 2323 and the API on 2324 of the same host.
export function normalizeApiBaseUrl(input: string): string {
  let raw = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`"${input}" isn't a web address. Use your ECP panel address, e.g. https://example.com:2323`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`"${input}" isn't a web address. Use your ECP panel address, e.g. https://example.com:2323`);
  }

  // An explicit API URL on a non-standard port is kept as given (a proxied
  // or dev setup); everything else is mapped to <host>:2324/api.
  const path = url.pathname.replace(/\/+$/, "");
  if (/\/api$/.test(path) && url.port !== "2323") {
    return `${url.origin}${path}`;
  }
  return `${url.protocol}//${url.hostname}:2324/api`;
}

/** The panel URL to send users to for anything this server can't do. */
export function panelUrlFromApiBase(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/:2324\/api\/?$/, ":2323");
}

export interface EcpConfig {
  apiBaseUrl: string;
  username: string;
  password: string;
  remember: boolean;
}

export type ConfigResult =
  | { ok: true; config: EcpConfig }
  | { ok: false; problem: string; apiBaseUrl?: string };

const read = (name: string): string => process.env[name]?.trim() ?? "";

// ECP_URL is the friendly name; ECP_API_BASE_URL is kept for existing setups.
// Unexpanded "${...}" placeholders (a plugin option that was never filled in)
// count as empty.
const value = (name: string): string => {
  const v = read(name);
  return /^\$\{[^}]*\}$/.test(v) ? "" : v;
};

export function loadConfig(): ConfigResult {
  const address = value("ECP_URL") || value("ECP_API_BASE_URL");
  const username = value("ECP_ACCOUNT_USERNAME");
  const password = value("ECP_ACCOUNT_PASSWORD");

  let apiBaseUrl: string | undefined;
  if (address) {
    try {
      apiBaseUrl = normalizeApiBaseUrl(address);
    } catch (err) {
      return { ok: false, problem: (err as Error).message };
    }
  }

  const missing = [
    !address && "your ECP panel address",
    !username && "your ECP username",
    !password && "your ECP password",
  ].filter(Boolean) as string[];
  if (missing.length > 0 || !apiBaseUrl) {
    return { ok: false, problem: `ECP isn't set up yet: missing ${missing.join(", ")}.`, apiBaseUrl };
  }

  return {
    ok: true,
    config: {
      apiBaseUrl,
      username,
      password,
      remember: value("ECP_REMEMBER").toLowerCase() === "true",
    },
  };
}
