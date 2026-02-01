/**
 * Webhook API Gateway for Anchor Deploy
 *
 * Provides endpoints for:
 * - POST /webhook/{projectId}: GitHub webhook receiver
 * - GET /projects/{projectId}/deployments: Deployment history
 * - GET /projects/{projectId}/env: Get project environment variables
 * - PUT /projects/{projectId}/env: Update project environment variables
 * - GET /deployments/{deploymentId}/logs: Get build logs from CloudWatch
 *
 * Security:
 * - Webhook endpoint validates GitHub HMAC signatures
 * - Other endpoints require authentication (userId header for Phase 1)
 *
 * Async pattern:
 * - Webhook handler returns 202 immediately
 * - Actual build processing happens via SQS queue (Plan 03)
 */

import { projectsTable, deploymentsTable, domainsTable } from "./database.js";
import { buildQueue } from "./build-pipeline.js";
import { rollbackHandler, domainsHandler } from "./deployment.js";

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
 * creates deployment record, enqueues build job, returns 202 immediately.
 *
 * Environment:
 * - PROJECTS_TABLE: DynamoDB table for project lookup
 * - DEPLOYMENTS_TABLE: DynamoDB table for deployment creation
 * - WEBHOOK_SECRET: Secret for HMAC validation
 * - BUILD_QUEUE_URL: SQS queue for build jobs (Plan 03)
 */
const webhookHandler = new sst.aws.Function("WebhookHandler", {
  handler: "packages/functions/webhook-handler/index.handler",
  timeout: "30 seconds",
  link: [projectsTable, deploymentsTable, webhookSecret, buildQueue],
  environment: {
    PROJECTS_TABLE: projectsTable.name,
    DEPLOYMENTS_TABLE: deploymentsTable.name,
    BUILD_QUEUE_URL: buildQueue.url,
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

/**
 * Environment Variables Handler Function
 *
 * Manages project environment variables:
 * - GET: Retrieve current env vars
 * - PUT: Update env vars (replaces all)
 *
 * Environment variables are injected into CodeBuild during builds.
 * Supports NEXT_PUBLIC_*, API_URL, and other build-time variables.
 */
const envVarsHandler = new sst.aws.Function("EnvVarsHandler", {
  handler: "packages/functions/env-vars-handler/index.handler",
  timeout: "30 seconds",
  link: [projectsTable],
  environment: {
    PROJECTS_TABLE: projectsTable.name,
  },
});

/**
 * Build Logs Handler Function
 *
 * Retrieves build logs from CloudWatch Logs.
 * - GET: Fetch logs for a deployment (supports pagination via nextToken)
 *
 * Returns log lines with timestamps from CodeBuild.
 * Phase 1 uses polling; Phase 3 will add WebSocket/SSE for real-time.
 */
const logsHandler = new sst.aws.Function("LogsHandler", {
  handler: "packages/functions/logs-handler/index.handler",
  timeout: "30 seconds",
  link: [deploymentsTable],
  environment: {
    DEPLOYMENTS_TABLE: deploymentsTable.name,
  },
});

/**
 * IAM Policy for CloudWatch Logs access
 *
 * Grants the logs handler permission to read CodeBuild logs.
 */
const logsHandlerPolicy = new aws.iam.RolePolicy("LogsHandlerPolicy", {
  role: logsHandler.nodes.role.name,
  policy: $util.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["logs:GetLogEvents", "logs:DescribeLogStreams"],
        Resource: [
          "arn:aws:logs:*:*:log-group:/aws/codebuild/anchor-deploy-nextjs-build:*",
        ],
      },
    ],
  }),
});

// Route: POST /webhook/{projectId}
// GitHub sends push events here
webhookApi.route("POST /webhook/{projectId}", webhookHandler.arn);

// Route: GET /projects/{projectId}/deployments
// Dashboard queries deployment history
webhookApi.route("GET /projects/{projectId}/deployments", deploymentsHandler.arn);

// Route: GET /projects/{projectId}/env
// Get project environment variables
webhookApi.route("GET /projects/{projectId}/env", envVarsHandler.arn);

// Route: PUT /projects/{projectId}/env
// Update project environment variables
webhookApi.route("PUT /projects/{projectId}/env", envVarsHandler.arn);

// Route: GET /deployments/{deploymentId}/logs
// Fetch build logs from CloudWatch
webhookApi.route("GET /deployments/{deploymentId}/logs", logsHandler.arn);

// Route: POST /projects/{projectId}/rollback
// Instant rollback to previous deployment
webhookApi.route("POST /projects/{projectId}/rollback", rollbackHandler.arn);

// Route: GET /projects/{projectId}/domains
// List domains for a project
webhookApi.route("GET /projects/{projectId}/domains", domainsHandler.arn);

// Route: POST /projects/{projectId}/domains
// Add custom domain with ACM certificate
webhookApi.route("POST /projects/{projectId}/domains", domainsHandler.arn);

// Route: GET /projects/{projectId}/domains/{domainId}
// Get domain details and check certificate status
webhookApi.route("GET /projects/{projectId}/domains/{domainId}", domainsHandler.arn);

// Route: DELETE /projects/{projectId}/domains/{domainId}
// Remove custom domain
webhookApi.route("DELETE /projects/{projectId}/domains/{domainId}", domainsHandler.arn);

export { webhookSecret };
