"use client";

/**
 * New Site Page
 *
 * Form to add a new site by providing name and GitHub repository URL.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewSitePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, repoUrl, defaultBranch }),
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

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
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

          {/* Repository URL */}
          <div className="space-y-2">
            <Label htmlFor="repoUrl" className="text-white">
              GitHub Repository URL
            </Label>
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
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Creating..." : "Create Site"}
          </Button>
        </div>
      </form>

      {/* Info Box */}
      <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-lg p-6">
        <h3 className="text-white font-medium mb-2">Next Steps</h3>
        <p className="text-gray-400 text-sm">
          After creating your site, you&apos;ll need to configure a GitHub webhook
          to trigger automatic deployments on push. The webhook URL and secret
          will be shown on the site settings page.
        </p>
      </div>
    </div>
  );
}
