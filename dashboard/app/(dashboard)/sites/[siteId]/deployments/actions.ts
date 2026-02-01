"use server";

/**
 * Server Actions for Deployments Page
 *
 * Handles rollback triggers via the existing API.
 */
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "";

/**
 * Trigger rollback to a previous deployment
 *
 * Calls POST /projects/{projectId}/rollback API endpoint.
 * This uses Lambda alias switching for instant rollback.
 */
export async function triggerRollback(
  projectId: string,
  deploymentId: string
): Promise<{ success: boolean }> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  // Call the rollback API
  const response = await fetch(
    `${API_GATEWAY_URL}/projects/${projectId}/rollback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": session.user.id,
      },
      body: JSON.stringify({ deploymentId }),
    }
  );

  if (!response.ok) {
    let errorMessage = "Rollback failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Response wasn't JSON
      errorMessage = `Rollback failed with status ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  // Revalidate the deployments page to show updated status
  revalidatePath(`/sites/${projectId}/deployments`);

  return { success: true };
}
