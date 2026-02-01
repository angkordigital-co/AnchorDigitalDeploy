/**
 * CloudWatch Logs Service
 *
 * Provides functions to fetch and query Lambda logs using AWS CloudWatch Logs.
 * Uses FilterLogEvents for recent logs and Logs Insights for error aggregation.
 */
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
  StartQueryCommand,
  GetQueryResultsCommand,
  type FilteredLogEvent,
} from "@aws-sdk/client-cloudwatch-logs";

const logs = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});

export interface LogEvent {
  timestamp: number;
  message: string;
  logStreamName?: string;
}

export interface ErrorAggregation {
  errorType: string;
  count: number;
}

/**
 * Fetch logs from a CloudWatch log group
 *
 * @param logGroupName - Log group name (e.g., /aws/lambda/function-name)
 * @param startTime - Start time in milliseconds
 * @param endTime - End time in milliseconds
 * @param filterPattern - Optional filter pattern for log messages
 * @returns Array of log events
 */
export async function getLogs(
  logGroupName: string,
  startTime: number,
  endTime: number,
  filterPattern?: string
): Promise<LogEvent[]> {
  try {
    const command = new FilterLogEventsCommand({
      logGroupName,
      startTime,
      endTime,
      filterPattern: filterPattern || undefined,
      limit: 100,
    });

    const response = await logs.send(command);
    const events = response.events || [];

    return events.map((event: FilteredLogEvent) => ({
      timestamp: event.timestamp || 0,
      message: event.message || "",
      logStreamName: event.logStreamName,
    }));
  } catch (error) {
    // Log group may not exist for new projects
    console.error("Error fetching logs:", error);
    return [];
  }
}

/**
 * Get aggregation of error types using CloudWatch Logs Insights
 *
 * Queries logs for ERROR patterns and aggregates by error type.
 * Uses Logs Insights query API which is asynchronous (start + poll).
 *
 * @param logGroupName - Log group name
 * @param hours - Number of hours to look back (default 24)
 * @returns Array of error type counts
 */
export async function getErrorAggregation(
  logGroupName: string,
  hours: number = 24
): Promise<ErrorAggregation[]> {
  const endTime = Date.now();
  const startTime = endTime - hours * 60 * 60 * 1000;

  // Logs Insights query to extract and count error types
  const query = `
    fields @timestamp, @message
    | filter @message like /ERROR|Exception|error/
    | parse @message /(?<errorType>[A-Za-z]+Error|Exception)/
    | stats count(*) as count by errorType
    | sort count desc
    | limit 10
  `;

  try {
    // Start the async query
    const startCommand = new StartQueryCommand({
      logGroupName,
      startTime: Math.floor(startTime / 1000),
      endTime: Math.floor(endTime / 1000),
      queryString: query,
    });

    const { queryId } = await logs.send(startCommand);

    if (!queryId) {
      return [];
    }

    // Poll for results (max 10 attempts, 1 second apart)
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1000));

      const getCommand = new GetQueryResultsCommand({ queryId });
      const response = await logs.send(getCommand);

      if (response.status === "Complete") {
        return (
          response.results?.map((row) => ({
            errorType:
              row.find((f) => f.field === "errorType")?.value || "Unknown",
            count: parseInt(
              row.find((f) => f.field === "count")?.value || "0"
            ),
          })) || []
        );
      }

      if (response.status === "Failed" || response.status === "Cancelled") {
        console.error("Logs Insights query failed:", response.status);
        return [];
      }
    }

    // Query timed out
    console.warn("Logs Insights query timed out");
    return [];
  } catch (error) {
    // Log group may not exist or no permissions
    console.error("Error aggregating errors:", error);
    return [];
  }
}

/**
 * Parse log level from a log message
 *
 * @param message - Log message text
 * @returns Log level (error, warn, info, debug)
 */
export function parseLogLevel(
  message: string
): "error" | "warn" | "info" | "debug" {
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("error") ||
    lowerMessage.includes("exception") ||
    lowerMessage.includes("fatal")
  ) {
    return "error";
  }
  if (lowerMessage.includes("warn")) {
    return "warn";
  }
  if (lowerMessage.includes("debug") || lowerMessage.includes("trace")) {
    return "debug";
  }
  return "info";
}
