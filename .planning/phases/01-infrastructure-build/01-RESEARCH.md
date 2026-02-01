# Phase 1: Infrastructure & Build - Research

**Researched:** 2026-02-01
**Domain:** Serverless deployment platform infrastructure and build pipeline
**Confidence:** HIGH

## Summary

Phase 1 establishes the foundational infrastructure and build pipeline for Anchor Deploy, focusing on GitHub webhook integration, automated Next.js builds with OpenNext, and artifact storage. Research reveals this phase must address three **critical architectural decisions** that cannot be retrofitted later: (1) multi-tenant data isolation model, (2) Lambda packaging strategy for Next.js size limits, and (3) database connection pooling architecture.

The recommended approach uses **SST Ion v3** for infrastructure as code, **CodeBuild** for isolated build execution, **OpenNext v3** for Next.js-to-Lambda packaging, **DynamoDB** for metadata storage (not RDS - simpler, no connection pooling needed), and **S3** with lifecycle policies for build artifacts. This stack is production-ready for Next.js 15 with App Router and Server Actions.

**Key insight:** Phase 1 is architecturally critical because choices made here (tenant isolation, Lambda sizing, build artifact storage) constrain all future phases. Unlike UI or API changes, data models and infrastructure patterns are expensive to change once sites are deployed.

**Primary recommendation:** Design multi-tenant isolation model FIRST (before writing any schema), use Lambda Container Images (not standard zip packages) for Next.js deployments, and implement S3 lifecycle policies from day one to prevent cost balloon.

## Standard Stack

The established libraries/tools for serverless deployment platform infrastructure in 2026:

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **SST Ion** | v3 (latest) | Infrastructure as Code | Purpose-built for serverless full-stack apps. Uses Pulumi/Terraform (faster than CloudFormation). Automatic OpenNext integration. Single `sst.config.ts` file. Built-in dev mode. Industry standard for Next.js on AWS in 2026. |
| **OpenNext** | v3.x | Next.js → Lambda adapter | Official standard for Next.js on AWS. Maintained by SST team. Supports all Next.js 15 features (App Router, Server Actions). Automatically handles Lambda size limits via Container Images. Active commits Jan 2026. |
| **AWS CodeBuild** | N/A | Build service | Fully managed build service. Pay-per-minute pricing. 30-minute timeout (vs Lambda's 15-min). 128GB storage (vs Lambda's 10GB). GitHub App integration (2026 improvement). Standard for serverless build pipelines. |
| **DynamoDB** | N/A | Metadata database | Serverless, pay-per-request. Single-digit ms latency. No connection pooling needed (unlike RDS). Perfect for deployment metadata. AWS announced enhanced Next.js integration Jan 2026. Scales 3→50+ sites automatically. |
| **Amazon S3** | N/A | Artifact storage | Build artifacts, static assets, logs. Lifecycle policies for cost management. Standard for serverless storage. Used by Vercel, Netlify, all major platforms. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **AWS SQS** | N/A | Build queue | Decouples webhook receipt from build execution. Enables retries, DLQ. Standard pattern for async workflows. |
| **AWS SDK v3** | Latest | AWS service clients | Interact with DynamoDB, S3, CodeBuild from Lambda. Tree-shakeable for smaller bundles. Required for all AWS operations. |
| **Octokit** | Latest | GitHub API client | Webhook signature validation, repo access. TypeScript-first. Official GitHub SDK. |
| **Zod** | 3.x | Runtime validation | Validate webhook payloads, deployment configs. TypeScript-first schema validation. Standard in Next.js ecosystem 2026. |
| **nanoid** | 5.x | ID generation | Generate deployment IDs, build IDs. URL-safe, cryptographically strong. Lighter than UUID. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DynamoDB | Aurora Serverless v2 | Aurora has minimum capacity units ($43/month baseline), requires RDS Proxy for Lambda connection pooling, adds complexity. DynamoDB is simpler, cheaper ($0 at rest with on-demand), no connection management. Use Aurora only if you need complex queries/joins. |
| SST Ion | AWS CDK | CDK is lower-level, more control but steeper learning curve. SST is opinionated, faster setup, better Next.js integration. Use CDK if you need deep AWS customization beyond Next.js. |
| CodeBuild | Lambda builds | Lambda has 10GB storage limit, 15-min timeout. CodeBuild has 128GB, 30-min timeout. Next.js builds regularly exceed Lambda limits. Never use Lambda for builds. |
| Lambda Container Images | Lambda Layers | Layers add up to 250MB (total 500MB with zip). Next.js apps regularly exceed this. Container Images support 10GB. Use Container Images from day one to avoid emergency refactor. |

**Installation:**

```bash
# Core infrastructure
npm install sst@latest

# Lambda function dependencies
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/client-codebuild

# GitHub integration
npm install octokit

# Validation
npm install zod nanoid

# Dev dependencies
npm install -D @types/aws-lambda typescript
```

## Architecture Patterns

### Recommended Project Structure

```
.
├── sst.config.ts                 # SST Ion infrastructure definition
├── infra/                        # Infrastructure components
│   ├── database.ts               # DynamoDB table definitions
│   ├── storage.ts                # S3 bucket configurations
│   ├── webhooks.ts               # API Gateway + webhook handler
│   ├── build-pipeline.ts         # CodeBuild + SQS + orchestrator
│   └── iam.ts                    # IAM roles and policies
├── packages/
│   ├── functions/                # Lambda functions
│   │   ├── webhook-handler/      # GitHub webhook validator
│   │   ├── build-orchestrator/   # CodeBuild scheduler
│   │   └── shared/               # Shared utilities
│   └── core/                     # Shared business logic
│       ├── schemas/              # Zod validation schemas
│       └── db/                   # DynamoDB data access layer
└── buildspecs/
    └── nextjs-build.yml          # CodeBuild buildspec for OpenNext
```

### Pattern 1: Multi-Tenant Data Isolation (Row-Level Security)

**What:** Store all projects and deployments in shared DynamoDB tables with row-level isolation enforced by tenant ID filtering.

**When to use:** 3-50 sites managed internally. Simpler than schema-per-tenant, sufficient isolation for internal use (not SaaS product).

