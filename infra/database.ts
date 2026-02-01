/**
 * DynamoDB Tables for Anchor Deploy
 *
 * Multi-tenant design with row-level security via userId GSI.
 * All queries MUST filter by userId to prevent data leakage.
 *
 * Tables:
 * - Users: Stores user credentials and profiles for dashboard authentication
 * - Projects: Stores project configurations (repo URL, branch, env vars)
 * - Deployments: Stores deployment history per project
 *
 * Access patterns supported:
 * - Get user by userId (primary key)
 * - Get user by email (via EmailIndex GSI) for login
 * - Get project by projectId (with userId verification)
 * - List all projects for a user (via UserIdIndex GSI)
 * - List deployments for a project (with userId verification)
 * - Get deployment by deploymentId (via DeploymentIdIndex GSI)
 */

/**
 * Users Table
 *
 * Primary Key: userId (PK)
 * GSI: EmailIndex on email for login lookup
 *
 * Stores user credentials for dashboard authentication.
 * Passwords are bcrypt hashed before storage.
 * Billing: ON_DEMAND (low traffic)
 */
export const usersTable = new sst.aws.Dynamo("UsersTable", {
  fields: {
    userId: "string",
    email: "string",
  },
  primaryIndex: {
    hashKey: "userId",
  },
  globalIndexes: {
    EmailIndex: {
      hashKey: "email",
    },
  },
});

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

/**
 * Domains Table
 *
 * Primary Key: domainId (PK)
 * GSI: ProjectIdIndex on projectId for "list all domains for project" query
 *
 * Stores custom domain configurations with ACM certificate and CloudFront integration status.
 * Billing: ON_DEMAND (usage too low to benefit from provisioned capacity)
 */
export const domainsTable = new sst.aws.Dynamo("DomainsTable", {
  fields: {
    domainId: "string",
    projectId: "string",
  },
  primaryIndex: {
    hashKey: "domainId",
  },
  globalIndexes: {
    ProjectIdIndex: {
      hashKey: "projectId",
    },
  },
});
