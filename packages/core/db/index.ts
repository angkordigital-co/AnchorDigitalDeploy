/**
 * Anchor Deploy Data Access Layer
 *
 * Multi-tenant data access with row-level security via userId filtering.
 * All operations enforce tenant isolation to prevent data leakage.
 *
 * Usage:
 * ```typescript
 * import { getProject, listUserProjects, createDeployment } from '@core/db';
 *
 * // All operations require userId for tenant isolation
 * const project = await getProject(projectId, userId);
 * const projects = await listUserProjects(userId);
 * const deployment = await createDeployment(projectId, userId, commitSha);
 * ```
 */

// Re-export client configuration
export { docClient, PROJECTS_TABLE, DEPLOYMENTS_TABLE } from "./client.js";

// Projects operations
export {
  getProject,
  listUserProjects,
  createProject,
  updateProject,
  deleteProject,
} from "./projects.js";

// Deployments operations
export {
  createDeployment,
  getDeployment,
  getDeploymentForUser,
  listProjectDeployments,
  updateDeploymentStatus,
  updateDeployment,
  listUserDeployments,
} from "./deployments.js";

// Re-export types
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/project.js";

export type {
  Deployment,
  DeploymentStatus,
  CreateDeploymentInput,
  UpdateDeploymentInput,
} from "../schemas/deployment.js";
