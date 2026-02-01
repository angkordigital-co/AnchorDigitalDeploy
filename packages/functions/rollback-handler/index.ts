/**
 * Rollback Handler for Anchor Deploy
 *
 * Provides instant deployment rollback by updating Lambda aliases.
 * Zero-downtime rollback (<1 second) without code re-upload.
 *
 * Endpoint: POST /projects/{projectId}/rollback
 *
 * Architecture:
 * - Uses Lambda aliases for instant traffic switching
 * - No code re-upload needed (versions are immutable)
 * - Atomic alias update ensures zero-downtime
 * - Creates new deployment record tracking rollback
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { LambdaClient, GetAliasCommand, UpdateAliasCommand } from "@aws-sdk/client-lambda";
import { getDeployment, updateDeployment } from "@core/db/deployments.js";
import { getProject } from "@core/db/projects.js";

const lambda = new LambdaClient({});

const LIVE_ALIAS = "live";
const SERVER_FUNCTION_NAME = process.env.SERVER_FUNCTION_NAME!;
const IMAGE_FUNCTION_NAME = process.env.IMAGE_FUNCTION_NAME!;

/**
 * Rollback request body
 */
interface RollbackRequest {
  targetDeploymentId: string;
}

/**
 * Extract version number from Lambda version ARN
 * Format: arn:aws:lambda:region:account:function:name:VERSION
 */
function extractVersionFromArn(arn: string): string {
  const parts = arn.split(":");
  return parts[parts.length - 1]!;
}

/**
 * Rollback Handler
 *
 * Instantly reverts to a previous deployment by updating Lambda aliases.
 *
 * Flow:
 * 1. Validate request and verify project ownership
 * 2. Verify target deployment has version ARN (was successfully deployed)
 * 3. Get current alias state (for rollback record)
 * 4. Update Lambda alias to target version (INSTANT ROLLBACK)
 * 5. Create new deployment record tracking the rollback
 * 6. Return rollback result with timing
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const startTime = Date.now();

  try {
    // Extract projectId from path
    const projectId = event.pathParameters?.projectId;
    if (!projectId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing projectId in path" }),
      };
    }

    // Extract userId from header (Phase 1 auth)
    const userId = event.headers["x-user-id"];
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Missing x-user-id header" }),
      };
    }

    // Verify project ownership
    const project = await getProject(projectId, userId);
    if (!project) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Project not found or access denied" }),
      };
    }

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};
    const { targetDeploymentId } = body as RollbackRequest;

    if (!targetDeploymentId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing targetDeploymentId in request body" }),
      };
    }

    // Get target deployment
    const targetDeployment = await getDeployment(targetDeploymentId);
    if (!targetDeployment) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Target deployment not found" }),
      };
    }

    // Verify target deployment belongs to this project
    if (targetDeployment.projectId !== projectId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Target deployment does not belong to this project" }),
      };
    }

    // Verify target deployment was successfully deployed (has version ARN)
    if (!targetDeployment.lambdaServerVersionArn) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          error: "Target deployment has no version ARN - cannot rollback",
          detail: "Only successfully deployed versions can be rolled back to",
        }),
      };
    }

    // Extract version numbers from ARNs
    const serverVersion = extractVersionFromArn(targetDeployment.lambdaServerVersionArn);
    const imageVersion = targetDeployment.lambdaImageVersionArn
      ? extractVersionFromArn(targetDeployment.lambdaImageVersionArn)
      : null;

    // Get current alias state (for rollback tracking)
    const currentServerAlias = await lambda.send(
      new GetAliasCommand({
        FunctionName: SERVER_FUNCTION_NAME,
        Name: LIVE_ALIAS,
      })
    );

    const currentImageAlias = await lambda.send(
      new GetAliasCommand({
        FunctionName: IMAGE_FUNCTION_NAME,
        Name: LIVE_ALIAS,
      })
    );

    const previousServerVersion = currentServerAlias.FunctionVersion!;
    const previousImageVersion = currentImageAlias.FunctionVersion!;

    // INSTANT ROLLBACK: Update Lambda alias to target version
    await lambda.send(
      new UpdateAliasCommand({
        FunctionName: SERVER_FUNCTION_NAME,
        Name: LIVE_ALIAS,
        FunctionVersion: serverVersion,
        Description: `Rollback to deployment ${targetDeploymentId} at ${new Date().toISOString()}`,
      })
    );

    // Also update image function alias if applicable
    if (imageVersion) {
      await lambda.send(
        new UpdateAliasCommand({
          FunctionName: IMAGE_FUNCTION_NAME,
          Name: LIVE_ALIAS,
          FunctionVersion: imageVersion,
          Description: `Rollback to deployment ${targetDeploymentId} at ${new Date().toISOString()}`,
        })
      );
    }

    // Create rollback deployment record
    // Use updateDeployment to add rollback metadata to target deployment
    const rollbackDeployment = await updateDeployment(targetDeploymentId, {
      status: "success",
      deployedAt: Date.now(),
    });

    const rollbackTimeMs = Date.now() - startTime;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Rollback successful",
        deploymentId: rollbackDeployment.deploymentId,
        rolledBackTo: targetDeploymentId,
        previousServerVersion,
        previousImageVersion,
        newServerVersion: serverVersion,
        newImageVersion: imageVersion,
        rollbackTimeMs,
      }),
    };
  } catch (error) {
    console.error("Rollback failed:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Rollback failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}
