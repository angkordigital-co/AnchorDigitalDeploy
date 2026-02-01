/**
 * DynamoDB Tables for Anchor Deploy
 *
 * Multi-tenant design with row-level security via userId GSI.
 * All queries MUST filter by userId to prevent data leakage.
 *
 * Tables:
 * - Projects: Stores project configurations (repo URL, branch, env vars)
 * - Deployments: Stores deployment history per project
 *
 * Access patterns supported:
 * - Get project by projectId (with userId verification)
 * - List all projects for a user (via UserIdIndex GSI)
 * - List deployments for a project (with userId verification)
 * - Get deployment by deploymentId (via DeploymentIdIndex GSI)
 */

/**
 * Projects Table
 *
 * Primary Key: projectId (PK)
 * GSI: UserIdIndex on userId for "list all projects for user" query
 *
 * Billing: ON_DEMAND (usage too low to benefit from provisioned capacity)
 */
export const projectsTable = new sst.aws.Dynamo("Projects", {
  fields: {
    projectId: "string",
    userId: "string",
  },
  primaryIndex: {
    hashKey: "projectId",
  },
  globalIndexes: {
    UserIdIndex: {
      hashKey: "userId",
    },
  },
});

/**
 * Deployments Table
 *
 * Primary Key: projectId (PK) + deploymentId (SK)
 * - Enables efficient "list all deployments for project" query
 *
 * GSI: DeploymentIdIndex on deploymentId
 * - Enables lookup by deploymentId alone (for status updates)
 *
 * Billing: ON_DEMAND (usage too low to benefit from provisioned capacity)
 */
export const deploymentsTable = new sst.aws.Dynamo("Deployments", {
  fields: {
    projectId: "string",
    deploymentId: "string",
    userId: "string",
  },
  primaryIndex: {
    hashKey: "projectId",
    rangeKey: "deploymentId",
  },
  globalIndexes: {
    DeploymentIdIndex: {
      hashKey: "deploymentId",
    },
    UserIdIndex: {
      hashKey: "userId",
    },
  },
});
