import { cookies } from "next/headers";

export const DJANGO_API_URL =
  process.env.DJANGO_API_URL ?? "http://localhost:8000";

export const ACCESS_COOKIE = "fil_access";
export const REFRESH_COOKIE = "fil_refresh";

// SimpleJWT on the backend: 60-min access, 7-day refresh. Cookie lifetimes
// only need to outlive the tokens they carry; expiry is enforced server-side.
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

const COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type CookieStore = Awaited<ReturnType<typeof cookies>>;

export function setAuthCookies(
  store: CookieStore,
  access: string,
  refresh: string,
) {
  store.set(ACCESS_COOKIE, access, { ...COOKIE_BASE, maxAge: ACCESS_MAX_AGE });
  store.set(REFRESH_COOKIE, refresh, {
    ...COOKIE_BASE,
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearAuthCookies(store: CookieStore) {
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/**
 * Exchange the refresh cookie for a fresh access token. Returns the new
 * access token, or null if the session is unrecoverable (cookies cleared).
 * ROTATE_REFRESH_TOKENS is on server-side; a new refresh token may arrive.
 */
export async function refreshSession(
  store: CookieStore,
): Promise<string | null> {
  const refresh = store.get(REFRESH_COOKIE)?.value;
  if (!refresh) return null;

  const res = await fetch(`${DJANGO_API_URL}/api/v1/auth/token/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
    cache: "no-store",
  });
  if (!res.ok) {
    clearAuthCookies(store);
    return null;
  }
  const data = await res.json();
  setAuthCookies(store, data.access, data.refresh ?? refresh);
  return data.access;
}