**Example:**

```typescript
// Source: AWS Multi-Tenant DynamoDB Patterns
// https://aws.amazon.com/blogs/database/amazon-dynamodb-data-modeling-for-multi-tenancy-part-1/

// DynamoDB Projects table schema with tenant isolation
interface ProjectRecord {
  PK: string;           // "PROJECT#{projectId}"
  SK: string;           // "METADATA"
  userId: string;       // Tenant identifier (owner)
  projectId: string;
  name: string;
  repoUrl: string;
  branch: string;
  createdAt: string;
  // ... other fields
}

// All queries MUST include userId filter
const getProjectsByUser = async (userId: string) => {
  return dynamodb.query({
    TableName: 'Projects',
    IndexName: 'UserIdIndex',  // GSI on userId
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  });
};

// CRITICAL: Never query without userId - causes data leakage
// BAD: dynamodb.scan({ TableName: 'Projects' }) // Returns all users' data
// GOOD: dynamodb.query with userId filter (above)
```

**Why this matters for Phase 1:** Must be designed into DynamoDB schema BEFORE first table creation. Adding GSI on userId later requires full table scan/rewrite affecting all sites.

**Decision required:** Confirm row-level security (shared table + userId filter) is acceptable for internal use vs schema-per-tenant (separate DynamoDB tables per project). Recommendation: row-level security for v1 simplicity.

### Pattern 2: Lambda Container Images for Next.js Deployments

**What:** Package Next.js Lambda functions as container images (up to 10GB) instead of zip files (250MB limit).

**When to use:** Always for Next.js deployments. Modern Next.js apps with dependencies exceed 250MB uncompressed regularly.

**Example:**

```typescript
// Source: OpenNext + Lambda Container Images
// https://opennext.js.org/aws/config/full_example

// sst.config.ts - Configure Lambda to use container images
export default $config({
  app(input) {
    return {
      name: "anchor-deploy",
      removal: input?.stage === "production" ? "retain" : "remove",
    };
  },
  async run() {
    // Next.js site deployed as container image
    const site = new sst.aws.Nextjs("ClientSite", {
      path: "./client-site",
      // OpenNext automatically packages as container image if needed
      // No manual configuration required with SST
    });
  }
});

// OpenNext open-next.config.ts (optional customization)
export default {
  default: {
    override: {
      // Force container image for all functions (automatic in SST)
      wrapper: "aws-lambda-ric", // Use AWS Lambda Runtime Interface Client
    }
  }
};
```

**Alternative (manual approach without SST):**

```dockerfile
# Dockerfile for Next.js Lambda (if not using SST)
FROM public.ecr.aws/lambda/nodejs:22

# Copy OpenNext build output
COPY --from=build /app/.open-next/server-function /var/task

# Lambda entry point
CMD ["index.handler"]
```

**Why this matters for Phase 1:** Must be decided in infrastructure setup. Cannot switch from zip to container without redeploying all functions. Zip-based deploys will fail when Next.js app grows beyond 250MB.

**Warning:** Never assume standard Lambda zip packaging will work for Next.js. Next.js + dependencies regularly exceed 250MB. Always plan for container images from day one.

### Pattern 3: Asynchronous Build Pipeline with SQS

**What:** Webhook handler returns immediately (202 Accepted), enqueues build job in SQS, separate worker Lambda processes queue and triggers CodeBuild.

**When to use:** Always when build time >20 seconds (API Gateway has 29s hard timeout). All Next.js builds in this platform.

**Example:**

```typescript
// Source: GitHub webhook + async build pattern
// https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

// webhook-handler/index.ts
import crypto from 'crypto';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { z } from 'zod';

const WebhookPayload = z.object({
  ref: z.string(),
  repository: z.object({
    full_name: z.string(),
    clone_url: z.string(),
  }),
  after: z.string(), // commit SHA
});

export const handler = async (event) => {
  // 1. Validate GitHub webhook signature (CRITICAL for security)
  const signature = event.headers['x-hub-signature-256'];
  const body = event.body;
  const secret = process.env.WEBHOOK_SECRET!;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(body).digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
    return { statusCode: 401, body: 'Invalid signature' };
  }

  // 2. Parse and validate payload
  const payload = WebhookPayload.parse(JSON.parse(body));

  // Only process main branch pushes
  if (payload.ref !== 'refs/heads/main') {
    return { statusCode: 200, body: 'Ignoring non-main branch' };
  }

  // 3. Create deployment record immediately
  const deploymentId = nanoid();
  await dynamodb.putItem({
    TableName: 'Deployments',
    Item: {
      deploymentId,
      projectId: event.pathParameters.projectId,
      commitSha: payload.after,
      status: 'queued',
      createdAt: new Date().toISOString(),
    }
  });

  // 4. Enqueue build job in SQS
  const sqs = new SQSClient({});
  await sqs.send(new SendMessageCommand({
    QueueUrl: process.env.BUILD_QUEUE_URL,
    MessageBody: JSON.stringify({
      deploymentId,
      projectId: event.pathParameters.projectId,
      commitSha: payload.after,
      repoUrl: payload.repository.clone_url,
    })
  }));

  // 5. Return immediately (< 1 second) with job ID
  // GitHub webhook timeout is 10 seconds, build takes minutes
  return {
    statusCode: 202, // Accepted (processing asynchronously)
    body: JSON.stringify({ deploymentId })
  };
};
```

**Why this matters for Phase 1:** API Gateway has non-configurable 29-second timeout. Synchronous builds fail after 29s even though Lambda can run 15 minutes. Async pattern must be designed from start, cannot be retrofitted easily.

**Critical:** Never attempt synchronous HTTP builds >20 seconds with API Gateway. Always use async pattern: webhook returns job ID, client polls status separately.

### Pattern 4: S3 Lifecycle Policies from Day One

**What:** Automatically transition old build artifacts to cheaper storage or delete after retention period.

**When to use:** From first S3 bucket creation. Prevents silent cost balloon (2TB artifacts = $46/month wasted).

**Example:**

