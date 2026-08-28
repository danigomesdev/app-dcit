import { NextResponse } from "next/server";

import { apiFetch } from "@/lib/api";

// Always dynamic: this proxies a per-user, auth-scoped call and must never
// be served from a cached response.
export const dynamic = "force-dynamic";

// The browser can't call the NestJS API directly to poll for live presence
// updates — the session JWT lives in an httpOnly cookie only this Next.js
// server can read (see apiFetch in lib/api.ts). This route is a thin
// same-origin proxy so presence-panel.tsx has something to fetch from the
// client.
export async function GET() {
  const res = await apiFetch("/time-entries/team");
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
