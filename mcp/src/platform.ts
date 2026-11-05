// A small client for the platform's admin API. It talks only to /admin/v1.
export type Scope = "admin" | "read";

export type Platform = {
  whoami: () => Promise<Scope | "invalid">;
  get: (path: string) => Promise<unknown>;
  patch: (path: string, body: unknown) => Promise<unknown>;
};

export class PlatformError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createPlatform(baseUrl: string, token: string): Platform {
  const base = baseUrl.replace(/\/+$/, "");

  async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
    if (!path.startsWith("/admin/v1/")) throw new Error(`Refusing to call ${path}: only /admin/v1 is allowed.`);
    let res: Response;
    try {
      res = await fetch(base + path, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new PlatformError(0, `Could not reach the platform at ${base}.`);
    }
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {}
    return { status: res.status, data };
  }

  async function ok(method: string, path: string, body?: unknown): Promise<unknown> {
    const { status, data } = await call(method, path, body);
    if (status >= 200 && status < 300) return data;
    throw new PlatformError(status, data?.detail ?? `The platform answered ${status}.`);
  }

  return {
    async whoami() {
      const { status, data } = await call("GET", "/admin/v1/whoami");
      if (status === 401 || status === 403) return "invalid";
      if (status === 200 && (data?.scope === "admin" || data?.scope === "read")) return data.scope;
      throw new PlatformError(status, `The platform's whoami answered ${status}.`);
    },
    get: (path) => ok("GET", path),
    patch: (path, body) => ok("PATCH", path, body),
  };
}
