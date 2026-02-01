/**
 * Environment Variables Page
 *
 * Allows users to view and manage environment variables for a site.
 * Changes are saved to the backend and require a new deployment to take effect.
 */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getEnvVars } from './actions';
import { EnvVarsForm } from '@/components/forms/env-vars-form';

interface EnvVarsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function EnvVarsPage({ params }: EnvVarsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { siteId } = await params;

  let envVars: { key: string; value: string; isSecret?: boolean }[] = [];
  let error: string | null = null;

  try {
    const data = await getEnvVars(siteId);
    envVars = data.envVars || [];
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load environment variables';
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Environment Variables</h1>
        <p className="text-muted-foreground mt-1">
          Configure environment variables for your site. Changes require a new deployment.
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
        <EnvVarsForm projectId={siteId} initialEnvVars={envVars} />
      )}
    </div>
  );
}
