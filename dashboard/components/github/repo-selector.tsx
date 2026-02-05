"use client";

/**
 * Repository Selector Component
 *
 * Dropdown to select a GitHub repository from user's connected account.
 */
import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { ChevronDown, Search, Lock, Globe, Loader2, RefreshCw } from "lucide-react";

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

interface RepoSelectorProps {
  onSelect: (repo: GitHubRepo) => void;
  selectedRepo?: GitHubRepo | null;
}

export function RepoSelector({ onSelect, selectedRepo }: RepoSelectorProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch repos on mount
  useEffect(() => {
    fetchRepos();
  }, []);

  // Filter repos when search changes
  useEffect(() => {
    if (!searchQuery) {
      setFilteredRepos(repos);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepos(
        repos.filter((repo) => repo.full_name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, repos]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchRepos() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/github/repos");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch repositories");
      }

      setRepos(data.repos);
      setFilteredRepos(data.repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repositories");
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(repo: GitHubRepo) {
    onSelect(repo);
    setIsOpen(false);
    setSearchQuery("");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 bg-gray-800 border border-gray-700 rounded-md text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading repositories...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between h-9 px-3 bg-red-900/20 border border-red-800 rounded-md text-red-200">
        <span className="text-sm">{error}</span>
        <button
          type="button"
          onClick={fetchRepos}
          className="hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-9 px-3 bg-gray-800 border border-gray-700 rounded-md text-left hover:border-gray-600 transition-colors"
      >
        {selectedRepo ? (
          <span className="flex items-center gap-2 text-white">
            {selectedRepo.private ? (
              <Lock className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <Globe className="h-3.5 w-3.5 text-gray-400" />
            )}
            {selectedRepo.full_name}
          </span>
        ) : (
          <span className="text-gray-400">Select a repository...</span>
        )}
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-900 border border-gray-700 rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search repositories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-gray-800 border-gray-700 text-white h-8"
                autoFocus
              />
            </div>
          </div>

          {/* Repo List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-400 text-sm">
                {searchQuery ? "No repositories match your search" : "No repositories found"}
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => handleSelect(repo)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-gray-800 transition-colors"
                >
                  {repo.private ? (
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{repo.full_name}</div>
                    <div className="text-gray-500 text-xs">
                      Default branch: {repo.default_branch}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer with count */}
          <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-500">
            {filteredRepos.length} of {repos.length} repositories
          </div>
        </div>
      )}
    </div>
  );
}
