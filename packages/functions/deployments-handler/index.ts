import { Resource } from "sst";
import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

/**
 * Deployments Handler
 *
 * Lists deployment history for a project.
 * Returns commit SHA and message for GIT-04 requirement.
 *
 * Authentication:
 * - For now, accepts userId from x-user-id header
 * - Full auth implementation in Phase 2
 *
 * Row-level security:
 * - Verifies project ownership before returning deployments
 */

const dynamodb = new DynamoDBClient({});

interface APIGatewayProxyEventV2 {
  headers: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  queryStringParameters?: Record<string, string | undefined>;
}

interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

interface DeploymentResponse {
  deploymentId: string;
  commitSha: string;
  commitMessage?: string;
  status: string;
  createdAt: string;
  endedAt?: string;
  author?: {
    name: string;
    email: string;
  };
}

/**
 * Lambda handler for deployment history retrieval
 *
 * GET /projects/{projectId}/deployments
 *
 * Query params:
 * - limit: Number of deployments to return (default 50, max 100)
 *
 * Headers:
 * - x-user-id: User ID for authorization (temporary until full auth)
 *
 * Response:
 * - 200: List of deployments
 * - 400: Missing parameters
 * - 401: Missing user ID
 * - 404: Project not found or access denied
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId;

  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing projectId parameter" }),
    };
  }

  // Extract userId from header (temporary auth mechanism)
  const userId = event.headers["x-user-id"];

  if (!userId) {
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing x-user-id header" }),
    };
  }

  // Parse limit parameter
  const limitParam = event.queryStringParameters?.limit;
  let limit = 50;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 100) {
      limit = parsed;
    }
  }

  // Verify project exists and user has access
  const projectResult = await dynamodb.send(
    new GetItemCommand({
      TableName: Resource.Projects.name,
      Key: marshall({ projectId }),
    })
  );

  if (!projectResult.Item) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Project not found" }),
    };
  }

  const project = unmarshall(projectResult.Item);

  // Row-level security: verify ownership
  if (project.userId !== userId) {
    // Return 404 to prevent information leakage
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Project not found" }),
    };
  }

  // Query deployments for this project
  const deploymentsResult = await dynamodb.send(
    new QueryCommand({
      TableName: Resource.Deployments.name,
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: marshall({
        ":projectId": projectId,
      }),
      ScanIndexForward: false, // Newest first
      Limit: limit,
    })
  );

  // Format response (GIT-04: include commit SHA and message)
  const deployments: DeploymentResponse[] = (
    deploymentsResult.Items ?? []
  ).map((item) => {
    const deployment = unmarshall(item);
    return {
      deploymentId: deployment.deploymentId,
      commitSha: deployment.commitSha,
      commitMessage: deployment.commitMessage,
      status: deployment.status,
      createdAt: deployment.createdAt,
      endedAt: deployment.endedAt,
      author: deployment.commitAuthor,
    };
  });

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deployments }),
  };
}
