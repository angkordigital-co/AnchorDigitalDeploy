"use server";

/**
 * Domain Actions (Server Actions)
 *
 * Server actions for domain management.
 */

export async function addDomain(projectId: string, domain: string): Promise<void> {
  // TODO: Implement domain addition via API
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/projects/${projectId}/domains`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to add domain");
  }
}

export async function deleteDomain(projectId: string, domainId: string): Promise<void> {
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/projects/${projectId}/domains/${domainId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to delete domain");
  }
}

export async function refreshDomainStatus(projectId: string, domainId: string): Promise<void> {
  const response = await fetch(
    `${process.env.API_GATEWAY_URL}/projects/${projectId}/domains/${domainId}/refresh`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Failed to refresh domain status");
  }
}
