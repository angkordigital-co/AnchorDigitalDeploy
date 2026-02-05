/**
 * GitHub Disconnect Route
 *
 * DELETE /api/github/disconnect - Removes GitHub connection
 */
import { auth } from "@/lib/auth";
import { removeGitHubConnection } from "@/lib/github";
import { NextResponse } from "next/server";

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await removeGitHubConnection(session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect GitHub:", error);
    return NextResponse.json(
      { error: "Failed to disconnect GitHub" },
      { status: 500 }
    );
  }
}
