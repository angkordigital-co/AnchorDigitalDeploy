/**
 * Error Summary Component
 *
 * Displays aggregated error types from CloudWatch Logs.
 * Shows top 10 error types with counts as cards.
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErrorAggregation } from "@/lib/aws/cloudwatch-logs";

interface ErrorSummaryProps {
  /**
   * Aggregated error data from CloudWatch Logs Insights
   */
  errors: ErrorAggregation[];
  /**
   * Optional callback when an error type is clicked
   */
  onErrorClick?: (errorType: string) => void;
}

export function ErrorSummary({ errors, onErrorClick }: ErrorSummaryProps) {
  if (errors.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">
            Error Summary (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-green-950/30 rounded-lg border border-green-800/30">
            <div className="w-10 h-10 rounded-full bg-green-900/50 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-green-400"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-green-400">No errors detected</p>
              <p className="text-sm text-gray-400">
                No errors found in the last 24 hours.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg text-gray-100">
          Error Summary (24h)
        </CardTitle>
        <div className="text-sm text-gray-400">
          {totalErrors} total errors
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {errors.map((error) => {
            const percentage = Math.round((error.count / totalErrors) * 100);
            return (
              <button
                key={error.errorType}
                onClick={() => onErrorClick?.(error.errorType)}
                className="flex items-center gap-4 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 transition-colors text-left w-full group"
              >
                {/* Error type icon */}
                <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-5 h-5 text-red-400"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>

                {/* Error details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-red-400 truncate">
                      {error.errorType}
                    </span>
                    <span className="text-sm font-medium text-gray-100 shrink-0">
                      {error.count}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Click indicator */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            );
          })}
        </div>

        {onErrorClick && (
          <p className="mt-4 text-xs text-gray-500 text-center">
            Click an error type to filter logs
          </p>
        )}
      </CardContent>
    </Card>
  );
}
