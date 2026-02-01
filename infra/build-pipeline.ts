/**
 * Build Pipeline Infrastructure for Anchor Deploy
 *
 * Components:
 * 1. SQS Queue: Build job queue with DLQ for failed messages
 * 2. CodeBuild Project: Isolated Next.js build environment with OpenNext
 * 3. Build Orchestrator Lambda: Processes SQS messages, triggers CodeBuild
 *
 * Flow:
 * Webhook → SQS Queue → Build Orchestrator → CodeBuild → Deploy Handler → Live
 *
 * Critical settings:
 * - SQS visibility timeout: 1800s (matches CodeBuild timeout)
 * - CodeBuild compute: BUILD_GENERAL1_SMALL (3GB RAM needed for Next.js)
 * - Cache: S3-based for node_modules and .next/cache
 */

import { artifactsBucket } from "./storage.js";
import { deploymentsTable, projectsTable } from "./database.js";
import { deployHandler } from "./deployment.js";

/**
 * Dead Letter Queue for failed build jobs
 *
 * Messages that fail 3 times end up here for investigation.
 * Retention: 14 days (max) to allow time for debugging.
 */
const buildQueueDlq = new sst.aws.Queue("BuildQueueDLQ", {
  visibilityTimeout: "30 seconds",
});

/**
 * Build Queue
 *
 * Receives build jobs from webhook handler.
 * Visibility timeout matches CodeBuild timeout (30 minutes).
 *
 * Message format:
 * {
 *   deploymentId: string,
 *   projectId: string,
 *   commitSha: string,
 *   repoUrl: string,
 *   branch: string
 * }
 */
export const buildQueue = new sst.aws.Queue("BuildQueue", {
  visibilityTimeout: "1800 seconds", // 30 minutes - matches CodeBuild timeout
  dlq: {
    queue: buildQueueDlq.arn,
    retry: 3, // After 3 failed attempts, move to DLQ
  },
});

/**
 * IAM Role for CodeBuild
 *
 * Permissions:
 * - S3: Read/Write to artifacts bucket
 * - DynamoDB: Update deployment status
 * - CloudWatch Logs: Write build logs
 */
const codeBuildRole = new aws.iam.Role("CodeBuildRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: "codebuild.amazonaws.com",
        },
        Action: "sts:AssumeRole",
      },
    ],
  }),
});

/**
 * CodeBuild policy for build operations
 */
const codeBuildPolicy = new aws.iam.RolePolicy("CodeBuildPolicy", {
  role: codeBuildRole.name,
  policy: $util.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        // S3 access for artifacts and cache
        Effect: "Allow",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:GetObjectVersion",
          "s3:GetBucketAcl",
          "s3:GetBucketLocation",
          "s3:ListBucket",
        ],
        Resource: [
          $interpolate`arn:aws:s3:::${artifactsBucket.name}`,
          $interpolate`arn:aws:s3:::${artifactsBucket.name}/*`,
        ],
      },
      {
        // DynamoDB access for deployment status updates
        Effect: "Allow",
        Action: ["dynamodb:UpdateItem"],
        Resource: [deploymentsTable.arn],
      },
      {
        // CloudWatch Logs for build logs
        Effect: "Allow",
        Action: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        Resource: ["arn:aws:logs:*:*:log-group:/aws/codebuild/*"],
      },
      {
        // Lambda invoke permission for deploy-handler
        Effect: "Allow",
        Action: ["lambda:InvokeFunction"],
        Resource: [deployHandler.arn],
      },
    ],
  }),
});

/**
 * S3 Cache Bucket Configuration
 *
 * Cache location uses artifacts bucket with /cache prefix
 * Caches:
 * - node_modules: Skip npm install on cache hit
 * - .next/cache: Incremental builds
 */
const cacheBucketArn = $interpolate`arn:aws:s3:::${artifactsBucket.name}`;

/**
 * CodeBuild Project for Next.js builds
 *
 * Environment:
 * - Image: aws/codebuild/standard:7.0 (Node.js 22)
 * - Compute: BUILD_GENERAL1_SMALL (3GB RAM, 2 vCPU)
 *   CRITICAL: Do not use nano - causes OOM on Next.js builds
 *
 * Timeout: 30 minutes (matches SQS visibility timeout)
 *
 * The buildspec.yml is stored in the repo at buildspecs/nextjs-build.yml
 * but is passed via sourceType: NO_SOURCE since we clone in the buildspec
 */
