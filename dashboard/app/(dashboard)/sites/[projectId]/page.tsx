/**
 * Site Detail Page
 *
 * Shows project details, deployments, and webhook configuration.
 *
 * Force dynamic rendering to always show latest deployment status.
 */
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getProject, getProjectDeployments } from "@/lib/aws/dynamodb";

// Disable caching - always fetch fresh deployment data
export const dynamic = "force-dynamic";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ projectId: string }>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-900/50 text-green-400 border-green-800",
    failed: "bg-red-900/50 text-red-400 border-red-800",
    building: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
    deploying: "bg-blue-900/50 text-blue-400 border-blue-800",
    pending: "bg-gray-900/50 text-gray-400 border-gray-700",
  };

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="h-3 w-3" />,
    failed: <XCircle className="h-3 w-3" />,
    building: <Loader2 className="h-3 w-3 animate-spin" />,
    deploying: <Loader2 className="h-3 w-3 animate-spin" />,
    pending: <Clock className="h-3 w-3" />,
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-full border ${styles[status] || styles.pending}`}
    >
      {icons[status]}
      {status}
    </span>
  );
}

export default async function SiteDetailPage({ params }: PageProps) {
  const session = await auth();
  const { projectId } = await params;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const project = await getProject(projectId);

  if (!project || project.userId !== session.user.id) {
    notFound();
  }

  const deployments = await getProjectDeployments(projectId, 10);

  // Webhook URL would be the API Gateway URL + /webhook
  const webhookUrl = process.env.API_GATEWAY_URL
    ? `${process.env.API_GATEWAY_URL}/webhook`
    : "Not configured";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/sites"
            className="inline-flex items-center text-gray-400 hover:text-white mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Sites
          </Link>
          <h1 className="text-2xl font-bold text-white">{project.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-gray-400">
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              {project.repoOwner}/{project.repoName}
              <ExternalLink className="h-3 w-3" />
            </a>
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-4 w-4" />
              {project.defaultBranch}
            </span>
          </div>
        </div>
      </div>

      {/* Webhook Configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Webhook Configuration
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Configure this webhook in your GitHub repository to enable automatic
          deployments.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Payload URL
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-gray-300 font-mono">
                {webhookUrl}
              </code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Secret
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-800 px-3 py-2 rounded text-sm text-gray-300 font-mono">
                {project.webhookSecret}
              </code>
              <CopyButton text={project.webhookSecret || ""} />
            </div>
          </div>

          <div className="text-sm text-gray-500">
            Content type: <code>application/json</code> | Events: Just the{" "}
            <code>push</code> event
          </div>
        </div>
      </div>

      {/* Deployments */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Deployments</h2>

        {deployments.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No deployments yet.</p>
            <p className="text-gray-500 text-sm mt-1">
              Configure the webhook above and push to your repository to trigger
              the first deployment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => (
              <div
                key={deployment.deploymentId}
                className="flex items-center justify-between p-4 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <StatusBadge status={deployment.status} />
                  <div>
                    <p className="text-white font-medium">
                      {deployment.commitMessage || "No commit message"}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {deployment.commitHash?.slice(0, 7)} by{" "}
                      {deployment.commitAuthor || "unknown"}
                    </p>
                  </div>
                </div>
                <div className="text-gray-500 text-sm">
                  {new Date(deployment.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
