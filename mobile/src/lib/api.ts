import { clearTokens, getAccess, getRefresh, saveTokens } from "./tokens";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Lets the auth provider flip to signed-out when a refresh fails mid-session.
let onSessionExpired: (() => void) | undefined;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

async function refreshAccess(): Promise<string | null> {
  const refresh = await getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${BASE}/api/v1/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = await res.json();
  // ROTATE_REFRESH_TOKENS is on server-side; a new refresh token may arrive.
  await saveTokens(data.access, data.refresh ?? refresh);
  return data.access;
}

/**
 * `path` is relative to /api/v1 ("/filaments?type=voice") or an absolute URL
 * (cursor pagination hands back full `next` URLs).
 */
export async function api<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const access = await getAccess();
  const url = path.startsWith("http") ? path : `${BASE}/api/v1${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && access && !retried) {
    const fresh = await refreshAccess();
    if (fresh) return api<T>(path, init, true);
    onSessionExpired?.();
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