export const codeBuildProject = new aws.codebuild.Project("NextjsBuild", {
  name: "anchor-deploy-nextjs-build",
  description: "Build Next.js applications with OpenNext packaging",
  buildTimeout: 30, // minutes
  serviceRole: codeBuildRole.arn,

  environment: {
    computeType: "BUILD_GENERAL1_SMALL", // 3GB RAM, 2 vCPU
    image: "aws/codebuild/standard:7.0", // Node.js 22
    type: "LINUX_CONTAINER",
    privilegedMode: false, // Not building Docker images

    // Default environment variables (overridden per-build)
    environmentVariables: [
      {
        name: "NODE_ENV",
        value: "production",
        type: "PLAINTEXT",
      },
      {
        name: "DEPLOY_HANDLER_NAME",
        value: deployHandler.name,
        type: "PLAINTEXT",
      },
    ],
  },

  // No source - we clone the repo in the buildspec
  source: {
    type: "NO_SOURCE",
    buildspec: `version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: 22
    commands:
      - npm install -g pnpm@latest

  pre_build:
    commands:
      - echo "Cloning repository..."
      - git clone $REPO_URL app
      - cd app
      - git checkout $COMMIT_SHA
      - echo "Installing dependencies..."
      - pnpm install --frozen-lockfile || pnpm install

  build:
    commands:
      - cd app
      - export NODE_ENV=production
      - echo "Building Next.js application..."
      - pnpm run build
      - echo "Running OpenNext packaging..."
      - npx open-next@latest build

  post_build:
    commands:
      - cd app
      - echo "Packaging Lambda function..."
      - cd .open-next/server-function && zip -r ../../lambda.zip .
      - cd ../..
      - echo "Uploading artifacts to S3..."
      - aws s3 cp lambda.zip s3://$ARTIFACTS_BUCKET/artifacts/$PROJECT_ID/$COMMIT_SHA/lambda.zip
      - aws s3 cp --recursive .open-next/assets s3://$ARTIFACTS_BUCKET/static/$PROJECT_ID/$COMMIT_SHA/
      - echo "Updating deployment status to build complete..."
      - |
        aws dynamodb update-item \\
          --table-name $DEPLOYMENTS_TABLE \\
          --key '{"deploymentId":{"S":"'$DEPLOYMENT_ID'"}}' \\
          --update-expression "SET #status = :status, completedAt = :completedAt, artifactPath = :artifactPath" \\
          --expression-attribute-names '{"#status":"status"}' \\
          --expression-attribute-values '{":status":{"S":"built"},":completedAt":{"S":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"},":artifactPath":{"S":"artifacts/'$PROJECT_ID'/'$COMMIT_SHA'/lambda.zip"}}'
      - echo "Triggering deployment handler..."
      - |
        aws lambda invoke \\
          --function-name $DEPLOY_HANDLER_NAME \\
          --invocation-type Event \\
          --cli-binary-format raw-in-base64-out \\
          --payload '{"deploymentId":"'$DEPLOYMENT_ID'","projectId":"'$PROJECT_ID'","artifactPath":"artifacts/'$PROJECT_ID'/'$COMMIT_SHA'/"}' \\
          /tmp/deploy-response.json
      - echo "Deployment triggered successfully"

cache:
  paths:
    - 'app/node_modules/**/*'
    - 'app/.next/cache/**/*'
`,
  },

  // Artifacts stored in S3
  artifacts: {
    type: "NO_ARTIFACTS", // We upload manually in post_build
  },

  // S3 cache for faster builds
  cache: {
    type: "S3",
    location: $interpolate`${artifactsBucket.name}/cache`,
  },

  // Logs go to CloudWatch
  logsConfig: {
    cloudwatchLogs: {
      groupName: "/aws/codebuild/anchor-deploy-nextjs-build",
      streamName: "build",
      status: "ENABLED",
    },
  },

  // Tags for cost tracking
  tags: {
    Project: "anchor-deploy",
    Component: "build-pipeline",
  },
});

/**
 * Build Orchestrator Lambda
 *
 * Triggered by SQS messages, starts CodeBuild projects.
 * Updates deployment status from "queued" to "building".
 *
 * Environment variables:
 * - CODEBUILD_PROJECT: CodeBuild project name
 * - ARTIFACTS_BUCKET: S3 bucket for build artifacts
 * - DEPLOYMENTS_TABLE: DynamoDB table for status updates
 * - PROJECTS_TABLE: DynamoDB table for fetching project env vars
 */
export const buildOrchestrator = new sst.aws.Function("BuildOrchestrator", {
  handler: "packages/functions/build-orchestrator/index.handler",
  timeout: "60 seconds",
  link: [deploymentsTable, projectsTable, artifactsBucket, buildQueue],
  environment: {
    CODEBUILD_PROJECT: codeBuildProject.name,
    ARTIFACTS_BUCKET: artifactsBucket.name,
    DEPLOYMENTS_TABLE: deploymentsTable.name,
    PROJECTS_TABLE: projectsTable.name,
  },
});

/**
 * Grant CodeBuild start permission to orchestrator
 *
 * Extract role name from ARN: arn:aws:iam::123456789012:role/role-name
 */
const orchestratorCodeBuildPolicy = new aws.iam.RolePolicy(
  "OrchestratorCodeBuildPolicy",
  {
    role: buildOrchestrator.nodes.role.name,
    policy: $util.jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["codebuild:StartBuild", "codebuild:BatchGetBuilds"],
          Resource: [codeBuildProject.arn],
        },
      ],
    }),
  }
);

/**
 * Grant SQS consumer permissions to orchestrator
 *
 * EventSourceMapping requires these permissions on the Lambda role.
 * SST's `link` only grants publish (SendMessage) permissions.
 */
const orchestratorSqsPolicy = new aws.iam.RolePolicy("OrchestratorSqsPolicy", {
  role: buildOrchestrator.nodes.role.name,
  policy: $util.jsonStringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
        ],
        Resource: [buildQueue.arn],
      },
    ],
  }),
});

/**
 * Subscribe orchestrator to build queue
 *
 * Instead of subscribing a separate function, we use the EventSourceMapping
 * directly on the build orchestrator function.
 *
 * Batch size: 1 (process builds one at a time per invocation)
 * This ensures each build gets full attention and proper error handling.
 */
const buildQueueEventSource = new aws.lambda.EventSourceMapping(
  "BuildQueueEventSource",
  {
    eventSourceArn: buildQueue.arn,
    functionName: buildOrchestrator.nodes.function.name,
    batchSize: 1,
    enabled: true,
  },
  {
    dependsOn: [orchestratorSqsPolicy],
  }
);
