"use server";

/**
 * Environment Variables Actions (Server Actions)
 *
 * Server actions for environment variable management.
 */

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export async function updateEnvVars(
  projectId: string,
  envVars: EnvVar[]
): Promise<void> {
  // TODO: Implement env vars update via API
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/projects/${projectId}/env`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ envVars }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to update environment variables");
  }
}
