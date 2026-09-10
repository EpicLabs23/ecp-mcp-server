// Client for ECP's own API (ecp-go), never EHM-API directly - see the plan
// doc for why. Mirrors ecp-ui's own auth.js: log in once, hold the
// refresh_token httpOnly cookie ourselves (there's no browser to do it for
// us), refresh proactively before the access token expires or reactively on
// a 401.

export interface EcpClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  remember?: boolean;
}

interface AuthResponse {
  access_token: string;
}

function decodeJwtExpMs(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function extractRefreshCookie(setCookieHeaders: string[]): string | null {
  for (const header of setCookieHeaders) {
    const match = header.match(/^refresh_token=([^;]*)/);
    if (match) return match[1];
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class EcpClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly remember: boolean;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;
  private refreshCookie: string | null = null;

  constructor(opts: EcpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.username = opts.username;
    this.password = opts.password;
    this.remember = opts.remember ?? false;
  }

  private captureRefreshCookie(res: Response): void {
    const headers = res.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
    const value = extractRefreshCookie(cookies);
    if (value) this.refreshCookie = value;
  }

  private setAccessToken(token: string): void {
    this.accessToken = token;
    const exp = decodeJwtExpMs(token);
    // Refresh a bit early so a request never races the token's own expiry.
    this.accessTokenExpiresAt = exp ? exp - 60_000 : Date.now() + 10 * 60_000;
  }

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
        remember: this.remember,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ECP login failed (${res.status}): ${text}`);
    }
    this.captureRefreshCookie(res);
    const data = (await res.json()) as AuthResponse;
    this.setAccessToken(data.access_token);
  }

  private async refresh(): Promise<void> {
    if (!this.refreshCookie) {
      await this.login();
      return;
    }
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: { cookie: `refresh_token=${this.refreshCookie}` },
    });
    if (!res.ok) {
      // Refresh token expired/invalid server-side - fall back to a fresh login.
      this.refreshCookie = null;
      await this.login();
      return;
    }
    this.captureRefreshCookie(res);
    const data = (await res.json()) as AuthResponse;
    this.setAccessToken(data.access_token);
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.accessToken) {
      await this.login();
    } else if (Date.now() >= this.accessTokenExpiresAt) {
      await this.refresh();
    }
    return this.accessToken as string;
  }

  /** Request against ecp-go's own API, e.g. request("GET", "user/profile"). */
  async request<T = unknown>(
    method: string,
    path: string,
    opts: {
      query?: Record<string, unknown>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);
    if (opts.query) {
      for (const [key, value] of Object.entries(opts.query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const doFetch = (bearer: string) =>
      fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${bearer}`,
          ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });

    let res = await doFetch(token);
    if (res.status === 401) {
      await this.refresh();
      res = await doFetch(this.accessToken as string);
    }

    const text = await res.text();
    const data = text ? safeJsonParse(text) : undefined;
    if (!res.ok) {
      throw new Error(`ECP API ${method} ${path} failed (${res.status}): ${text}`);
    }
    return data as T;
  }

  /** multipart/form-data POST, e.g. for importDatabase's file upload. */
  async requestMultipart<T = unknown>(
    path: string,
    fields: Record<string, unknown>,
    file: { fieldName: string; fileName: string; content: string; contentType?: string },
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);

    const buildForm = () => {
      const form = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (value !== undefined && value !== null) form.set(key, String(value));
      }
      form.set(
        file.fieldName,
        new Blob([file.content], { type: file.contentType ?? "application/octet-stream" }),
        file.fileName,
      );
      return form;
    };

    const doFetch = (bearer: string) =>
      fetch(url, { method: "POST", headers: { authorization: `Bearer ${bearer}` }, body: buildForm() });

    let res = await doFetch(token);
    if (res.status === 401) {
      await this.refresh();
      res = await doFetch(this.accessToken as string);
    }

    const text = await res.text();
    const data = text ? safeJsonParse(text) : undefined;
    if (!res.ok) {
      throw new Error(`ECP API POST ${path} failed (${res.status}): ${text}`);
    }
    return data as T;
  }
}
