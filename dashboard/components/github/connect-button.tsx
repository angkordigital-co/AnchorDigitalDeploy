"use client";

/**
 * GitHub Connect Button Component
 *
 * Shows connection status and allows connecting/disconnecting GitHub.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Github, Loader2, Check, X } from "lucide-react";

interface ConnectButtonProps {
  isConnected: boolean;
  username?: string;
  onDisconnect?: () => void;
  variant?: "default" | "compact";
}

export function GitHubConnectButton({
  isConnected,
  username,
  onDisconnect,
  variant = "default",
}: ConnectButtonProps) {
  const [disconnecting, setDisconnecting] = useState(false);

  async function handleDisconnect() {
    if (!confirm("Are you sure you want to disconnect your GitHub account?")) {
      return;
    }

    setDisconnecting(true);

    try {
      const response = await fetch("/api/github/disconnect", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to disconnect");
      }

      // Reload to refresh session
      if (onDisconnect) {
        onDisconnect();
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error("Failed to disconnect GitHub:", error);
      alert("Failed to disconnect GitHub. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  if (isConnected) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-green-400">
            <Check className="h-4 w-4" />
            <span>@{username}</span>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-gray-400 hover:text-red-400 transition-colors"
            title="Disconnect GitHub"
          >
            {disconnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center">
            <Github className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-medium">GitHub Connected</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-200">
                <Check className="h-3 w-3 mr-1" />
                Active
              </span>
            </div>
            <span className="text-gray-400 text-sm">@{username}</span>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="border-gray-700 text-gray-300 hover:text-red-400 hover:border-red-800"
        >
          {disconnecting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Disconnect
        </Button>
      </div>
    );
  }

  // Not connected
  if (variant === "compact") {
    return (
      <a href="/api/github/connect">
        <Button size="sm" className="bg-gray-800 hover:bg-gray-700 text-white">
          <Github className="h-4 w-4 mr-2" />
          Connect GitHub
        </Button>
      </a>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gray-800 flex items-center justify-center">
          <Github className="h-5 w-5 text-gray-400" />
        </div>
        <div>
          <span className="text-white font-medium">GitHub</span>
          <p className="text-gray-400 text-sm">Connect to import repositories</p>
        </div>
      </div>
      <a href="/api/github/connect">
        <Button className="bg-white text-black hover:bg-gray-200">
          <Github className="h-4 w-4 mr-2" />
          Connect
        </Button>
      </a>
    </div>
  );
}
