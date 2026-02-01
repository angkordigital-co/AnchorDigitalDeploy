/**
 * Next.js Middleware for Route Protection
 *
 * Uses Auth.js v5 auth() to check authentication state.
 * Redirects unauthenticated users to /login for protected routes.
 *
 * Public routes:
 * - /login - Login page
 * - /api/auth/* - Auth.js API routes
 * - /_next/* - Next.js internals
 * - /favicon.ico - Favicon
 */
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;

  // Allow public routes
  const isLoginPage = pathname === "/login";
  const isAuthRoute = pathname.startsWith("/api/auth");
  const isNextInternal = pathname.startsWith("/_next");
  const isFavicon = pathname === "/favicon.ico";
  const isPublicAsset = pathname.startsWith("/public");

  if (isLoginPage || isAuthRoute || isNextInternal || isFavicon || isPublicAsset) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    // Preserve the original URL for redirect after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
