/**
 * GitHub OAuth Callback Route
 *
 * GET /api/github/callback - Handles OAuth callback from GitHub
 */
import { auth } from "@/lib/auth";
import { exchangeCodeForToken, getGitHubUser, storeGitHubConnection } from "@/lib/github";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Handle OAuth error (user denied access)
  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, baseUrl)
    );
  }

  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", baseUrl));
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_code", baseUrl)
    );
  }

  // Verify state parameter
  try {
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    if (stateData.userId !== session.user.id) {
      return NextResponse.redirect(
        new URL("/settings?error=invalid_state", baseUrl)
      );
    }
  } catch {
    return NextResponse.redirect(
      new URL("/settings?error=invalid_state", baseUrl)
    );
  }

  // Exchange code for access token
  const tokenData = await exchangeCodeForToken(code);
  if (!tokenData) {
    return NextResponse.redirect(
      new URL("/settings?error=token_exchange_failed", baseUrl)
    );
  }

  // Get GitHub user info
  const githubUser = await getGitHubUser(tokenData.access_token);

  // Store connection in database
  await storeGitHubConnection(session.user.id, {
    accessToken: tokenData.access_token,
    githubUserId: githubUser.id.toString(),
    githubUsername: githubUser.login,
  });

  // Redirect to settings with success message
  return NextResponse.redirect(
    new URL("/settings?github=connected", baseUrl)
  );
}
