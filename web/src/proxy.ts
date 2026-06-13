import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REFRESH_COOKIE = "fil_refresh";

/**
 * Route protection. Presence of the refresh cookie is the signed-in signal —
 * it's httpOnly, so this is a routing hint only; real authorization happens
 * in Django on every proxied request.
 */
export function proxy(request: NextRequest) {
  const signedIn = request.cookies.has(REFRESH_COOKIE);
  const { pathname, search } = request.nextUrl;

  if (pathname === "/sign-in") {
    if (signedIn) {
      const next = request.nextUrl.searchParams.get("next") ?? "/";
      return NextResponse.redirect(new URL(next, request.url));
    }
    return NextResponse.next();
  }

  if (!signedIn) {
    const signInUrl = new URL("/sign-in", request.url);
    const next = pathname + search;
    if (next !== "/") signInUrl.searchParams.set("next", next);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Protect pages only; /api/* routes return their own 401s, and static
  // assets must never bounce to /sign-in.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
