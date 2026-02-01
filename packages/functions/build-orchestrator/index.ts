import {
  CodeBuildClient,
  StartBuildCommand,
  EnvironmentVariable,
} from "@aws-sdk/client-codebuild";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

import type { EnvVar } from "../../core/schemas/project.js";

/**
 * Build Orchestrator Lambda
 *
 * Processes SQS messages from build queue, triggers CodeBuild projects.
 * Updates deployment status from "queued" to "building".
 *
 * Flow:
 * 1. Receive SQS message with build job details
 * 2. Fetch project to get environment variables
 * 3. Update deployment status to "building"
 * 4. Start CodeBuild project with environment variables (including project env vars)
 * 5. Store buildId in deployment record for log streaming
 *
 * CRITICAL: This is fire-and-forget. We don't wait for CodeBuild to complete.
 * CodeBuild updates deployment status itself in the post_build phase.
 */

const codebuild = new CodeBuildClient({});
const dynamodb = new DynamoDBClient({});

/**
 * Build job message from SQS queue
 */
interface BuildJobMessage {
  deploymentId: string;
  projectId: string;
  commitSha: string;
  repoUrl: string;
  branch: string;
}

/**
 * SQS Event structure for Lambda
 */
interface SQSEvent {
  Records: Array<{
    messageId: string;
    body: string;
    attributes: Record<string, string>;
  }>;
}

/**
 * Update deployment status in DynamoDB
 *
 * @param projectId - Project ID (partition key)
 * @param deploymentId - Deployment record ID (sort key)
 * @param status - New status (building, failed)
 * @param buildId - Optional CodeBuild build ID
 */
async function updateDeploymentStatus(
  projectId: string,
  deploymentId: string,
  status: "building" | "failed",
  buildId?: string
): Promise<void> {
  const now = new Date().toISOString();

  const updateExpression = buildId
    ? "SET #status = :status, buildStartedAt = :buildStartedAt, buildId = :buildId"
    : "SET #status = :status, failedAt = :failedAt, errorMessage = :errorMessage";

  const expressionValues: Record<string, { S: string }> = {
    ":status": { S: status },
  };

  if (buildId) {
    expressionValues[":buildStartedAt"] = { S: now };
    expressionValues[":buildId"] = { S: buildId };
  } else {
    expressionValues[":failedAt"] = { S: now };
    expressionValues[":errorMessage"] = { S: "Failed to start CodeBuild" };
  }

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: process.env.DEPLOYMENTS_TABLE!,
      Key: {
        projectId: { S: projectId },
        deploymentId: { S: deploymentId },
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: expressionValues,
    })
  );

  console.log(`[STATUS] Deployment ${deploymentId} updated to ${status}`, {
    buildId,
  });
}

/**
 * Fetch project environment variables from DynamoDB
 *
 * @param projectId - The project's unique ID
 * @returns Array of environment variables, or empty array if project not found
 */
async function getProjectEnvVars(projectId: string): Promise<EnvVar[]> {
  const result = await dynamodb.send(
    new GetItemCommand({
      TableName: process.env.PROJECTS_TABLE!,
      Key: {
        projectId: { S: projectId },
      },
      ProjectionExpression: "envVars",
    })
  );

  if (!result.Item) {
    console.log(`[WARN] Project not found for env vars: ${projectId}`);
    return [];
  }

  const item = unmarshall(result.Item);
  return (item.envVars as EnvVar[]) || [];
}

/**
 * Start CodeBuild project with build job parameters
 *
 * Fetches project environment variables and includes them in the build.
 * NODE_ENV=production is always set (CodeBuild doesn't set this by default).
 *
 * @param job - Build job details from SQS message
 * @returns CodeBuild build ID
 */
