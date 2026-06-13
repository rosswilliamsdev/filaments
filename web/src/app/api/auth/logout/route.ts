import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/server/auth";

export async function POST() {
  clearAuthCookies(await cookies());
  return NextResponse.json({ ok: true });
}
