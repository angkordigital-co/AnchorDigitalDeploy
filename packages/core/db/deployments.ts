import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

import { docClient, DEPLOYMENTS_TABLE } from "./client.js";
import {
  DeploymentSchema,
  CreateDeploymentSchema,
  UpdateDeploymentSchema,
  type Deployment,
  type CreateDeploymentInput,
  type UpdateDeploymentInput,
} from "../schemas/deployment.js";
import { getProject } from "./projects.js";

/**
 * Deployments Data Access Layer
 *
 * All operations verify project ownership via userId.
 * Deployments inherit tenant isolation from their parent project.
 */

/**
 * Create a new deployment
 *
 * Auto-generates: deploymentId, createdAt, status (queued)
 * Verifies project ownership before creating deployment.
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @param commitSha - The Git commit SHA being deployed
 * @param metadata - Additional metadata (commitMessage)
 * @returns The created deployment
 * @throws Error if project not found or not owned by user
 */
export async function createDeployment(
  projectId: string,
  userId: string,
  commitSha: string,
  metadata?: { commitMessage?: string }
): Promise<Deployment> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Verify project ownership first
  const project = await getProject(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  // Validate input
  const validatedInput = CreateDeploymentSchema.parse({
    projectId,
    commitSha,
    commitMessage: metadata?.commitMessage,
  });

  const now = new Date().toISOString();
  const deployment: Deployment = {
    deploymentId: nanoid(),
    userId, // Inherited from project owner for tenant isolation
    status: "queued",
    ...validatedInput,
    createdAt: now,
  };

  // Validate full deployment before saving
  const validatedDeployment = DeploymentSchema.parse(deployment);

  await docClient.send(
    new PutCommand({
      TableName: DEPLOYMENTS_TABLE,
      Item: validatedDeployment,
    })
  );

  return validatedDeployment;
}

/**
 * Get a deployment by ID
 *
 * Uses DeploymentIdIndex GSI for efficient lookup.
 *
 * @param deploymentId - The deployment's unique ID
 * @returns The deployment if found, null otherwise
 */
export async function getDeployment(
  deploymentId: string
): Promise<Deployment | null> {
  if (!deploymentId) {
    throw new Error("deploymentId is required");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      IndexName: "DeploymentIdIndex",
      KeyConditionExpression: "deploymentId = :deploymentId",
      ExpressionAttributeValues: {
        ":deploymentId": deploymentId,
      },
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    return null;
  }

  return DeploymentSchema.parse(item);
}

/**
 * Get a deployment by ID with user verification
 *
 * @param deploymentId - The deployment's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @returns The deployment if found and owned by user, null otherwise
 */
export async function getDeploymentForUser(
  deploymentId: string,
  userId: string
): Promise<Deployment | null> {
  if (!deploymentId || !userId) {
    throw new Error("deploymentId and userId are required");
  }

  const deployment = await getDeployment(deploymentId);

  // Verify ownership (row-level security)
  if (!deployment || deployment.userId !== userId) {
    return null;
  }

  return deployment;
}

/**
 * List all deployments for a project
 *
 * Verifies project ownership before listing.
 * Returns deployments sorted by creation time (newest first via SK).
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @param limit - Maximum number of deployments to return (default 50)
 * @returns Array of deployments for the project
 * @throws Error if project not found or not owned by user
 */
export async function listProjectDeployments(
  projectId: string,
  userId: string,
  limit = 50
): Promise<Deployment[]> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Verify project ownership first
  const project = await getProject(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: {
        ":projectId": projectId,
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => DeploymentSchema.parse(item));
}

/**
 * Update deployment status
 *
 * Simplified status update for build orchestrator.
 *
 * @param deploymentId - The deployment's unique ID
 * @param status - The new status
 * @returns The updated deployment
 * @throws Error if deployment not found
 */
