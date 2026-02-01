/**
 * Site Detail Layout
 *
 * Shared layout for all site detail pages.
 * Verifies project ownership and renders site nav.
 */
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getProject } from "@/lib/aws/dynamodb";
import { SiteNav } from "@/components/dashboard/site-nav";
import { ExternalLink, Github } from "lucide-react";
import Link from "next/link";

interface SiteLayoutProps {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}

export default async function SiteLayout({
  children,
  params,
}: SiteLayoutProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { siteId } = await params;
  const project = await getProject(siteId);

  // 404 if project doesn't exist
  if (!project) {
    notFound();
  }

  // 404 if user doesn't own the project (security check)
  if (project.userId !== session.user.id) {
    notFound();
  }

  return (
    <div className="space-y-4">
      {/* Site Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <Link
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <Github className="h-4 w-4" />
            {project.repoOwner}/{project.repoName}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <p className="text-gray-400 text-sm">
          Branch: <code className="bg-gray-800 px-2 py-0.5 rounded">{project.defaultBranch}</code>
        </p>
      </div>

      {/* Site Navigation */}
      <SiteNav siteId={siteId} />

      {/* Page Content */}
      {children}
    </div>
  );
}
