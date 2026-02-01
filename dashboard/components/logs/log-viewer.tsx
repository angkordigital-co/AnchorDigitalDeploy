/**
 * Log Viewer Component
 *
 * Interactive log viewer with time range selection, filtering, and auto-refresh.
 * Uses client-side state to manage log viewing and polling.
 */
"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseLogLevel, type LogEvent } from "@/lib/aws/cloudwatch-logs";

interface LogViewerProps {
  /**
   * Server action to fetch logs with given parameters
   */
  fetchLogs: (
    timeRange: string,
    filterPattern?: string
  ) => Promise<LogEvent[]>;
  /**
   * Initial logs to display (server-rendered)
   */
  initialLogs?: LogEvent[];
}

const TIME_RANGES = [
  { label: "1 hour", value: "1h", ms: 60 * 60 * 1000 },
  { label: "6 hours", value: "6h", ms: 6 * 60 * 60 * 1000 },
  { label: "24 hours", value: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7 days", value: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

const LOG_LEVEL_COLORS = {
  error: "text-red-400 bg-red-950/30",
  warn: "text-yellow-400 bg-yellow-950/30",
  info: "text-gray-300 bg-transparent",
  debug: "text-gray-500 bg-transparent",
};

export function LogViewer({ fetchLogs, initialLogs = [] }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEvent[]>(initialLogs);
  const [timeRange, setTimeRange] = useState("1h");
  const [filterPattern, setFilterPattern] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fetch logs with current filters
  const refreshLogs = useCallback(() => {
    startTransition(async () => {
      const newLogs = await fetchLogs(
        timeRange,
        filterPattern || undefined
      );
      setLogs(newLogs);
    });
  }, [fetchLogs, timeRange, filterPattern]);

  // Initial load and when filters change
  useEffect(() => {
    refreshLogs();
  }, [timeRange]); // Only auto-fetch on time range change

  // Auto-refresh every 5 seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      refreshLogs();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshLogs]);

  // Handle manual filter submit
  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    refreshLogs();
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Time range selector */}
        <div className="flex rounded-lg border border-gray-700 overflow-hidden">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setTimeRange(range.value)}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors",
                timeRange === range.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>

        {/* Filter input */}
        <form onSubmit={handleFilterSubmit} className="flex gap-2 flex-1">
          <Input
            type="text"
            placeholder="Filter logs (e.g., ERROR, request_id)..."
            value={filterPattern}
            onChange={(e) => setFilterPattern(e.target.value)}
            className="max-w-sm bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500"
          />
          <Button
            type="submit"
            variant="secondary"
            className="bg-gray-700 hover:bg-gray-600"
            disabled={isPending}
          >
            Filter
          </Button>
        </form>

        {/* Auto-refresh toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-gray-600 bg-gray-800 text-blue-600"
          />
          <span className="text-sm text-gray-300">Auto-refresh</span>
        </label>

        {/* Manual refresh button */}
        <Button
          onClick={refreshLogs}
          variant="outline"
          size="sm"
          disabled={isPending}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading...
            </span>
          ) : (
            "Refresh"
          )}
        </Button>
      </div>

      {/* Log entries */}
      <div className="border border-gray-700 rounded-lg overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {isPending ? (
              <p>Loading logs...</p>
            ) : (
              <div>
                <p className="text-lg font-medium">No logs found</p>
                <p className="text-sm mt-1">
                  Logs will appear here once your application generates them.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800 max-h-[600px] overflow-y-auto font-mono text-sm">
            {logs.map((log, index) => {
              const level = parseLogLevel(log.message);
              return (
                <div
                  key={`${log.timestamp}-${index}`}
                  className={cn(
                    "p-3 hover:bg-gray-800/50 transition-colors",
                    LOG_LEVEL_COLORS[level]
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Timestamp */}
                    <span className="text-gray-500 whitespace-nowrap shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {/* Log level badge */}
                    <span
                      className={cn(
                        "uppercase text-xs font-semibold px-1.5 py-0.5 rounded shrink-0",
                        level === "error" && "bg-red-900/50 text-red-400",
                        level === "warn" && "bg-yellow-900/50 text-yellow-400",
                        level === "info" && "bg-gray-700 text-gray-300",
                        level === "debug" && "bg-gray-800 text-gray-500"
                      )}
                    >
                      {level}
                    </span>
                    {/* Message */}
                    <pre className="flex-1 whitespace-pre-wrap break-all text-gray-100">
                      {log.message}
                    </pre>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log count */}
      {logs.length > 0 && (
        <p className="text-sm text-gray-500">
          Showing {logs.length} log entries
        </p>
      )}
    </div>
  );
}
