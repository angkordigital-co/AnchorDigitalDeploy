import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import {
  CloudWatchLogsClient,
  GetLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

/**
 * Build Logs Handler
 *
 * Retrieves build logs from CloudWatch Logs for a deployment.
 * - GET /deployments/{deploymentId}/logs
 *
 * Flow:
 * 1. Get deployment record to find buildId
 * 2. Use buildId to construct CloudWatch log stream name
 * 3. Fetch log events from CloudWatch
 * 4. Return formatted log lines with timestamps
 *
 * Note: Phase 1 uses polling. Phase 3 will add WebSocket/SSE for real-time streaming.
 */

const dynamodb = new DynamoDBClient({});
const cloudwatch = new CloudWatchLogsClient({});

// CodeBuild log group name (matches infra/build-pipeline.ts)
const CODEBUILD_LOG_GROUP = "/aws/codebuild/anchor-deploy-nextjs-build";

interface APIGatewayProxyEventV2 {
  headers: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: {
    http: {
      method: string;
    };
  };
}

interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

interface Deployment {
  deploymentId: string;
  projectId: string;
  userId: string;
  status: string;
  buildId?: string;
}

interface LogEvent {
  timestamp: number;
  message: string;
}

/**
 * Get deployment by ID using GSI
 *
 * @param deploymentId - The deployment's unique ID
 * @returns Deployment if found, null otherwise
 */
async function getDeployment(deploymentId: string): Promise<Deployment | null> {
  const result = await dynamodb.send(
    new QueryCommand({
      TableName: process.env.DEPLOYMENTS_TABLE!,
      IndexName: "DeploymentIdIndex",
      KeyConditionExpression: "deploymentId = :deploymentId",
      ExpressionAttributeValues: {
        ":deploymentId": { S: deploymentId },
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    return null;
  }

  return unmarshall(item) as Deployment;
}

/**
 * Fetch logs from CloudWatch
 *
 * @param buildId - The CodeBuild build ID (used as log stream name)
 * @param nextToken - Token for pagination
 * @returns Log events and next token
 */
async function fetchCloudWatchLogs(
  buildId: string,
  nextToken?: string
): Promise<{ logs: LogEvent[]; nextForwardToken?: string }> {
  // CodeBuild log stream name format: <build-id>
  // The buildId from CodeBuild is like: anchor-deploy-nextjs-build:abcd1234-5678-90ab-cdef
  // The log stream name is the part after the colon
  const logStreamName = buildId.includes(":")
    ? buildId.split(":")[1]
    : buildId;

  try {
    const response = await cloudwatch.send(
      new GetLogEventsCommand({
        logGroupName: CODEBUILD_LOG_GROUP,
        logStreamName,
        startFromHead: true,
        limit: 1000, // Max 10000, but 1000 is reasonable for one request
        nextToken,
      })
    );

    const logs = (response.events ?? []).map((event) => ({
      timestamp: event.timestamp ?? 0,
      message: event.message ?? "",
    }));

    return {
      logs,
      nextForwardToken: response.nextForwardToken,
    };
  } catch (error) {
    // Log stream might not exist yet if build just started
    if (
      error instanceof Error &&
      error.name === "ResourceNotFoundException"
    ) {
      console.log("[LOGS] Log stream not found yet", { buildId, logStreamName });
      return { logs: [] };
    }
    throw error;
  }
}

/**
 * Lambda handler for build logs API
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const deploymentId = event.pathParameters?.deploymentId;
  const nextToken = event.queryStringParameters?.nextToken;

  if (!deploymentId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing deploymentId parameter" }),
    };
  }

  try {
    // Get deployment to find buildId
    const deployment = await getDeployment(deploymentId);

    if (!deployment) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Deployment not found" }),
      };
    }

    // Check if build has started
    if (!deployment.buildId) {
      console.log("[LOGS] Build not started yet", { deploymentId, status: deployment.status });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: [],
          status: deployment.status,
          message: "Build has not started yet",
        }),
      };
    }

    console.log("[LOGS] Fetching logs", {
      deploymentId,
      buildId: deployment.buildId,
      status: deployment.status,
    });

    // Fetch logs from CloudWatch
    const { logs, nextForwardToken } = await fetchCloudWatchLogs(
      deployment.buildId,
      nextToken
    );

    console.log("[LOGS] Retrieved logs", {
      deploymentId,
      count: logs.length,
      hasMore: !!nextForwardToken,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        logs,
        status: deployment.status,
        buildId: deployment.buildId,
        nextToken: nextForwardToken,
      }),
    };
  } catch (error) {
    console.error("[ERROR] Failed to fetch logs", {
      deploymentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch logs" }),
    };
  }
}
