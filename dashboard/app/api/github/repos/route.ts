/**
 * GitHub Repos API Route
 *
 * GET /api/github/repos - List user's accessible repositories
 */
import { auth } from "@/lib/auth";
import { listUserRepos } from "@/lib/github";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const repos = await listUserRepos(session.user.id);
    return NextResponse.json({ repos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message === "GitHub not connected") {
      return NextResponse.json(
        { error: "GitHub not connected", code: "NOT_CONNECTED" },
        { status: 400 }
      );
    }

    console.error("Failed to list repos:", error);
    return NextResponse.json(
      { error: "Failed to list repositories" },
      { status: 500 }
    );
  }
}
