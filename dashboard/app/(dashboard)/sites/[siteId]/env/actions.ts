'use server';

/**
 * Server Actions for Environment Variables Management
 *
 * Handles CRUD operations for project environment variables
 * via the API Gateway backend.
 */

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Environment variable structure
 */
export interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

/**
 * Fetch environment variables for a project
 */
export async function getEnvVars(projectId: string): Promise<{ envVars: EnvVar[] }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  const response = await fetch(`${apiUrl}/projects/${projectId}/env`, {
    headers: {
      'x-user-id': session.user.id,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch env vars' }));
    throw new Error(error.message || 'Failed to fetch env vars');
  }

  return response.json();
}

/**
 * Update environment variables for a project
 *
 * Replaces all env vars with the provided list.
 */
export async function updateEnvVars(
  projectId: string,
  envVars: EnvVar[]
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  // Filter out empty keys
  const filteredEnvVars = envVars.filter((env) => env.key.trim() !== '');

  const response = await fetch(`${apiUrl}/projects/${projectId}/env`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': session.user.id,
    },
    body: JSON.stringify({ envVars: filteredEnvVars }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update env vars' }));
    throw new Error(error.message || 'Failed to update env vars');
  }

  revalidatePath(`/sites/${projectId}/env`);
  return { success: true };
}
