import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

const PUBLIC_ROUTES = ["/login", "/esqueci-senha"];

// Files under /public (login-background.png, favicon.ico, ...) are static
// assets, not app routes — redirecting them to /login when unauthenticated
// breaks anything that references them from the login page itself (the
// image request bounces to /login, which requests the image, forever).
function isStaticAsset(pathname: string): boolean {
  return /\.[^/]+$/.test(pathname);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!hasSession && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && isPublicRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
