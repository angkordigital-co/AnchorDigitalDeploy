/**
 * GitHub OAuth Connect Route
 *
 * GET /api/github/connect - Redirects to GitHub OAuth authorization
 */
import { auth } from "@/lib/auth";
import { getGitHubAuthUrl } from "@/lib/github";
import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  // Generate state parameter for CSRF protection
  // Include userId for callback verification
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      nonce: crypto.randomBytes(16).toString("hex"),
    })
  ).toString("base64url");

  const authUrl = getGitHubAuthUrl(state);

  return NextResponse.redirect(authUrl);
}
