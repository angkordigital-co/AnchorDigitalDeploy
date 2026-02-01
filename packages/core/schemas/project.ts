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
 * Environment Variable Schema
 *
 * Structured format for build-time environment variables.
 * - key: Must be uppercase with underscores (e.g., NEXT_PUBLIC_API_URL)
 * - value: The variable value
 * - isSecret: If true, should be stored in Secrets Manager (Phase 2)
 *
 * Build-time vars (NEXT_PUBLIC_*, API_URL): Stored in DynamoDB (fast, cheap)
 * Secrets (API keys): Marked with isSecret flag, moved to Secrets Manager in Phase 2
 */
export const EnvVarSchema = z.object({
  key: z
    .string()
    .min(1, "Environment variable key is required")
    .regex(
      /^[A-Z_][A-Z0-9_]*$/,
      "Must be uppercase with underscores (e.g., NEXT_PUBLIC_API_URL)"
    ),
  value: z.string(),
  isSecret: z.boolean().default(false),
});

export type EnvVar = z.infer<typeof EnvVarSchema>;

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
   * Environment variables for builds
   * Stored as array of {key, value, isSecret} objects
   * All deployments of a project use same env vars unless overridden
   */
  envVars: z.array(EnvVarSchema).default([]),
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
});

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

/**
 * Schema for updating project environment variables
 * Used by PUT /projects/{projectId}/env endpoint
 */
export const UpdateEnvVarsSchema = z.object({
  envVars: z.array(EnvVarSchema),
});

export type UpdateEnvVarsInput = z.infer<typeof UpdateEnvVarsSchema>;
