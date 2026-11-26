import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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

/**
 * A file on this computer to send as an upload, already checked and opened
 * (local-files.ts). requestMultipart sends from the handle and closes it.
 */
export interface LocalFile {
  path: string;
  size: number;
  handle: FileHandle;
}

// Per the HTML form-data encoding: '"' and line breaks in a name or filename
// are percent-encoded, which is what Go's multipart reader expects.
function escapeFormName(value: string): string {
  return value.replace(/"/g, "%22").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
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
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
          remember: this.remember,
        }),
      });
    } catch (err) {
      // fetch only throws for transport problems (DNS, refused, TLS), and its
      // own message is just "fetch failed" - name the address and the cause.
      const cause = (err as { cause?: { code?: string; message?: string } }).cause;
      const detail = cause?.code ?? cause?.message ?? (err as Error).message;
      throw new Error(
        `Couldn't reach ECP at ${this.baseUrl} (${detail}). Check the panel address in the settings and that the server is online.`,
      );
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error(
          `ECP didn't accept the username or password (${res.status}). Check them in the settings - they're the same ones you use to log into the ECP panel. ${text}`.trim(),
        );
      }
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

  /**
   * multipart/form-data POST, e.g. for importDatabase's file upload. content
   * is either the file's text, or a file on this computer, which is streamed
   * from disk. The body is built by hand and sent with node:http because
   * Node's fetch holds a FormData or streamed body in memory (measured:
   * ~700 MB peak RSS for a 600 MB file, ~90 MB this way).
   */
  async requestMultipart<T = unknown>(
    path: string,
    fields: Record<string, unknown>,
    file: { fieldName: string; fileName: string; content: string | LocalFile; contentType?: string },
    query?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await this.sendMultipart<T>(path, fields, file, query);
    } finally {
      // The handle is ours once passed in, whether or not the upload worked.
      if (typeof file.content !== "string") await file.content.handle.close();
    }
  }

  private async sendMultipart<T>(
    path: string,
    fields: Record<string, unknown>,
    file: { fieldName: string; fileName: string; content: string | LocalFile; contentType?: string },
    query?: Record<string, unknown>,
  ): Promise<T> {
    const token = await this.ensureAccessToken();
    const url = new URL(`${this.baseUrl}/${path.replace(/^\/+/, "")}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
    }

    const boundary = `----ecp-mcp-${randomUUID()}`;
    let head = "";
    for (const [key, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      head += `--${boundary}\r\ncontent-disposition: form-data; name="${escapeFormName(key)}"\r\n\r\n${String(value)}\r\n`;
    }
    head +=
      `--${boundary}\r\ncontent-disposition: form-data; name="${escapeFormName(file.fieldName)}"; filename="${escapeFormName(file.fileName)}"\r\n` +
      `content-type: ${file.contentType ?? "application/octet-stream"}\r\n\r\n`;
    const headBytes = Buffer.from(head, "utf8");
    const tailBytes = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
    const content = file.content;
    const textBytes = typeof content === "string" ? Buffer.from(content, "utf8") : null;
    const length = headBytes.length + tailBytes.length + (textBytes ? textBytes.length : (content as LocalFile).size);

    const body = (): Readable => {
      if (textBytes) return Readable.from([Buffer.concat([headBytes, textBytes, tailBytes])]);
      const local = content as LocalFile;
      return Readable.from(
        (async function* () {
          yield headBytes;
          // A file that changed size since it was checked would make the
          // body disagree with content-length - fail rather than send it.
          let sent = 0;
          for await (const chunk of local.handle.createReadStream({ start: 0, autoClose: false })) {
            sent += (chunk as Buffer).length;
            yield chunk as Buffer;
          }
          if (sent !== local.size) throw new Error(`${local.path} changed while it was being uploaded.`);
          yield tailBytes;
        })(),
      );
    };

    const send = (bearer: string) =>
      new Promise<{ status: number; ok: boolean; text: string }>((resolve, reject) => {
        const request = url.protocol === "https:" ? httpsRequest : httpRequest;
        const req = request(
          url,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${bearer}`,
              "content-type": `multipart/form-data; boundary=${boundary}`,
              "content-length": String(length),
            },
          },
          (res) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => {
              const status = res.statusCode ?? 0;
              resolve({ status, ok: status >= 200 && status < 300, text: Buffer.concat(chunks).toString("utf8") });
            });
            res.on("error", reject);
          },
        );
        req.on("error", reject);
        pipeline(body(), req).catch(reject);
      });

    let res = await send(token);
    if (res.status === 401) {
      await this.refresh();
      res = await send(this.accessToken as string);
    }

    const text = res.text;
    const data = text ? safeJsonParse(text) : undefined;
    if (!res.ok) {
      throw new Error(`ECP API POST ${path} failed (${res.status}): ${text}`);
    }
    return data as T;
  }
}
