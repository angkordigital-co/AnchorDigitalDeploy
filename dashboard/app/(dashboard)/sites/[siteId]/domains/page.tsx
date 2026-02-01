/**
 * Custom Domains Page
 *
 * Allows users to add, view, and manage custom domains for a site.
 * Shows DNS validation records for pending domains.
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDomains } from './actions';
import { AddDomainForm } from '@/components/forms/add-domain-form';
import { DomainsTable } from '@/components/tables/domains-table';

interface DomainsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function DomainsPage({ params }: DomainsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { siteId } = await params;

  let domains: Awaited<ReturnType<typeof getDomains>>['domains'] = [];
  let error: string | null = null;

  try {
    const data = await getDomains(siteId);
    domains = data.domains || [];
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load domains';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Custom Domains</h1>
        <p className="text-muted-foreground mt-1">
          Add and manage custom domains for your site. Each domain requires DNS configuration.
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-red-500/10 border border-red-500/20 p-4">
          <p className="text-red-400">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">
            Make sure the project exists and you have access to it.
          </p>
        </div>
      ) : (
        <>
          <AddDomainForm projectId={siteId} />
          <DomainsTable projectId={siteId} domains={domains} />
        </>
      )}
    </div>
  );
}
