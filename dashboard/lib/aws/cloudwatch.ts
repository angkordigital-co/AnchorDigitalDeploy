/**
 * CloudWatch Metrics Service
 *
 * Provides functions to fetch Lambda metrics from AWS CloudWatch.
 * Includes invocations, errors, and duration percentiles (p50, p95, p99).
 */
import {
  CloudWatchClient,
  GetMetricDataCommand,
  type MetricDataResult,
} from "@aws-sdk/client-cloudwatch";

const cloudwatch = new CloudWatchClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
}

export interface LambdaMetrics {
  invocations: MetricDataPoint[];
  errors: MetricDataPoint[];
  durationP50: MetricDataPoint[];
  durationP95: MetricDataPoint[];
  durationP99: MetricDataPoint[];
}

export interface MetricsSummary {
  totalInvocations: number;
  totalErrors: number;
  errorRate: number;
  avgDurationP50: number;
  avgDurationP95: number;
  avgDurationP99: number;
}

/**
 * Fetch Lambda metrics for a function
 *
 * @param functionName - Lambda function name
 * @param hours - Number of hours to look back (default 24)
 * @returns Metrics data including invocations, errors, and duration percentiles
 */
export async function getLambdaMetrics(
  functionName: string,
  hours: number = 24
): Promise<LambdaMetrics> {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - hours * 60 * 60 * 1000);

  // Determine period based on time range
  // Use 1 minute for up to 6 hours, 5 minutes for up to 24 hours, 1 hour for longer
  const period = hours <= 6 ? 60 : hours <= 24 ? 300 : 3600;

  const command = new GetMetricDataCommand({
    MetricDataQueries: [
      {
        Id: "invocations",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName: "Invocations",
            Dimensions: [{ Name: "FunctionName", Value: functionName }],
          },
          Period: period,
          Stat: "Sum",
        },
      },
      {
        Id: "errors",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName: "Errors",
            Dimensions: [{ Name: "FunctionName", Value: functionName }],
          },
          Period: period,
          Stat: "Sum",
        },
      },
      {
        Id: "duration_p50",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName: "Duration",
            Dimensions: [{ Name: "FunctionName", Value: functionName }],
          },
          Period: period,
          Stat: "p50",
        },
      },
      {
        Id: "duration_p95",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName: "Duration",
            Dimensions: [{ Name: "FunctionName", Value: functionName }],
          },
          Period: period,
          Stat: "p95",
        },
      },
      {
        Id: "duration_p99",
        MetricStat: {
          Metric: {
            Namespace: "AWS/Lambda",
            MetricName: "Duration",
            Dimensions: [{ Name: "FunctionName", Value: functionName }],
          },
          Period: period,
          Stat: "p99",
        },
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
  });

  try {
    const response = await cloudwatch.send(command);
    const results = response.MetricDataResults || [];

    // Convert CloudWatch results to our format
    const toDataPoints = (result: MetricDataResult | undefined): MetricDataPoint[] => {
      if (!result?.Timestamps || !result?.Values) return [];

      return result.Timestamps.map((timestamp, index) => ({
        timestamp: new Date(timestamp),
        value: result.Values?.[index] || 0,
      })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    };

    return {
      invocations: toDataPoints(results.find((r) => r.Id === "invocations")),
      errors: toDataPoints(results.find((r) => r.Id === "errors")),
      durationP50: toDataPoints(results.find((r) => r.Id === "duration_p50")),
      durationP95: toDataPoints(results.find((r) => r.Id === "duration_p95")),
      durationP99: toDataPoints(results.find((r) => r.Id === "duration_p99")),
    };
  } catch (error) {
    console.error("Error fetching Lambda metrics:", error);
    return {
      invocations: [],
      errors: [],
      durationP50: [],
      durationP95: [],
      durationP99: [],
    };
  }
}

/**
 * Calculate summary statistics from metrics data
 */
export function calculateMetricsSummary(metrics: LambdaMetrics): MetricsSummary {
  const sum = (arr: MetricDataPoint[]) =>
    arr.reduce((acc, p) => acc + p.value, 0);

  const avg = (arr: MetricDataPoint[]) =>
    arr.length > 0 ? sum(arr) / arr.length : 0;

  const totalInvocations = sum(metrics.invocations);
  const totalErrors = sum(metrics.errors);
  const errorRate =
    totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0;

  return {
    totalInvocations,
    totalErrors,
    errorRate,
    avgDurationP50: avg(metrics.durationP50),
    avgDurationP95: avg(metrics.durationP95),
    avgDurationP99: avg(metrics.durationP99),
  };
}

/**
 * Format chart data for Recharts
 * Combines all metrics into a single array with timestamp as x-axis
 */
export function formatMetricsForChart(
  metrics: LambdaMetrics
): Array<{
  time: string;
  timestamp: number;
  invocations: number;
  errors: number;
  durationP50: number;
  durationP95: number;
  durationP99: number;
}> {
  // Create a map of all timestamps
  const timestampMap = new Map<
    number,
    {
      invocations: number;
      errors: number;
      durationP50: number;
      durationP95: number;
      durationP99: number;
    }
  >();

  // Helper to add data points to map
  const addPoints = (
    points: MetricDataPoint[],
    key: "invocations" | "errors" | "durationP50" | "durationP95" | "durationP99"
  ) => {
    for (const point of points) {
      const ts = point.timestamp.getTime();
      if (!timestampMap.has(ts)) {
        timestampMap.set(ts, {
          invocations: 0,
          errors: 0,
          durationP50: 0,
          durationP95: 0,
          durationP99: 0,
        });
      }
      timestampMap.get(ts)![key] = point.value;
    }
  };

  addPoints(metrics.invocations, "invocations");
  addPoints(metrics.errors, "errors");
  addPoints(metrics.durationP50, "durationP50");
  addPoints(metrics.durationP95, "durationP95");
  addPoints(metrics.durationP99, "durationP99");

  // Sort by timestamp and format
  return Array.from(timestampMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, values]) => ({
      time: new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp,
      ...values,
    }));
}
