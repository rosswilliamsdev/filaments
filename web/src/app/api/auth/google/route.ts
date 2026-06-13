import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { DJANGO_API_URL, setAuthCookies } from "@/lib/server/auth";

/**
 * BFF sign-in: browser sends the Google ID token here; Django verifies it and
 * issues the JWT pair, which we store as httpOnly cookies. Tokens never reach
 * client-side JavaScript (web-planning-doc → auth flow).
 */
export async function POST(req: NextRequest) {
  let idToken: unknown;
  try {
    ({ id_token: idToken } = await req.json());
  } catch {
    return NextResponse.json({ error: "id_token required" }, { status: 400 });
  }
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "id_token required" }, { status: 400 });
  }

  const res = await fetch(`${DJANGO_API_URL}/api/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { error: data.error ?? "sign-in failed" },
      { status: res.status },
    );
  }

  setAuthCookies(await cookies(), data.access, data.refresh);
  return NextResponse.json({ user: data.user });
}