async function startCodeBuild(job: BuildJobMessage): Promise<string> {
  // Fetch project environment variables
  const projectEnvVars = await getProjectEnvVars(job.projectId);

  console.log(`[ENV] Found ${projectEnvVars.length} project environment variables`, {
    projectId: job.projectId,
    keys: projectEnvVars.map((ev) => ev.key),
  });

  // Build environment variables override
  // Start with system variables, then add project env vars
  const environmentVariablesOverride: EnvironmentVariable[] = [
    // System variables (required for build)
    {
      name: "PROJECT_ID",
      value: job.projectId,
      type: "PLAINTEXT",
    },
    {
      name: "REPO_URL",
      value: job.repoUrl,
      type: "PLAINTEXT",
    },
    {
      name: "COMMIT_SHA",
      value: job.commitSha,
      type: "PLAINTEXT",
    },
    {
      name: "DEPLOYMENT_ID",
      value: job.deploymentId,
      type: "PLAINTEXT",
    },
    {
      name: "ARTIFACTS_BUCKET",
      value: process.env.ARTIFACTS_BUCKET!,
      type: "PLAINTEXT",
    },
    {
      name: "DEPLOYMENTS_TABLE",
      value: process.env.DEPLOYMENTS_TABLE!,
      type: "PLAINTEXT",
    },
    // CRITICAL: NODE_ENV must be production for Next.js builds
    // CodeBuild doesn't set this by default
    {
      name: "NODE_ENV",
      value: "production",
      type: "PLAINTEXT",
    },
    // Project environment variables (NEXT_PUBLIC_*, API_URL, etc.)
    // These are set by users via the API and stored in DynamoDB
    ...projectEnvVars.map((ev) => ({
      name: ev.key,
      value: ev.value,
      // TODO: Phase 2 - use SECRETS_MANAGER type for isSecret=true
      type: "PLAINTEXT" as const,
    })),
  ];

  const response = await codebuild.send(
    new StartBuildCommand({
      projectName: process.env.CODEBUILD_PROJECT!,
      environmentVariablesOverride,
    })
  );

  const buildId = response.build?.id;
  if (!buildId) {
    throw new Error("CodeBuild did not return a build ID");
  }

  console.log(`[CODEBUILD] Started build ${buildId}`, {
    projectId: job.projectId,
    commitSha: job.commitSha.slice(0, 7),
    envVarCount: projectEnvVars.length,
  });

  return buildId;
}

/**
 * Process a single build job
 *
 * @param job - Build job details
 */
async function processBuildJob(job: BuildJobMessage): Promise<void> {
  console.log(`[JOB] Processing build job`, {
    deploymentId: job.deploymentId,
    projectId: job.projectId,
    commitSha: job.commitSha.slice(0, 7),
  });

  try {
    // Step 1: Update status to "building"
    // We do this BEFORE starting CodeBuild so user sees progress immediately
    await updateDeploymentStatus(job.projectId, job.deploymentId, "building");

    // Step 2: Start CodeBuild
    const buildId = await startCodeBuild(job);

    // Step 3: Store buildId in deployment record (for log streaming)
    await updateDeploymentStatus(job.projectId, job.deploymentId, "building", buildId);

    console.log(`[COMPLETE] Build job processed successfully`, {
      deploymentId: job.deploymentId,
      buildId,
    });
  } catch (error) {
    console.error(`[ERROR] Failed to start build`, {
      deploymentId: job.deploymentId,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update deployment status to failed
    await updateDeploymentStatus(job.projectId, job.deploymentId, "failed");

    // Re-throw to let SQS retry (message goes back to queue)
    throw error;
  }
}

/**
 * Lambda handler for SQS events
 *
 * Processes build job messages from the queue.
 * Batch size is 1, so we process one message at a time.
 */
export async function handler(event: SQSEvent): Promise<void> {
  console.log(`[HANDLER] Received ${event.Records.length} message(s)`);

  for (const record of event.Records) {
    try {
      const job = JSON.parse(record.body) as BuildJobMessage;

      // Validate required fields
      if (!job.deploymentId || !job.projectId || !job.commitSha || !job.repoUrl) {
        console.error(`[INVALID] Missing required fields in message`, {
          messageId: record.messageId,
          job,
        });
        // Don't throw - this would retry forever. Just log and skip.
        continue;
      }

      await processBuildJob(job);
    } catch (error) {
      console.error(`[ERROR] Failed to process message`, {
        messageId: record.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      // Throw to trigger SQS retry
      throw error;
    }
  }

  console.log(`[HANDLER] All messages processed`);
}