```typescript
// Source: S3 lifecycle policies best practices
// https://www.cloudoptimo.com/blog/s3-lifecycle-policies-optimizing-cloud-storage-in-aws/

// storage.ts - S3 bucket with lifecycle policies
const artifactsBucket = new sst.aws.Bucket("BuildArtifacts", {
  lifecycleRules: [
    {
      // Delete build artifacts after 90 days
      // Keep only last N successful builds for rollback
      id: "DeleteOldArtifacts",
      enabled: true,
      prefix: "artifacts/",
      expiration: {
        days: 90
      }
    },
    {
      // Transition old logs to Glacier after 30 days (80% cost reduction)
      // Logs rarely accessed after 30 days but kept for compliance
      id: "ArchiveLogs",
      enabled: true,
      prefix: "logs/",
      transitions: [
        {
          days: 30,
          storageClass: "GLACIER"
        },
        {
          days: 365,
          storageClass: "DEEP_ARCHIVE" // 95% cost reduction
        }
      ]
    },
    {
      // Intelligent-Tiering for static assets
      // Auto-optimizes based on access patterns
      id: "IntelligentStatic",
      enabled: true,
      prefix: "static/",
      transitions: [
        {
          days: 0,
          storageClass: "INTELLIGENT_TIERING"
        }
      ]
    }
  ]
});
```

**Cost impact:** Without lifecycle policies, 50 sites × 10 deploys/day × 200MB = 100GB/day = 3TB/month = $69/month in 1 month, $828/year for garbage data never accessed. With lifecycle policies: $8/month (90-day retention) + $2/month (Glacier logs).

**Why this matters for Phase 1:** S3 costs accumulate silently. After 6 months without policies, you're paying $400+/month for artifacts from months ago. Lifecycle policies cannot be retroactively applied to delete old data (objects already stored stay in expensive tier).

**Decision required:** Confirm artifact retention policy (recommend: 90 days or last 100 successful builds, whichever is more recent). Confirm log retention (recommend: 30 days CloudWatch, 1 year S3 Glacier).

### Anti-Patterns to Avoid

- **RDS/Aurora for deployment metadata:** Requires connection pooling, RDS Proxy ($0.015/hour = $10.80/month), always-on capacity. DynamoDB is simpler, cheaper ($0 at rest with on-demand), no connection management, perfect for key-value access patterns of deployment metadata.

- **Lambda zip packaging for Next.js:** Next.js regularly exceeds 250MB unzipped limit. Wasting weeks optimizing bundles to fit in zip. Use Lambda Container Images (10GB limit) from day one.

- **Missing NODE_ENV=production:** Lambda doesn't set NODE_ENV by default. Results in blank pages, 10x slower performance, development bundles in production. Must be set in every Lambda's environment variables.

- **Synchronous builds in API Gateway:** API Gateway has 29-second hard timeout. Builds take minutes. Synchronous approach fails silently after 29s. Must use async pattern (SQS + polling) from start.

- **No tenant isolation design:** Building "single project" proof-of-concept, adding multi-tenancy later. Results in data leakage, security violations, full migration affecting all tenants. Must design tenant isolation BEFORE first schema.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Next.js → Lambda packaging | Custom build scripts copying .next output | OpenNext | OpenNext handles 50+ edge cases: middleware, image optimization, ISR, API routes, App Router. Manually copying .next to Lambda fails on middleware, breaks image optimization, doesn't handle ISR. 2000+ hours of community debugging already in OpenNext. |
| GitHub webhook signature validation | Custom HMAC implementation | crypto.timingSafeEqual + verified examples | Timing attacks exploit naive string comparison. crypto.timingSafeEqual prevents timing leaks. Custom HMAC risks security vulnerabilities. Use verified pattern from GitHub docs. |
| DynamoDB data access layer | Raw AWS SDK calls everywhere | TypeScript data access layer with Zod | Every SDK call needs error handling, marshalling, type safety. Repeating this 100+ times creates bugs. Centralize in typed data access layer. |
| Build artifact deduplication | Custom hash-based deduplication | S3 lifecycle policies + content-addressed storage | Content-addressed storage (hash-based keys) prevents duplicate uploads. But lifecycle policies still needed for retention. Both together are standard pattern. Don't reinvent. |

**Key insight:** Next.js on Lambda has dozens of gotchas (middleware, image optimization, ISR cache, streaming, API routes). OpenNext encapsulates 3+ years of community debugging. Never hand-roll Next.js packaging.

## Common Pitfalls

### Pitfall 1: Lambda Size Limits Without Container Strategy

**What goes wrong:** Next.js bundles regularly exceed Lambda's 50MB zipped/250MB unzipped limits. Deployments fail in production with cryptic "Unzipped size must be smaller than" errors. Weeks wasted optimizing bundles before realizing Container Images are required.

**Why it happens:** Standard Lambda packaging works for simple Node.js apps. Next.js with dependencies (React, optimization libs, middleware) easily exceeds 250MB uncompressed.

**How to avoid:**
- Plan for Lambda Container Images (10GB limit) from day one
- Never assume standard zip packaging will work
- OpenNext/SST automatically use Container Images when needed
- Verify in Phase 1: deploy test Next.js app, check Lambda size

**Warning signs:**
- Build artifacts > 200MB uncompressed
- Deployment failures with "Unzipped size must be smaller than 262144000 bytes" error
- Functions missing expected dependencies after deployment

**Phase 1 mitigation:** Configure SST to use Container Images for all Next.js deployments. Test with realistic Next.js app (not empty create-next-app).

