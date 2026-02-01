/**
 * Logs Page
 *
 * Displays runtime logs from Lambda function CloudWatch Logs.
 * Includes log viewer with filtering and error aggregation summary.
 */
import { getProject } from "@/lib/aws/dynamodb";
import {
  getLogs,
  getErrorAggregation,
  type LogEvent,
} from "@/lib/aws/cloudwatch-logs";
import { LogViewer } from "@/components/logs/log-viewer";
import { ErrorSummary } from "@/components/logs/error-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notFound } from "next/navigation";

interface LogsPageProps {
  params: Promise<{ siteId: string }>;
}

// Time range in milliseconds
const TIME_RANGE_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

/**
 * Server action to fetch logs with given time range and filter
 */
async function fetchLogsAction(
  logGroupName: string,
  timeRange: string,
  filterPattern?: string
): Promise<LogEvent[]> {
  "use server";

  const now = Date.now();
  const rangeMs = TIME_RANGE_MS[timeRange] || TIME_RANGE_MS["1h"];
  const startTime = now - rangeMs;

  return getLogs(logGroupName, startTime, now, filterPattern);
}

export default async function LogsPage({ params }: LogsPageProps) {
  const { siteId } = await params;

  // Get project to find Lambda function name
  const project = await getProject(siteId);

  if (!project) {
    notFound();
  }

  // Lambda log group name follows AWS naming convention
  // If serverFunctionName is stored, use it; otherwise construct from project ID
  const functionName = project.serverFunctionName || `anchor-deploy-dev-site-${siteId}-server`;
  const logGroupName = `/aws/lambda/${functionName}`;

  // Fetch initial data in parallel
  const [initialLogs, errorAggregation] = await Promise.all([
    getLogs(logGroupName, Date.now() - TIME_RANGE_MS["1h"], Date.now()),
    getErrorAggregation(logGroupName, 24),
  ]);

  // Create server action with bound log group name
  const fetchLogs = async (
    timeRange: string,
    filterPattern?: string
  ): Promise<LogEvent[]> => {
    "use server";
    return fetchLogsAction(logGroupName, timeRange, filterPattern);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Runtime Logs</h2>
          <p className="text-sm text-gray-400 mt-1">
            Logs from your Lambda function
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Log group: <code className="bg-gray-800 px-2 py-1 rounded text-gray-300">{logGroupName}</code>
        </div>
      </div>

      {/* Error Summary Card */}
      <ErrorSummary errors={errorAggregation} />

      {/* Log Viewer */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">Log Stream</CardTitle>
        </CardHeader>
        <CardContent>
          <LogViewer fetchLogs={fetchLogs} initialLogs={initialLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
