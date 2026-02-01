/**
 * Stats Cards Component
 *
 * Display summary statistics for Lambda metrics.
 * Shows total requests, error rate, and average response times.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetricsSummary } from "@/lib/aws/cloudwatch";

interface StatsCardsProps {
  summary: MetricsSummary;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toFixed(0);
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return (ms / 1000).toFixed(2) + "s";
  }
  return ms.toFixed(0) + "ms";
}

export function StatsCards({ summary }: StatsCardsProps) {
  // Determine error rate color
  const errorRateColor =
    summary.errorRate < 1
      ? "text-green-400"
      : summary.errorRate < 5
      ? "text-yellow-400"
      : "text-red-400";

  // Determine background based on error rate
  const errorRateBg =
    summary.errorRate < 1
      ? "bg-green-950/30 border-green-800/30"
      : summary.errorRate < 5
      ? "bg-yellow-950/30 border-yellow-800/30"
      : "bg-red-950/30 border-red-800/30";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Requests */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Total Requests
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-blue-400"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatNumber(summary.totalInvocations)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Lambda invocations</p>
        </CardContent>
      </Card>

      {/* Error Rate */}
      <Card className={cn("border", errorRateBg)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            Error Rate
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-4 w-4", errorRateColor)}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className={cn("text-2xl font-bold", errorRateColor)}>
            {summary.errorRate.toFixed(2)}%
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {formatNumber(summary.totalErrors)} total errors
          </p>
        </CardContent>
      </Card>

      {/* P50 Response Time */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            p50 Duration
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-purple-400"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatDuration(summary.avgDurationP50)}
          </div>
          <p className="text-xs text-gray-500 mt-1">Median response time</p>
        </CardContent>
      </Card>

      {/* P95 Response Time */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-400">
            p95 Duration
          </CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4 text-orange-400"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">
            {formatDuration(summary.avgDurationP95)}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            p99: {formatDuration(summary.avgDurationP99)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
