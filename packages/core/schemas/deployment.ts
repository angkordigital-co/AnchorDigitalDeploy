import { z } from "zod";

/**
 * Deployment Schema
 *
 * Represents a deployment attempt for a project.
 * Tracks build status from queue through completion.
 */

/**
 * Deployment status enum
 *
 * Flow: queued -> building -> built -> deploying -> success | failed | cancelled
 */
export const DeploymentStatus = z.enum([
  "queued", // Received webhook, waiting for CodeBuild
  "building", // CodeBuild in progress
  "built", // Build complete, artifacts uploaded, waiting for deployment
  "deploying", // OpenNext artifacts being deployed to Lambda/S3
  "success", // Deployment complete and live
  "failed", // Build or deployment failed
  "cancelled", // Cancelled by user or system
]);

export type DeploymentStatus = z.infer<typeof DeploymentStatus>;

/**
 * Full Deployment schema with all fields
 */
export const DeploymentSchema = z.object({
  deploymentId: z.string().min(1, "Deployment ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  userId: z.string().min(1, "User ID is required"),
  status: DeploymentStatus,
  commitSha: z
    .string()
    .length(40, "Commit SHA must be 40 characters")
    .regex(/^[a-f0-9]+$/, "Commit SHA must be lowercase hex"),
  commitMessage: z.string().max(1000).optional(),
  /**
   * AWS CodeBuild build ID (for linking to build logs)
   */
  buildId: z.string().optional(),
  /**
   * Error message if deployment failed
   */
  error: z.string().optional(),
  /**
   * S3 path to build artifacts
   */
  artifactPath: z.string().optional(),
  /**
   * S3 path to build logs
   */
  logPath: z.string().optional(),
  /**
   * Lambda version ARNs for rollback (Phase 2)
   * Stored after successful deployment to CloudFront
   */
  lambdaServerVersionArn: z.string().optional(),
  lambdaImageVersionArn: z.string().optional(),
  /**
   * S3 path to static assets for this deployment
   * Format: s3://bucket/static/{projectId}/{deploymentId}/
   */
  staticAssetsPath: z.string().optional(),
  /**
   * CloudFront invalidation ID (if invalidation was triggered)
   */
  cloudfrontInvalidationId: z.string().optional(),
  /**
   * Timestamp when deployment went live on CloudFront
   */
  deployedAt: z.number().optional(),
  /**
   * Version identifier for this deployment
   * Either v{timestamp} or commit SHA short (first 7 chars)
   */
  version: z.string().optional(),
  createdAt: z.string().datetime(),
  /**
   * When deployment reached terminal state (success/failed/cancelled)
   */
  endedAt: z.string().datetime().optional(),
});

export type Deployment = z.infer<typeof DeploymentSchema>;

/**
 * Schema for creating a new deployment
 * Auto-generates: deploymentId, createdAt, status (queued)
 */
export const CreateDeploymentSchema = z.object({
  projectId: DeploymentSchema.shape.projectId,
  commitSha: DeploymentSchema.shape.commitSha,
  commitMessage: DeploymentSchema.shape.commitMessage,
});

export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;

/**
 * Schema for updating a deployment
 * Used by build orchestrator to update status, buildId, etc.
 */
export const UpdateDeploymentSchema = z.object({
  status: DeploymentStatus.optional(),
  buildId: DeploymentSchema.shape.buildId,
  error: DeploymentSchema.shape.error,
  artifactPath: DeploymentSchema.shape.artifactPath,
  logPath: DeploymentSchema.shape.logPath,
  lambdaServerVersionArn: DeploymentSchema.shape.lambdaServerVersionArn,
  lambdaImageVersionArn: DeploymentSchema.shape.lambdaImageVersionArn,
  staticAssetsPath: DeploymentSchema.shape.staticAssetsPath,
  cloudfrontInvalidationId: DeploymentSchema.shape.cloudfrontInvalidationId,
  deployedAt: DeploymentSchema.shape.deployedAt,
  version: DeploymentSchema.shape.version,
  endedAt: DeploymentSchema.shape.endedAt,
});

export type UpdateDeploymentInput = z.infer<typeof UpdateDeploymentSchema>;
