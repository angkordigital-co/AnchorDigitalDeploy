/**
 * Metrics Page
 *
 * Displays Lambda function metrics using CloudWatch data.
 * Includes stats cards and interactive charts for invocations,
 * errors, and response time percentiles.
 */
import { getProject } from "@/lib/aws/dynamodb";
import {
  getLambdaMetrics,
  calculateMetricsSummary,
  formatMetricsForChart,
  type LambdaMetrics,
} from "@/lib/aws/cloudwatch";
import { StatsCards } from "@/components/charts/stats-cards";
import { MetricsChart } from "@/components/charts/metrics-chart";
import { MetricsTimeRange } from "./metrics-time-range";
import { notFound } from "next/navigation";

interface MetricsPageProps {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ range?: string }>;
}

// Time range options in hours
const TIME_RANGES: Record<string, number> = {
  "6h": 6,
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

export default async function MetricsPage({
  params,
  searchParams,
}: MetricsPageProps) {
  const { siteId } = await params;
  const { range = "24h" } = await searchParams;

  // Validate time range
  const hours = TIME_RANGES[range] || 24;

  // Get project to find Lambda function name
  const project = await getProject(siteId);

  if (!project) {
    notFound();
  }

  // Get Lambda function name
  const functionName =
    project.serverFunctionName || `anchor-deploy-dev-site-${siteId}-server`;

  // Fetch metrics
  const metrics: LambdaMetrics = await getLambdaMetrics(functionName, hours);
  const summary = calculateMetricsSummary(metrics);
  const chartData = formatMetricsForChart(metrics);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Performance Metrics
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Lambda function metrics from CloudWatch
          </p>
        </div>
        <MetricsTimeRange currentRange={range} />
      </div>

      {/* Stats Cards */}
      <StatsCards summary={summary} />

      {/* Charts */}
      <MetricsChart data={chartData} />

      {/* Function Info */}
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <span>Function:</span>
        <code className="bg-gray-800 px-2 py-1 rounded text-gray-300">
          {functionName}
        </code>
      </div>
    </div>
  );
}