export async function updateDeploymentStatus(
  deploymentId: string,
  status: Deployment["status"]
): Promise<Deployment> {
  // Get deployment to find projectId (needed for composite key)
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  const isTerminal = ["success", "failed", "cancelled"].includes(status);

  const result = await docClient.send(
    new UpdateCommand({
      TableName: DEPLOYMENTS_TABLE,
      Key: {
        projectId: deployment.projectId,
        deploymentId: deployment.deploymentId,
      },
      UpdateExpression: isTerminal
        ? "SET #status = :status, #endedAt = :endedAt"
        : "SET #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
        ...(isTerminal && { "#endedAt": "endedAt" }),
      },
      ExpressionAttributeValues: {
        ":status": status,
        ...(isTerminal && { ":endedAt": new Date().toISOString() }),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    throw new Error("Failed to update deployment");
  }

  return DeploymentSchema.parse(result.Attributes);
}

/**
 * Update deployment with arbitrary fields
 *
 * Used by build orchestrator to update buildId, error, artifactPath, etc.
 *
 * @param deploymentId - The deployment's unique ID
 * @param fields - Fields to update
 * @returns The updated deployment
 * @throws Error if deployment not found
 */
export async function updateDeployment(
  deploymentId: string,
  fields: UpdateDeploymentInput
): Promise<Deployment> {
  // Get deployment to find projectId (needed for composite key)
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  // Validate input
  const validatedFields = UpdateDeploymentSchema.parse(fields);

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(validatedFields)) {
    if (value !== undefined) {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    }
  }

  if (updateExpressions.length === 0) {
    return deployment;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: DEPLOYMENTS_TABLE,
      Key: {
        projectId: deployment.projectId,
        deploymentId: deployment.deploymentId,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    throw new Error("Failed to update deployment");
  }

  return DeploymentSchema.parse(result.Attributes);
}

/**
 * List deployments for a user across all projects
 *
 * Uses UserIdIndex GSI for efficient querying.
 *
 * @param userId - The user's unique ID
 * @param limit - Maximum number of deployments to return (default 50)
 * @returns Array of recent deployments across all user's projects
 */
export async function listUserDeployments(
  userId: string,
  limit = 50
): Promise<Deployment[]> {
  if (!userId) {
    throw new Error("userId is required");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => DeploymentSchema.parse(item));
}

/**
 * Get the currently active deployment for a project
 *
 * Returns the most recent successful deployment.
 * Used to determine which version is currently serving traffic.
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @returns The active deployment, or null if no successful deployments
 */
export async function getActiveDeployment(
  projectId: string,
  userId: string
): Promise<Deployment | null> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Verify project ownership first
  const project = await getProject(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  // Query for successful deployments, get the most recent
  const result = await docClient.send(
    new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      KeyConditionExpression: "projectId = :projectId",
      FilterExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":projectId": projectId,
        ":status": "success",
      },
      ScanIndexForward: false, // Newest first
      Limit: 1,
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    return null;
  }

  return DeploymentSchema.parse(item);
}

/**
 * Update deployment with version data after deployment to CloudFront
 *
 * Sets Lambda version ARNs, static assets path, version string, and deployedAt timestamp.
 *
 * @param deploymentId - The deployment's unique ID
 * @param versionData - Version tracking data from deployment process
 * @returns The updated deployment
 */
export async function setDeploymentVersion(
  deploymentId: string,
  versionData: {
    lambdaServerVersionArn: string;
    lambdaImageVersionArn: string;
    staticAssetsPath: string;
    version: string;
    cloudfrontInvalidationId?: string;
  }
): Promise<Deployment> {
  // Get deployment to find projectId (needed for composite key)
  const deployment = await getDeployment(deploymentId);
  if (!deployment) {
    throw new Error("Deployment not found");
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: DEPLOYMENTS_TABLE,
      Key: {
        projectId: deployment.projectId,
        deploymentId: deployment.deploymentId,
      },
      UpdateExpression:
        "SET #lambdaServerVersionArn = :lambdaServerVersionArn, #lambdaImageVersionArn = :lambdaImageVersionArn, #staticAssetsPath = :staticAssetsPath, #version = :version, #deployedAt = :deployedAt" +
        (versionData.cloudfrontInvalidationId
          ? ", #cloudfrontInvalidationId = :cloudfrontInvalidationId"
          : ""),
      ExpressionAttributeNames: {
        "#lambdaServerVersionArn": "lambdaServerVersionArn",
        "#lambdaImageVersionArn": "lambdaImageVersionArn",
        "#staticAssetsPath": "staticAssetsPath",
        "#version": "version",
        "#deployedAt": "deployedAt",
        ...(versionData.cloudfrontInvalidationId && {
          "#cloudfrontInvalidationId": "cloudfrontInvalidationId",
        }),
      },
      ExpressionAttributeValues: {
        ":lambdaServerVersionArn": versionData.lambdaServerVersionArn,
        ":lambdaImageVersionArn": versionData.lambdaImageVersionArn,
        ":staticAssetsPath": versionData.staticAssetsPath,
        ":version": versionData.version,
        ":deployedAt": Date.now(),
        ...(versionData.cloudfrontInvalidationId && {
          ":cloudfrontInvalidationId": versionData.cloudfrontInvalidationId,
        }),
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    throw new Error("Failed to update deployment version");
  }

  return DeploymentSchema.parse(result.Attributes);
}

/**
 * Get recent deployment versions for a project
 *
 * Returns successful deployments with version info for rollback UI.
 * Only includes deployments that have been deployed to CloudFront (have lambdaServerVersionArn).
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @param limit - Maximum number of versions to return (default 10)
 * @returns Array of deployments with version data
 */
export async function getDeploymentVersions(
  projectId: string,
  userId: string,
  limit = 10
): Promise<Deployment[]> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Verify project ownership first
  const project = await getProject(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  // Query for successful deployments with version data
  const result = await docClient.send(
    new QueryCommand({
      TableName: DEPLOYMENTS_TABLE,
      KeyConditionExpression: "projectId = :projectId",
      FilterExpression:
        "#status = :status AND attribute_exists(#lambdaServerVersionArn)",
      ExpressionAttributeNames: {
        "#status": "status",
        "#lambdaServerVersionArn": "lambdaServerVersionArn",
      },
      ExpressionAttributeValues: {
        ":projectId": projectId,
        ":status": "success",
      },
      ScanIndexForward: false, // Newest first
      Limit: limit,
    })
  );

  return (result.Items ?? []).map((item) => DeploymentSchema.parse(item));
}
