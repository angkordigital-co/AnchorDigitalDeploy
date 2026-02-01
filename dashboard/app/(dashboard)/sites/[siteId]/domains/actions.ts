'use server';

/**
 * Server Actions for Custom Domains Management
 *
 * Handles CRUD operations for custom domains via the API Gateway backend.
 * Includes certificate provisioning via ACM and CloudFront configuration.
 */

import { auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { Domain } from '@/lib/aws/types';

/**
 * Fetch all custom domains for a project
 */
export async function getDomains(projectId: string): Promise<{ domains: Domain[] }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  const response = await fetch(`${apiUrl}/projects/${projectId}/domains`, {
    headers: {
      'x-user-id': session.user.id,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch domains' }));
    throw new Error(error.message || 'Failed to fetch domains');
  }

  return response.json();
}

/**
 * Add a custom domain to a project
 *
 * This triggers:
 * 1. ACM certificate request in us-east-1
 * 2. Returns DNS validation records for the user to configure
 */
export async function addDomain(
  projectId: string,
  domainName: string
): Promise<Domain> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  const response = await fetch(`${apiUrl}/projects/${projectId}/domains`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': session.user.id,
    },
    body: JSON.stringify({ domainName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to add domain' }));
    throw new Error(error.message || 'Failed to add domain');
  }

  revalidatePath(`/sites/${projectId}/domains`);
  return response.json();
}

/**
 * Delete a custom domain from a project
 *
 * This triggers:
 * 1. Removal from CloudFront distribution
 * 2. Certificate cleanup
 */
export async function deleteDomain(
  projectId: string,
  domainId: string
): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  const response = await fetch(
    `${apiUrl}/projects/${projectId}/domains/${domainId}`,
    {
      method: 'DELETE',
      headers: {
        'x-user-id': session.user.id,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete domain' }));
    throw new Error(error.message || 'Failed to delete domain');
  }

  revalidatePath(`/sites/${projectId}/domains`);
  return { success: true };
}

/**
 * Refresh domain status
 *
 * Fetches the latest status from the API.
 * If the certificate has been issued, this may trigger CloudFront configuration.
 */
export async function refreshDomainStatus(
  projectId: string,
  domainId: string
): Promise<Domain> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const apiUrl = process.env.API_GATEWAY_URL;
  if (!apiUrl) {
    throw new Error('API_GATEWAY_URL not configured');
  }

  const response = await fetch(
    `${apiUrl}/projects/${projectId}/domains/${domainId}`,
    {
      headers: {
        'x-user-id': session.user.id,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to refresh domain status' }));
    throw new Error(error.message || 'Failed to refresh domain status');
  }

  revalidatePath(`/sites/${projectId}/domains`);
  return response.json();
}
