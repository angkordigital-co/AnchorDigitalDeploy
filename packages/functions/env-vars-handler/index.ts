import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall, marshall } from "@aws-sdk/util-dynamodb";

import { UpdateEnvVarsSchema, type EnvVar } from "../../core/schemas/project.js";

/**
 * Environment Variables Handler
 *
 * Manages project environment variables via API endpoints:
 * - GET /projects/{projectId}/env - Get project environment variables
 * - PUT /projects/{projectId}/env - Update project environment variables
 *
 * Security:
 * - Verifies project ownership via userId
 * - userId hardcoded to 'test-user' for Phase 1
 * - Proper authentication added in Phase 3 (Dashboard)
 */

const dynamodb = new DynamoDBClient({});

interface APIGatewayProxyEventV2 {
  headers: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  requestContext: {
    http: {
      method: string;
    };
  };
  body?: string;
  isBase64Encoded?: boolean;
}

interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Get project with ownership verification
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request
 * @returns Project if found and owned by user, null otherwise
 */
async function getProject(
  projectId: string,
  userId: string
): Promise<{ projectId: string; userId: string; envVars: EnvVar[] } | null> {
  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: { projectId: { S: projectId } },
    })
  );

  if (!result.Item) {
    return null;
  }

  const item = unmarshall(result.Item);

  // Verify ownership (row-level security)
  if (item.userId !== userId) {
    return null;
  }

  return {
    projectId: item.projectId,
    userId: item.userId,
    envVars: (item.envVars as EnvVar[]) || [],
  };
}

/**
 * Update project environment variables
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request
 * @param envVars - New environment variables array
 */
async function setProjectEnvVars(
  projectId: string,
  userId: string,
  envVars: EnvVar[]
): Promise<void> {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: { projectId: { S: projectId } },
      UpdateExpression: "SET envVars = :envVars, updatedAt = :updatedAt",
      ConditionExpression: "userId = :userId",
      ExpressionAttributeValues: marshall(
        {
          ":envVars": envVars,
          ":updatedAt": new Date().toISOString(),
          ":userId": userId,
        },
        { removeUndefinedValues: true }
      ),
    })
  );
}

/**
 * Lambda handler for environment variables API
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId;
  const method = event.requestContext.http.method;

  // TODO: Phase 3 - Get userId from auth token
  // For now, use header or default to 'test-user'
  const userId = event.headers["x-user-id"] || "test-user";

  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing projectId parameter" }),
    };
  }

  try {
    if (method === "GET") {
      // GET /projects/{projectId}/env
      const project = await getProject(projectId, userId);

      if (!project) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Project not found or access denied" }),
        };
      }

      console.log("[GET] Environment variables retrieved", {
        projectId,
        count: project.envVars.length,
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ envVars: project.envVars }),
      };
    }

    if (method === "PUT") {
      // PUT /projects/{projectId}/env
      const body = event.isBase64Encoded
        ? Buffer.from(event.body ?? "", "base64").toString("utf8")
        : event.body ?? "";

      // Validate input with Zod
      let parsed;
      try {
        parsed = UpdateEnvVarsSchema.parse(JSON.parse(body));
      } catch (error) {
        console.error("[VALIDATION] Invalid env vars payload", { error, projectId });
        return {
          statusCode: 400,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            error: "Invalid payload",
            details: error instanceof Error ? error.message : "Validation failed",
          }),
        };
      }

      // Verify project exists and user owns it
      const project = await getProject(projectId, userId);
      if (!project) {
        return {
          statusCode: 404,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Project not found or access denied" }),
        };
      }

      // Update environment variables
      await setProjectEnvVars(projectId, userId, parsed.envVars);

      console.log("[PUT] Environment variables updated", {
        projectId,
        count: parsed.envVars.length,
        keys: parsed.envVars.map((ev) => ev.key),
      });

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      };
    }

    // Method not allowed
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (error) {
    console.error("[ERROR] Environment variables operation failed", {
      projectId,
      method,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
}
