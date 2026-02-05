"use server";

/**
 * Deployments Actions (Server Actions)
 *
 * Server actions for deployment management.
 */

export async function triggerRollback(
  projectId: string,
  deploymentId: string
): Promise<void> {
  // TODO: Implement rollback via API
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/projects/${projectId}/deployments/${deploymentId}/rollback`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to trigger rollback");
  }
}
