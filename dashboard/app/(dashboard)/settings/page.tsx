"use client";

/**
 * Settings Page
 *
 * User settings including GitHub connection management.
 */
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GitHubConnectButton } from "@/components/github/connect-button";
import { AlertCircle, CheckCircle } from "lucide-react";

function SettingsContent() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();

  const githubStatus = searchParams.get("github");
  const error = searchParams.get("error");

  const hasGitHubConnection = session?.user?.hasGitHubConnection ?? false;
  const githubUsername = session?.user?.githubUsername;

  function handleDisconnect() {
    updateSession();
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your account and integrations.
        </p>
      </div>

      {/* Success/Error Messages */}
      {githubStatus === "connected" && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-200">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span>GitHub account connected successfully!</span>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>
            {error === "access_denied"
              ? "GitHub access was denied. Please try again."
              : error === "missing_code"
              ? "Authentication failed. Please try again."
              : error === "invalid_state"
              ? "Invalid request. Please try again."
              : error === "token_exchange_failed"
              ? "Failed to connect to GitHub. Please try again."
              : `Error: ${error}`}
          </span>
        </div>
      )}

      {/* Integrations Section */}
      <div className="space-y-6">
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">Integrations</h2>
          <div className="space-y-4">
            <GitHubConnectButton
              isConnected={hasGitHubConnection}
              username={githubUsername}
              onDisconnect={handleDisconnect}
            />
          </div>
        </section>

        {/* Account Section */}
        <section className="pt-6 border-t border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">{session?.user?.name}</div>
                <div className="text-gray-400 text-sm">{session?.user?.email}</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="text-gray-400">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
