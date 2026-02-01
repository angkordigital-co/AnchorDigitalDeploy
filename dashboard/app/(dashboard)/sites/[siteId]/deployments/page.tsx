/**
 * Deployments Page
 *
 * Shows deployment history for a site with rollback functionality.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getProjectDeployments } from "@/lib/aws/dynamodb";
import { DeploymentsTable } from "@/components/tables/deployments-table";

interface DeploymentsPageProps {
  params: Promise<{ siteId: string }>;
}

export default async function DeploymentsPage({ params }: DeploymentsPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { siteId } = await params;

  // Fetch deployment history (most recent first)
  const deployments = await getProjectDeployments(siteId, 50);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Deployment History</h2>
        <p className="text-gray-400 text-sm">
          View all deployments and rollback to previous versions.
        </p>
      </div>

      <DeploymentsTable data={deployments} projectId={siteId} />
    </div>
  );
}
