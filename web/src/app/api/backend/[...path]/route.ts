import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  DJANGO_API_URL,
  clearAuthCookies,
  refreshSession,
} from "@/lib/server/auth";

/**
 * Catch-all BFF proxy: /api/backend/<path> → Django /api/v1/<path>.
 *
 * JWTs live in httpOnly cookies the browser can't read, so this is the only
 * place Authorization headers get attached. Refresh-on-401 happens here too,
 * once, so client code never sees a recoverable 401.
 */
async function forward(req: NextRequest, ctx: RouteContext<"/api/backend/[...path]">) {
  const { path } = await ctx.params;
  const store = await cookies();
  const url = `${DJANGO_API_URL}/api/v1/${path.join("/")}${req.nextUrl.search}`;
  // Buffer the body so the request can be replayed after a token refresh.
  const body = ["GET", "HEAD"].includes(req.method)
    ? undefined
    : await req.arrayBuffer();

  const send = (access: string | undefined) =>
    fetch(url, {
      method: req.method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") ?? "application/json",
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      body,
      cache: "no-store",
      redirect: "manual",
    });

  let res = await send(store.get(ACCESS_COOKIE)?.value);

  if (res.status === 401) {
    const fresh = await refreshSession(store);
    if (!fresh) {
      clearAuthCookies(store);
      return NextResponse.json({ error: "session expired" }, { status: 401 });
    }
    res = await send(fresh);
  }

  // Pass the body through untouched — export endpoints return file downloads.
  const headers = new Headers();
  for (const name of ["Content-Type", "Content-Disposition"]) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new NextResponse(res.status === 204 ? null : res.body, {
    status: res.status,
    headers,
  });
}

export {
  forward as GET,
  forward as POST,
  forward as PATCH,
  forward as PUT,
  forward as DELETE,
};