**Sources:**
- [AWS Lambda Size Limits Got You Down?](https://blogs.businesscompassllc.com/2025/12/aws-lambda-size-limits-got-you-down.html)
- [Next.js Deployment on AWS Lambda](https://dev.to/aws-builders/nextjs-deployment-on-aws-lambda-ecs-amplify-and-vercel-what-i-learned-nmc)

---

### Pitfall 2: Multi-Tenant Data Isolation Design Flaws

**What goes wrong:** Data leaks between projects/users because isolation wasn't explicitly designed from the start. Once in production with 50+ sites, retrofitting proper isolation requires full database migration affecting all tenants.

**Why it happens:** Early development focuses on single-project proof-of-concept. Multi-tenancy gets "added later" as an afterthought. Row-level security, schema isolation, or separate databases aren't considered until after launch.

**How to avoid:**
- Design tenant isolation strategy BEFORE writing first schema
- Choose isolation model upfront: shared DB with row-level filtering, schema-per-tenant, or DB-per-tenant
- Add userId/projectId to every query, enforce in data access layer
- Test data isolation: query as user A, verify user B's data is inaccessible
- Document isolation model in architecture docs

**Warning signs:**
- No userId/projectId in DynamoDB queries (code review)
- Queries without tenant context filtering
- Missing GSI on userId for efficient tenant queries
- Test: can project A access project B's data?

**Phase 1 mitigation:** **CRITICAL DECISION REQUIRED BEFORE SCHEMA CREATION**

**Options:**
1. **Row-level security (RECOMMENDED for v1):** Shared DynamoDB tables, every query filtered by userId. Simpler, sufficient for 50 internal sites.
2. **Schema-per-tenant:** Separate DynamoDB table per project. More isolated, 20x operational complexity (migrations, backups, monitoring × 50 tables).
3. **DB-per-tenant:** Separate DynamoDB instance per project. Maximum isolation, highest cost, only for compliance requirements.

**Recommendation:** Row-level security (option 1) for Anchor Deploy v1. Add userId as GSI on all tables. Enforce filtering in data access layer (never allow scan without userId).

**Sources:**
- [3 Things to Know Before Building a Multi-Tenant Serverless App](https://www.readysetcloud.io/blog/allen.helton/things-to-know-before-building-a-multi-tenant-serverless-app/)
- [AWS Multi-Tenant SaaS Solution](https://aws.amazon.com/blogs/apn/building-a-multi-tenant-saas-solution-using-aws-serverless-services/)
- [Amazon DynamoDB Data Modeling for Multi-Tenancy](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-modeling-for-multi-tenancy-part-1/)

---

### Pitfall 3: API Gateway 29-Second Timeout Ceiling

**What goes wrong:** Next.js builds timeout at API Gateway's hard 29-second limit. Build process shows as "failed" in UI despite Lambda continuing in background for 15 minutes. No way to extend timeout.

**Why it happens:** Developers assume Lambda's 15-minute timeout applies end-to-end. API Gateway has separate, lower, non-configurable 29-second integration timeout that terminates request before Lambda finishes.

**How to avoid:**
- Use async build pattern from start: webhook returns 202 Accepted immediately
- Store build status in DynamoDB, Lambda updates status as it progresses
- Client polls deployment status via separate endpoint
- Never rely on synchronous HTTP for operations >20 seconds

**Warning signs:**
- 504 Gateway Timeout errors after exactly 29 seconds
- Build Lambdas show success in CloudWatch but API returns timeout
- Integration timeout configuration has no effect

**Phase 1 mitigation:** Implement async pattern in Phase 1 architecture:
1. Webhook handler validates signature, creates deployment record (status: "queued"), enqueues SQS message, returns 202 with deploymentId
2. Build orchestrator Lambda polls SQS, updates status to "building", triggers CodeBuild
3. Dashboard polls `GET /api/deployments/{id}` every 5 seconds for status updates
4. Alternative: WebSocket or Server-Sent Events for real-time updates (Phase 3+)

**Sources:**
- [API Gateway Timeout—Causes and Solutions](https://www.catchpoint.com/api-monitoring-tools/api-gateway-timeout)
- [Troubleshoot API Gateway HTTP 504 Timeout Errors](https://repost.aws/knowledge-center/api-gateway-504-errors)

---

### Pitfall 4: Missing NODE_ENV=production in Lambda

**What goes wrong:** Lambda runs Next.js in development mode. Site shows blank page or "chunk not found" errors. Performance is 10x worse (development bundles are huge). Development source maps exposed in production.

**Why it happens:** Local development has NODE_ENV=development set automatically. Lambda doesn't set NODE_ENV by default. Easy to miss in initial testing.

**How to avoid:**
- Set NODE_ENV=production as Lambda environment variable (mandatory)
- Verify in IaC: every Lambda must have NODE_ENV=production
- Add automated test: deploy to staging, verify `process.env.NODE_ENV === 'production'`
- SST/OpenNext sets this automatically (another reason to use them)
- Add health check endpoint that returns process.env.NODE_ENV

**Warning signs:**
- Blank pages after deployment
- Browser console errors about missing chunks
- Development warnings in production logs
- Slow page loads (3-5x expected)

**Phase 1 mitigation:** Verify NODE_ENV=production in every Lambda function config. Add to SST infrastructure:

```typescript
const ssrFunction = new sst.aws.Function("SSR", {
  handler: "packages/functions/ssr/index.handler",
  environment: {
    NODE_ENV: "production", // CRITICAL
  }
});
```

**Sources:**
- [How to Deploy Next.js to AWS Lambda: A Complete Guide](https://dev-end.com/blog/deploying-nextjs-to-aws-lambda-the-complete-journey)
- [Next.js Deployment on AWS Lambda](https://dev.to/aws-builders/nextjs-deployment-on-aws-lambda-ecs-amplify-and-vercel-what-i-learned-nmc)

---

### Pitfall 5: Build Artifact Storage Costs Balloon Silently

**What goes wrong:** Each deployment creates 200MB+ of artifacts in S3. With 50 sites × 10 deployments/day × 30 days = 300GB/month. Old artifacts never deleted. After 6 months: 2TB in S3 costing $50+/month for data never accessed again.

**Why it happens:** S3 storage seems cheap ($0.023/GB). Build systems store artifacts but never implement retention policies. Costs accumulate silently over months.

**How to avoid:**
- Implement S3 lifecycle policies from day one (in Phase 1, not "later")
- Move to Glacier after 30 days (80% cost reduction)
- Delete after 90 days (or keep last N versions for rollback)
- Monitor S3 storage costs weekly, alert on anomalies
- Use content-addressed storage (hash-based keys) to prevent duplicate uploads

**Warning signs:**
- S3 storage costs increasing linearly over time
- Old build artifacts from months ago still in S3 Standard tier
- S3 bucket size > 100GB per project (warning threshold)

**Phase 1 mitigation:** Include lifecycle policies in initial S3 bucket creation (see Pattern 4 above). Set retention to 90 days for artifacts, 30 days → Glacier for logs.

**Cost calculation:**
- Without policies: 50 sites × 200MB × 10 deploys/day × 365 days = 36TB/year × $0.023/GB = $840/year wasted
- With policies: 50 sites × 200MB × 10 deploys/day × 90 days = 9TB × $0.023/GB = $207/year (73% reduction)
- With Glacier transition: 90-day data in Standard ($207) + 1-year archive in Glacier ($36) = $243/year (71% reduction)

**Sources:**
- [Expensive S3 Storage Mistakes and How to Fix Them](https://www.databricks.com/blog/expensive-delta-lake-s3-storage-mistakes-and-how-fix-them)
- [How to Cut Your AWS S3 Costs](https://www.eon.io/blog/cut-aws-s3-costs)

---

### Pitfall 6: GitHub Webhook Security Vulnerabilities

**What goes wrong:** Webhook endpoint doesn't validate signatures. Attacker sends fake webhook payloads to trigger builds, delete deployments, or inject malicious code into build process.

**Why it happens:** Developers skip signature validation in MVP ("we'll add it later"). Webhook endpoint is public, anyone can POST to it.

**How to avoid:**
- Validate HMAC-SHA256 signature on EVERY webhook (no exceptions)
- Use crypto.timingSafeEqual for comparison (prevents timing attacks)
- Reject webhooks with invalid signatures (401 Unauthorized)
- Store webhook secret in AWS Secrets Manager (not environment variables)
- Log all webhook attempts (valid and invalid) for security monitoring

**Warning signs:**
- Webhook endpoint accepts any POST request
- No signature validation in webhook handler
- Webhook secret stored in plaintext in environment variables
- No security audit of webhook flow

**Phase 1 mitigation:** Implement signature validation in webhook handler from day one (see Pattern 3 example above). Never skip for MVP.

**Security pattern:**

```typescript
// GOOD: Timing-safe comparison prevents timing attacks
const signature = event.headers['x-hub-signature-256'];
const expectedSignature = 'sha256=' + crypto.createHmac('sha256', secret)
  .update(event.body).digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
  return { statusCode: 401, body: 'Invalid signature' };
}

// BAD: String comparison vulnerable to timing attacks
if (signature !== expectedSignature) { // NEVER DO THIS
  return { statusCode: 401, body: 'Invalid signature' };
}
```

**Sources:**
- [Validating Webhook Deliveries - GitHub Docs](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [How to Secure GitHub Webhooks with HMAC Signature](https://github.com/orgs/community/discussions/151674)
- [The Importance of Verifying Webhook Signatures](https://snyk.io/blog/verifying-webhook-signatures/)

## Code Examples

Verified patterns from official sources and production deployments:

### Example 1: DynamoDB Multi-Tenant Schema

```typescript
// Source: AWS DynamoDB Multi-Tenancy Patterns
// https://aws.amazon.com/blogs/database/amazon-dynamodb-data-modeling-for-multi-tenancy-part-1/

// Single-table design with tenant isolation
// All projects and deployments in one table, isolated by PK/SK and userId GSI

interface DynamoDBRecord {
  PK: string;           // Partition key
  SK: string;           // Sort key
  userId: string;       // Tenant ID (owner) - GSI
  entityType: string;   // "PROJECT" | "DEPLOYMENT"
  // ... entity-specific fields
}

// Projects table access patterns
const getProject = async (projectId: string, userId: string) => {
  return dynamodb.getItem({
    TableName: 'Platform',
    Key: {
      PK: `PROJECT#${projectId}`,
      SK: 'METADATA'
    },
    // Verify ownership after retrieval
    ConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  });
};

const listUserProjects = async (userId: string) => {
  return dynamodb.query({
    TableName: 'Platform',
    IndexName: 'UserIdIndex',  // GSI: userId (PK), entityType (SK)
    KeyConditionExpression: 'userId = :userId AND entityType = :type',
    ExpressionAttributeValues: {
      ':userId': userId,
      ':type': 'PROJECT'
    }
  });
};

// Deployments table access patterns
const listProjectDeployments = async (projectId: string, userId: string) => {
  // First verify project ownership
  await getProject(projectId, userId);

  // Then query deployments
  return dynamodb.query({
    TableName: 'Platform',
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `PROJECT#${projectId}`,
      ':sk': 'DEPLOYMENT#'
    }
  });
};
```

**Schema design:**

```typescript
// Projects
PK: PROJECT#{projectId}
SK: METADATA
userId: {userId}
entityType: PROJECT
name: "my-site"
repoUrl: "https://github.com/user/repo"
branch: "main"
// ... other fields

// Deployments for a project
PK: PROJECT#{projectId}
SK: DEPLOYMENT#{timestamp}#{deploymentId}
userId: {userId}  // Inherited from project
entityType: DEPLOYMENT
status: "success"
commitSha: "abc123"
// ... other fields

// GSI: UserIdIndex
// PK: userId
// SK: entityType#{timestamp}  // Sort by entity type, then time
```

**Why this pattern:** Efficient queries for "all projects for user" (GSI query) and "all deployments for project" (table query). Single table reduces costs, operational complexity vs 50 separate tables.

### Example 2: CodeBuild Buildspec for OpenNext

```yaml
# Source: OpenNext + CodeBuild Configuration
# https://opennext.js.org/aws/config
# https://docs.aws.amazon.com/codebuild/latest/userguide/getting-started-cli-create-build-spec.html

# buildspecs/nextjs-build.yml
version: 0.2

env:
  variables:
    # These are set by build orchestrator Lambda
    # PROJECT_ID: "abc123"
    # REPO_URL: "https://github.com/user/repo"
    # COMMIT_SHA: "def456"
    NODE_ENV: "production"
  parameter-store:
    # Retrieve from AWS Systems Manager Parameter Store
    GITHUB_TOKEN: /anchor-deploy/github-token
  secrets-manager:
    # Retrieve from AWS Secrets Manager (alternative)
    # NPM_TOKEN: prod/anchor-deploy/npm-token

phases:
  install:
    runtime-versions:
      nodejs: 22  # Node.js 22 LTS
    commands:
      - echo "Installing dependencies..."
      - npm install -g pnpm@latest  # Or npm, yarn

  pre_build:
    commands:
      - echo "Cloning repository $REPO_URL at $COMMIT_SHA"
      # CodeBuild auto-clones if source is GitHub, but for flexibility:
      - git clone $REPO_URL app
      - cd app
      - git checkout $COMMIT_SHA
      - echo "Installing project dependencies..."
      - pnpm install --frozen-lockfile

  build:
    commands:
      - echo "Building Next.js application..."
      - pnpm run build  # Runs next build with standalone output

      - echo "Running OpenNext adapter..."
      - npx open-next@latest build
      # Outputs: .open-next/server-function (Lambda code)
      #          .open-next/image-optimization-function
      #          .open-next/assets (static files for S3)

  post_build:
    commands:
      - echo "Uploading build artifacts to S3..."
      - |
        # Package Lambda function code
        cd .open-next/server-function
        zip -r ../../lambda.zip .
        cd ../..

        # Upload to S3
        aws s3 cp lambda.zip s3://$ARTIFACTS_BUCKET/artifacts/$PROJECT_ID/$COMMIT_SHA/lambda.zip
        aws s3 sync .open-next/assets s3://$ARTIFACTS_BUCKET/static/$PROJECT_ID/$COMMIT_SHA/

        echo "Build complete for deployment $COMMIT_SHA"

artifacts:
  files:
    - '**/*'
  base-directory: .open-next
  name: build-output-$COMMIT_SHA

cache:
  paths:
    - 'node_modules/**/*'  # Cache node_modules across builds
    - '.next/cache/**/*'   # Cache Next.js build cache
```

**Key decisions in buildspec:**
- Node.js 22 runtime (LTS until April 2027)
- OpenNext packaging for Lambda compatibility
- S3 upload in post_build (artifacts available for deployment phase)
- Cache node_modules and .next/cache (5min → 30sec builds)

**Environment variables handling:**
- Build-time: Injected via CodeBuild environment variables
- Runtime: Stored in DynamoDB per project, injected into Lambda during deployment

### Example 3: GitHub Webhook Signature Validation

```typescript
// Source: GitHub Official Documentation
// https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries

import crypto from 'crypto';
import type { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async (event) => {
  // 1. Extract signature from header
  const signature = event.headers['x-hub-signature-256'];
  if (!signature) {
    return { statusCode: 401, body: 'Missing signature header' };
  }

  // 2. Retrieve webhook secret (from environment or Secrets Manager)
  const secret = process.env.WEBHOOK_SECRET!;
  // Production: Retrieve from AWS Secrets Manager
  // const secret = await getSecret('github-webhook-secret');

  // 3. Compute expected signature
  const hmac = crypto.createHmac('sha256', secret);
  const expectedSignature = 'sha256=' + hmac.update(event.body!).digest('hex');

  // 4. Timing-safe comparison (prevents timing attacks)
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    console.error('Invalid webhook signature', {
      received: signature,
      expected: expectedSignature.substring(0, 20) + '...' // Log prefix only
    });
    return { statusCode: 401, body: 'Invalid signature' };
  }

  // 5. Signature valid, process webhook
  console.log('Valid webhook signature');

  // Parse payload
  const payload = JSON.parse(event.body!);

  // Process webhook (enqueue build, etc.)
  // ...

  return { statusCode: 200, body: 'OK' };
};
```

**Security critical:**
- Use `crypto.timingSafeEqual` (constant-time comparison) NOT `===` (timing attack vulnerable)
- Verify signature BEFORE processing payload
- Log signature validation failures for security monitoring
- Store webhook secret in Secrets Manager (not environment variables in production)

**Sources:**
- [GitHub Webhook Signature Validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [Verify GitHub Webhook Signature in Node.js](https://gist.github.com/stigok/57d075c1cf2a609cb758898c0b202428)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| serverless-nextjs (Lambda@Edge) | OpenNext v3 (Regional Lambda) | 2023-2024 | Lambda@Edge deprecated due to 1MB limit, high costs, complexity. OpenNext is new standard. Regional Lambda 40% cheaper, simpler debugging. |
| AWS CDK for Next.js | SST Ion v3 | 2024-2025 | SST Ion uses Pulumi/Terraform (faster than CloudFormation). Opinionated, batteries-included for Next.js. CDK still viable for deep customization. |
| CloudFormation IaC | Pulumi/Terraform via SST | 2024-2025 | CloudFormation deploys take 10+ minutes. Pulumi/Terraform 2-3 minutes. SST Ion wraps Pulumi for best DX. |
| Lambda zip packages for Next.js | Lambda Container Images | 2023-2024 | Next.js apps exceed 250MB. Container Images (10GB limit) now standard. AWS optimized base images (fast cold starts). |
| Node.js 18 runtime | Node.js 22 runtime | 2025-2026 | Node.js 18 EOL March 2026. Node.js 20 EOL April 2026. Node.js 22 LTS until April 2027. Node.js 24 available but less ecosystem stability. |

**Deprecated/outdated:**
- **serverless-nextjs Component:** Uses deprecated Serverless Framework Components (Beta). Lambda@Edge approach. Not maintained actively. OpenNext is successor.
- **Node.js 18/20 runtimes:** EOL in early 2026. Must use Node.js 22 for new projects.
- **Next.js 13 App Router (old):** Next.js 15 is current. OpenNext v3 supports all Next.js 15 features.
- **AWS Amplify for multi-tenant platforms:** Amplify is managed service for single apps, not multi-tenant platforms. Use SST for platform.

## Open Questions

Things that couldn't be fully resolved and require validation during Phase 1 execution:

### 1. OpenNext Next.js 15 Full Feature Compatibility

**What we know:**
- OpenNext v3 officially supports Next.js 15
- App Router routing is supported but uses custom routing system (not Next.js default)
- Server Actions confirmed working in latest OpenNext v3
- Main branch tested against latest Next.js continuously

**What's unclear:**
- Specific compatibility with Partial Prerendering (PPR) in Next.js 15 - not explicitly documented
- Image optimization performance on Lambda vs Edge (cold start impact)
- Middleware behavior differences between Vercel and OpenNext/Lambda
- React 19 Server Components compatibility (Next.js 15 default)

**Recommendation:**
Build test Next.js 15 apps with all features during Phase 1:
- Create test app with App Router, Server Actions, Server Components, PPR, Image Optimization, Middleware
- Deploy via OpenNext to staging environment
- Test all features end-to-end
- Document any limitations or workarounds found
- If gaps found, research workarounds or contribute to OpenNext project

**Sources to verify:**
- [OpenNext Compatibility](https://opennext.js.org/aws/compatibility)
- [OpenNext GitHub Issues](https://github.com/opennextjs/opennextjs-aws/issues)

### 2. Build Artifact Deduplication Strategy

**What we know:**
- Content-addressed storage (hash-based S3 keys) prevents duplicate uploads
- S3 lifecycle policies handle retention
- 50 sites with similar dependencies waste storage on duplicate node_modules

**What's unclear:**
- Whether to implement artifact deduplication layer (shared node_modules cache)
- Performance vs complexity tradeoff for deduplication
- Savings estimate: if 50 sites use similar dependencies, shared cache could save 80% storage
- But adds complexity in build process (cache lookup, partial uploads)

**Recommendation:**
Start without deduplication (simpler). Measure actual S3 costs in Phase 1. If costs exceed $50/month for artifacts, implement deduplication in Phase 2:
- Use content-addressed storage (SHA256 hash of artifacts)
- Shared cache bucket for common dependencies
- Build process checks cache before npm install
- Lifecycle policies on cache bucket (90-day retention)

**Decision criteria:** Implement if S3 artifact costs > $50/month OR build times > 5 minutes (cache helps both).

### 3. CodeBuild Concurrency Limits at Scale

**What we know:**
- CodeBuild default concurrent builds: 20 per region
- Soft limit, can request increase to 100
- 50 sites × 10 deploys/day = 500 builds/day = 21 builds/hour average
- Peak traffic (morning pushes): 50 builds/hour

**What's unclear:**
- Real-world limit before performance degrades
- Whether 20 concurrent builds is sufficient for 50 sites with spiky traffic
- Cost of provisioned CodeBuild fleet vs on-demand
- Whether to implement build queue priority (production builds first)

**Recommendation:**
Start with default 20 concurrent builds. Monitor queue depth in Phase 1:
- If queue depth regularly exceeds 10 builds, request limit increase to 50
- If queue depth exceeds 50, implement priority queue (production > staging > dev)
- At 500+ sites, consider dedicated CodeBuild fleet (self-managed EC2 Auto Scaling)

**Monitoring:** CloudWatch metric `QueueDepth` on SQS build queue. Alert if > 20 for 5 minutes.

### 4. DynamoDB Capacity Planning (On-Demand vs Provisioned)

**What we know:**
- DynamoDB on-demand pricing: $1.25 per million writes, $0.25 per million reads
- Provisioned pricing: $0.47 per WCU/month, $0.09 per RCU/month
- Break-even point: ~2M writes/month (provisioned becomes cheaper)

**What's unclear:**
- Actual read/write patterns for 50 sites
- Whether deployment spikes cause on-demand cost spikes
- Whether to use provisioned capacity with auto-scaling from start

**Recommendation:**
Start with on-demand for simplicity. Switch to provisioned when costs exceed $50/month:
- On-demand for first 3 months (measure actual usage)
- If sustained traffic > 1M writes/month, switch to provisioned with auto-scaling
- Keep on-demand for low-traffic tables (Domains, Users)

**Cost estimate (50 sites):**
- Deployments table: 500 writes/day × 30 = 15K writes/month = $0.02/month
- Projects table: 50 writes (new projects) + 500 reads/day = $0.04/month
- Total: ~$0.10/month on-demand (far below break-even)

**Decision:** Use on-demand for Phase 1, revisit in Phase 3 if costs > $50/month.

## Sources

### Primary (HIGH confidence)

**Official AWS Documentation:**
- [AWS Lambda Runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html) - Node.js 22 LTS verified
- [Using Amazon RDS Proxy with AWS Lambda](https://aws.amazon.com/blogs/compute/using-amazon-rds-proxy-with-aws-lambda/) - Connection pooling for Lambda
- [Amazon DynamoDB Data Modeling for Multi-Tenancy - Part 1](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-modeling-for-multi-tenancy-part-1/) - Multi-tenant DynamoDB patterns
- [AWS CodeBuild User Guide](https://docs.aws.amazon.com/codebuild/latest/userguide/getting-started-cli-create-build-spec.html) - Buildspec configuration
- [Amazon S3 Lifecycle Policies](https://www.cloudoptimo.com/blog/s3-lifecycle-policies-optimizing-cloud-storage-in-aws/) - Artifact retention

**OpenNext Official:**
- [OpenNext Documentation](https://opennext.js.org/aws) - Architecture, configuration, compatibility
- [OpenNext GitHub](https://github.com/opennextjs/opennextjs-aws) - Active development, issues, examples
- [OpenNext Compatibility](https://opennext.js.org/aws/compatibility) - Next.js 15 features support

**SST Official:**
- [SST Ion with Next.js](https://sst.dev/docs/start/aws/nextjs/) - Infrastructure setup
- [SST Dynamo Component](https://sst.dev/docs/component/aws/dynamo/) - DynamoDB configuration

**GitHub Official:**
- [Validating Webhook Deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) - HMAC signature validation

### Secondary (MEDIUM confidence)

**Production Experience Articles (2025-2026):**
- [A Fully Serverless Approach for Next.js in AWS (Jan 2026)](https://medium.com/@nadun1indunil/a-fully-serverless-approach-for-next-js-in-aws-6099216b1e20) - OpenNext + SST patterns
- [Next.js Deployment on AWS Lambda - What I Learned](https://dev.to/aws-builders/nextjs-deployment-on-aws-lambda-ecs-amplify-and-vercel-what-i-learned-nmc) - Lambda size limits, NODE_ENV pitfall
- [Let Your AWS Lambdas Survive Thousands of Connections](https://neon.com/blog/survive-thousands-connections) - RDS Proxy pattern (Note: DynamoDB recommended for this project, RDS Proxy for reference only)

**AWS Service Guides:**
- [Single-Table vs Multi-Table Design in Amazon DynamoDB](https://aws.amazon.com/blogs/database/single-table-vs-multi-table-design-in-amazon-dynamodb/) - Schema design patterns
- [Creating a Single-Table Design with Amazon DynamoDB](https://aws.amazon.com/blogs/compute/creating-a-single-table-design-with-amazon-dynamodb/) - Implementation patterns

**Community Best Practices:**
- [GitHub Webhook Security with HMAC Signature](https://github.com/orgs/community/discussions/151674) - Security patterns
- [How to Implement SHA256 Webhook Signature Verification](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) - Implementation guide

### Tertiary (LOW confidence, needs validation)

**Environment Variables Handling:**
- [Next.js Environment Variables Guide](https://nextjs.org/docs/pages/guides/environment-variables) - Build-time vs runtime distinction
- [Next.js Runtime Environment Variables Discussion](https://github.com/vercel/next.js/discussions/44628) - Community patterns

**S3 Lifecycle Cost Optimization:**
- [Expensive S3 Storage Mistakes and How to Fix Them](https://www.databricks.com/blog/expensive-delta-lake-s3-storage-mistakes-and-how-fix-them) - Lifecycle policies
- [How to Cut Your AWS S3 Costs](https://www.eon.io/blog/cut-aws-s3-costs) - Smart lifecycle policies

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack (SST, OpenNext, CodeBuild) | HIGH | Official documentation, active GitHub commits Jan 2026, production usage verified |
| DynamoDB Multi-Tenant Patterns | HIGH | AWS official guides, multiple production examples 2025-2026 |
| GitHub Webhook Security | HIGH | GitHub official docs, verified code examples |
| Lambda Container Images vs Zip | HIGH | AWS official docs, production post-mortems |
| S3 Lifecycle Policies | HIGH | AWS official docs, cost optimization guides 2025-2026 |
| CodeBuild Buildspec for OpenNext | MEDIUM | Official OpenNext docs + community buildspec examples (no official combined example) |
| OpenNext Next.js 15 Full Compatibility | MEDIUM | OpenNext docs claim support, but specific features (PPR) not fully documented. Needs testing. |
| Build Artifact Deduplication | LOW | Community patterns exist, but cost/benefit unclear for this scale. Needs measurement. |
| DynamoDB Capacity Planning | MEDIUM | AWS pricing calculator + common patterns, but actual usage needs measurement |

**Research date:** 2026-02-01

**Valid until:** 2026-04-01 (60 days - stable AWS services, but OpenNext evolves quickly with Next.js releases)

**Recommended re-research triggers:**
- Next.js 16 release
- OpenNext v4 release
- AWS Lambda runtime changes (Node.js 24 LTS)
- AWS service pricing changes

---

## Critical Decisions Required Before Phase 1 Planning

These decisions must be made NOW (not during implementation):

### Decision 1: Multi-Tenant Data Isolation Model ⚠️ BLOCKING

**Options:**
1. **Row-level security (shared tables)** - All projects in one table, filtered by userId
2. **Schema-per-tenant** - Separate DynamoDB table per project
3. **Database-per-tenant** - Separate DynamoDB instance per project

**Recommendation:** Row-level security (option 1) for v1

**Rationale:**
- Simpler: 3 shared tables vs 150+ tables (50 projects × 3 tables)
- Cheaper: On-demand pricing same, but operational overhead lower
- Sufficient isolation: Internal use (Anchor Digital clients), not SaaS product
- Easier migrations: Schema changes affect 3 tables, not 150
- Standard pattern: Used by Vercel, Netlify, Railway for this scale

**Impact if deferred:** Cannot retrofit after launch without full migration affecting all sites

**Must be decided:** Before writing DynamoDB schema in Phase 1

---

### Decision 2: Artifact Retention Policy

**Options:**
1. **Time-based:** Delete after 90 days
2. **Count-based:** Keep last 100 successful builds
3. **Hybrid:** Keep last 100 OR 90 days, whichever is more

**Recommendation:** Hybrid (option 3) - last 100 builds OR 90 days, whichever retains more data

**Rationale:**
- Low-traffic sites: 100 builds might span 6 months (time-based would delete too soon)
- High-traffic sites: 100 builds might span 10 days (count-based would delete too soon)
- Hybrid ensures both cases covered

**Configuration:**
```typescript
// S3 lifecycle policy
expiration: { days: 90 },  // Time-based
// + Lambda cleanup job that keeps last 100 per project (count-based)
```

**Impact if deferred:** Cannot retroactively apply to existing artifacts (objects already stored stay in expensive tier)

**Must be decided:** Before creating S3 buckets in Phase 1

---

### Decision 3: Environment Variables Storage Strategy

**Options:**
1. **DynamoDB only** - Store all env vars in Projects table
2. **Secrets Manager for sensitive** - Store sensitive vars in Secrets Manager, others in DynamoDB
3. **Parameter Store for all** - Use AWS Systems Manager Parameter Store

**Recommendation:** DynamoDB for build-time env vars, Secrets Manager for secrets (option 2)

**Rationale:**
- Build-time vars (PUBLIC_API_URL, etc.): DynamoDB (fast, cheap, no secrets)
- Runtime secrets (API keys, DB passwords): Secrets Manager (encryption, rotation, audit)
- Avoids Lambda cold start penalty fetching from Secrets Manager for every invocation
- Clear separation: public config in DynamoDB, secrets in Secrets Manager

**Configuration:**
```typescript
// Projects table
envVars: {
  NEXT_PUBLIC_API_URL: "https://api.example.com",  // Build-time, public
  NEXT_PUBLIC_SITE_NAME: "My Site"
}
secretRefs: {
  API_SECRET_KEY: "arn:aws:secretsmanager:...",  // Reference to Secrets Manager
}
```

**Impact if deferred:** Can migrate later, but requires updating all Lambda functions

**Must be decided:** Before implementing environment variables in Phase 1

---

**Summary:** All three decisions affect Phase 1 architecture and should be finalized before planning begins. Recommendations provided based on project constraints (internal use, 50 sites, cost efficiency).
