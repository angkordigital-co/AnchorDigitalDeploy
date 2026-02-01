import { z } from "zod";

/**
 * Project Schema
 *
 * Represents a GitHub repository connected to Anchor Deploy.
 * Each project belongs to a single user (multi-tenant isolation via userId).
 */

/**
 * Valid GitHub URL pattern
 * Supports both HTTPS and SSH formats:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 */
const gitHubUrlSchema = z.string().refine(
  (url) => {
    const httpsPattern = /^https:\/\/github\.com\/[\w-]+\/[\w.-]+(?:\.git)?$/;
    const sshPattern = /^git@github\.com:[\w-]+\/[\w.-]+\.git$/;
    return httpsPattern.test(url) || sshPattern.test(url);
  },
  { message: "Invalid GitHub repository URL" }
);

/**
 * Full Project schema with all fields
 */
export const ProjectSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  userId: z.string().min(1, "User ID is required"),
  name: z
    .string()
    .min(3, "Project name must be at least 3 characters")
    .max(50, "Project name must be at most 50 characters")
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Project name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric"
    ),
  repoUrl: gitHubUrlSchema,
  branch: z
    .string()
    .min(1, "Branch name is required")
    .max(100, "Branch name too long")
    .default("main"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  /**
   * Environment variables for builds (non-sensitive)
   * Sensitive values should be stored in AWS Secrets Manager
   */
  envVars: z.record(z.string(), z.string()).optional(),
  /**
   * References to secrets in AWS Secrets Manager
   * Format: { ENV_VAR_NAME: "arn:aws:secretsmanager:..." }
   */
  secretRefs: z.record(z.string(), z.string()).optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Schema for creating a new project
 * Auto-generates: projectId, createdAt, updatedAt
 */
export const CreateProjectSchema = z.object({
  name: ProjectSchema.shape.name,
  repoUrl: ProjectSchema.shape.repoUrl,
  branch: ProjectSchema.shape.branch,
  envVars: ProjectSchema.shape.envVars,
  secretRefs: ProjectSchema.shape.secretRefs,
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

/**
 * Schema for updating a project
 * All fields optional (partial update)
 */
export const UpdateProjectSchema = z.object({
  name: ProjectSchema.shape.name.optional(),
  repoUrl: ProjectSchema.shape.repoUrl.optional(),
  branch: ProjectSchema.shape.branch.optional(),
  envVars: ProjectSchema.shape.envVars,
  secretRefs: ProjectSchema.shape.secretRefs,
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
