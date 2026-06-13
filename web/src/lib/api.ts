// Client-side API wrapper. Unlike mobile (which holds tokens and talks to
// Django directly), the browser talks to the BFF proxy at /api/backend; the
// proxy attaches Authorization and handles token refresh. A 401 here means
// the session is truly gone.

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * `path` is relative to /api/v1 ("/filaments?type=voice"). Cursor pagination
 * hands back absolute Django URLs — use `toApiPath` before passing them in.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/backend${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });

  if (res.status === 401) {
    const next = window.location.pathname + window.location.search;
    window.location.assign(
      `/sign-in${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`,
    );
    throw new ApiError("Session expired", 401);
  }

  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try {
      const body = await res.json();
      detail = body.error ?? body.detail ?? JSON.stringify(body);
    } catch {
      // non-JSON error body; keep the status text
    }
    throw new ApiError(detail, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** DRF returns absolute `next` URLs ("http://django/api/v1/filaments?cursor=…"); reduce to a proxy-relative path. */
export function toApiPath(absoluteUrl: string): string {
  const url = new URL(absoluteUrl);
  const idx = url.pathname.indexOf("/api/v1");
  return url.pathname.slice(idx + "/api/v1".length) + url.search;
}
