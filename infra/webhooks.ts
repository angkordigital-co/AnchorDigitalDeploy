/**
 * Webhook API Gateway for Anchor Deploy
 *
 * Provides endpoints for:
 * - POST /webhook/{projectId}: GitHub webhook receiver
 * - GET /projects/{projectId}/deployments: Deployment history
 *
 * Security:
 * - Webhook endpoint validates GitHub HMAC signatures
 * - Deployment list endpoint requires authentication (userId header)
 *
 * Async pattern:
 * - Webhook handler returns 202 immediately
 * - Actual build processing happens via SQS queue (Plan 03)
 */

import { projectsTable, deploymentsTable } from "./database.js";

/**
 * SST Secret for GitHub webhook HMAC validation
 *
 * Set via: npx sst secret set WEBHOOK_SECRET "your-secret" --stage dev
 */
const webhookSecret = new sst.Secret("WEBHOOK_SECRET");

/**
 * Webhook API Gateway
 *
 * Routes:
 * - POST /webhook/{projectId}: GitHub push event receiver
 * - GET /projects/{projectId}/deployments: Deployment history (GIT-04)
 */
export const webhookApi = new sst.aws.ApiGatewayV2("WebhookApi");

/**
 * Webhook Handler Function
 *
 * Receives GitHub push webhooks, validates HMAC signature,
 * creates deployment record, returns 202 immediately.
 *
 * Environment:
 * - PROJECTS_TABLE: DynamoDB table for project lookup
 * - DEPLOYMENTS_TABLE: DynamoDB table for deployment creation
 * - WEBHOOK_SECRET: Secret for HMAC validation
 */
const webhookHandler = new sst.aws.Function("WebhookHandler", {
  handler: "packages/functions/webhook-handler/index.handler",
  timeout: "30 seconds",
  link: [projectsTable, deploymentsTable, webhookSecret],
  environment: {
    PROJECTS_TABLE: projectsTable.name,
    DEPLOYMENTS_TABLE: deploymentsTable.name,
  },
});

/**
 * Deployments Handler Function
 *
 * Lists deployment history for a project.
 * Returns commit SHA and message for GIT-04 requirement.
 */
const deploymentsHandler = new sst.aws.Function("DeploymentsHandler", {
  handler: "packages/functions/deployments-handler/index.handler",
  timeout: "30 seconds",
  link: [projectsTable, deploymentsTable],
  environment: {
    PROJECTS_TABLE: projectsTable.name,
    DEPLOYMENTS_TABLE: deploymentsTable.name,
  },
});

// Route: POST /webhook/{projectId}
// GitHub sends push events here
webhookApi.route("POST /webhook/{projectId}", webhookHandler.arn);

// Route: GET /projects/{projectId}/deployments
// Dashboard queries deployment history
webhookApi.route("GET /projects/{projectId}/deployments", deploymentsHandler.arn);

export { webhookSecret };
