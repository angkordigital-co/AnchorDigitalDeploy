/**
 * TypeScript interfaces for AWS DynamoDB entities
 *
 * These types mirror the DynamoDB table schemas defined in infra/database.ts
 */

/**
 * Project entity from ProjectsTable
 */
export interface Project {
  projectId: string;
  userId: string;
  name: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  webhookSecret?: string;
  envVars?: Record<string, { value: string; isSecret: boolean }>;
  // Lambda function info (set during deployment by deploy-handler)
  serverFunctionName?: string;
  serverFunctionArn?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Deployment entity from DeploymentsTable
 */
export interface Deployment {
  deploymentId: string;
  projectId: string;
  status: 'pending' | 'building' | 'built' | 'deploying' | 'success' | 'failed';
  commitHash: string;
  commitMessage?: string;
  commitAuthor?: string;
  buildLogGroup?: string;
  buildLogStream?: string;
  serverFunctionVersion?: string;
  imageFunctionVersion?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * User entity from UsersTable
 */
export interface User {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Domain entity from DomainsTable
 */
export interface Domain {
  domainId: string;
  projectId: string;
  domain: string;
  certificateArn?: string;
  certificateStatus: 'PENDING_VALIDATION' | 'ISSUED' | 'FAILED' | 'INACTIVE';
  cloudFrontStatus: 'PENDING' | 'DEPLOYED' | 'FAILED';
  validationRecord?: {
    name: string;
    type: string;
    value: string;
  };
  createdAt: string;
  updatedAt: string;
}
