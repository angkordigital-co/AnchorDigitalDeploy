/**
 * Sites List Page
 *
 * Server component that displays all user's sites in a sortable table.
 * Fetches projects from DynamoDB using userId from session.
 *
 * Force dynamic rendering to always show latest deployment status.
 */
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserProjects, getProjectDeployments } from "@/lib/aws/dynamodb";

// Disable caching - always fetch fresh deployment data
export const dynamic = "force-dynamic";
import { SitesTable, SiteWithStatus } from "@/components/tables/sites-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function SitesPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Fetch user's projects
  const projects = await getUserProjects(session.user.id);

  // Fetch latest deployment for each project
  const sitesWithStatus: SiteWithStatus[] = await Promise.all(
    projects.map(async (project) => {
      const deployments = await getProjectDeployments(project.projectId, 1);
      return {
        ...project,
        latestDeployment: deployments[0] || undefined,
      };
    })
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sites</h1>
          <p className="text-gray-400 mt-1">
            Manage your deployed Next.js applications.
          </p>
        </div>
        <Link href="/sites/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Add Site
          </Button>
        </Link>
      </div>

      {/* Sites Table */}
      <SitesTable data={sitesWithStatus} />
    </div>
  );
}
