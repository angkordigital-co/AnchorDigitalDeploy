"use client";

/**
 * New Site Page
 *
 * Form to add a new site. Supports both:
 * - GitHub connected: Select repository from dropdown
 * - Manual: Paste GitHub URL
 */
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Github, ExternalLink } from "lucide-react";
import Link from "next/link";
import { RepoSelector } from "@/components/github/repo-selector";
import { GitHubConnectButton } from "@/components/github/connect-button";

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

export default function NewSitePage() {
  const router = useRouter();
  const { data: session, update: updateSession } = useSession();
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [autoWebhook, setAutoWebhook] = useState(true);
  const [useManualUrl, setUseManualUrl] = useState(false);

  const hasGitHubConnection = session?.user?.hasGitHubConnection ?? false;

  // When repo is selected, auto-fill fields
  useEffect(() => {
    if (selectedRepo) {
      setName(selectedRepo.name);
      setRepoUrl(selectedRepo.html_url);
      setDefaultBranch(selectedRepo.default_branch);
    }
  }, [selectedRepo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          repoUrl,
          defaultBranch,
          autoWebhook: hasGitHubConnection && autoWebhook && !useManualUrl,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create site");
      }

      const { project } = await response.json();
      router.push(`/sites/${project.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create site");
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    updateSession();
    setSelectedRepo(null);
    setUseManualUrl(true);
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/sites"
          className="inline-flex items-center text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sites
        </Link>
        <h1 className="text-2xl font-bold text-white">Add New Site</h1>
        <p className="text-gray-400 mt-1">
          Connect a GitHub repository to deploy your Next.js application.
        </p>
      </div>

      {/* GitHub Connection Banner */}
      {!hasGitHubConnection && (
        <div className="mb-6 p-4 bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-lg">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0">
              <Github className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-medium">Connect GitHub for easier setup</h3>
              <p className="text-gray-400 text-sm mt-1">
                Select repositories from a dropdown and auto-create webhooks.
              </p>
            </div>
            <a href="/api/github/connect">
              <Button className="bg-white text-black hover:bg-gray-200">
                Connect
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
          {/* Repository Selection */}
          {hasGitHubConnection && !useManualUrl ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-white">GitHub Repository</Label>
                  <button
                    type="button"
                    onClick={() => setUseManualUrl(true)}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Enter URL manually
                  </button>
                </div>
                <RepoSelector
                  onSelect={setSelectedRepo}
                  selectedRepo={selectedRepo}
                />
                <p className="text-sm text-gray-500">
                  Select a repository from your GitHub account.
                </p>
              </div>

              {/* Auto Webhook Checkbox */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="autoWebhook"
                  checked={autoWebhook}
                  onChange={(e) => setAutoWebhook(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-600"
                />
                <Label htmlFor="autoWebhook" className="text-white cursor-pointer">
                  Automatically create webhook for deployments
                </Label>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="repoUrl" className="text-white">
                  GitHub Repository URL
                </Label>
                {hasGitHubConnection && (
                  <button
                    type="button"
                    onClick={() => setUseManualUrl(false)}
                    className="text-sm text-gray-400 hover:text-white"
                  >
                    Select from GitHub
                  </button>
                )}
              </div>
              <Input
                id="repoUrl"
                type="text"
                placeholder="https://github.com/username/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                className="bg-gray-800 border-gray-700 text-white"
              />
              <p className="text-sm text-gray-500">
                The full URL to your GitHub repository.
              </p>
            </div>
          )}

          {/* Site Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">
              Site Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="my-awesome-site"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-sm text-gray-500">
              A friendly name to identify your site in the dashboard.
            </p>
          </div>

          {/* Default Branch */}
          <div className="space-y-2">
            <Label htmlFor="defaultBranch" className="text-white">
              Default Branch
            </Label>
            <Input
              id="defaultBranch"
              type="text"
              placeholder="main"
              value={defaultBranch}
              onChange={(e) => setDefaultBranch(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
            <p className="text-sm text-gray-500">
              The branch that will trigger production deployments.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Link href="/sites">
            <Button type="button" variant="outline" className="border-gray-700">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={loading || (!repoUrl && !selectedRepo)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Creating..." : "Create Site"}
          </Button>
        </div>
      </form>

      {/* Info Box */}
      {(!hasGitHubConnection || useManualUrl || !autoWebhook) && (
        <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-lg p-6">
          <h3 className="text-white font-medium mb-2">Next Steps</h3>
          <p className="text-gray-400 text-sm">
            After creating your site, you&apos;ll need to configure a GitHub webhook
            to trigger automatic deployments on push. The webhook URL and secret
            will be shown on the site settings page.
          </p>
        </div>
      )}

      {/* GitHub Connection Status */}
      {hasGitHubConnection && (
        <div className="mt-8">
          <GitHubConnectButton
            isConnected={true}
            username={session?.user?.githubUsername}
            onDisconnect={handleDisconnect}
            variant="compact"
          />
        </div>
      )}
    </div>
  );
}
