# Architecture Patterns: Serverless Next.js Deployment Platform

**Domain:** Serverless Next.js deployment platform on AWS
**Researched:** 2026-02-01
**Overall Confidence:** HIGH

## Executive Summary

A serverless Next.js deployment platform on AWS (like Vercel/Netlify) requires orchestrating multiple AWS services to handle the full deployment lifecycle: accepting GitHub webhooks, building Next.js applications in isolated containers, deploying build outputs to Lambda and S3, provisioning CloudFront distributions with custom domains and SSL certificates, and providing a management dashboard.

The architecture consists of **7 major subsystems** that interact through asynchronous events and shared data stores. The key insight from 2026 research is that **OpenNext has emerged as the standard adapter** for translating Next.js build outputs into AWS primitives, and **regional Lambda + CloudFront is strongly preferred over Lambda@Edge** for cost, latency, and operational simplicity.

For a platform targeting 50+ sites, a **pool-based multi-tenancy model** with shared infrastructure and per-tenant isolation at the data/execution level provides the best balance of cost efficiency and security.

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ANCHOR DEPLOY PLATFORM                        │
└─────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────┐
                                    │   GitHub     │
                                    │  Repository  │
                                    └──────┬───────┘
                                           │ webhook
                                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 1. WEBHOOK INGESTION                                                 │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ API Gateway│─────▶│ Lambda       │─────▶│ SQS Build Queue│    │
│    │ /webhook   │      │ (Validator)  │      │                │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2. BUILD ORCHESTRATION                                               │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ Lambda     │─────▶│ CodeBuild    │─────▶│ S3 Build       │    │
│    │ (Scheduler)│      │ (Container)  │      │ Artifacts      │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
│         │                     │                        │             │
│         │                     │ logs                   │             │
│         ▼                     ▼                        │             │
│    ┌────────────────────────────────┐                 │             │
│    │ DynamoDB - Deployments Table   │                 │             │
│    │ - deploymentId (PK)            │                 │             │
│    │ - projectId (GSI)              │                 │             │
│    │ - status, logs, artifacts      │                 │             │
│    └────────────────────────────────┘                 │             │
└──────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3. DEPLOYMENT PROVISIONING                                           │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ Lambda     │─────▶│ Lambda       │─────▶│ S3 Static      │    │
│    │ (Deploy    │      │ Functions    │      │ Assets         │    │
│    │ Orchestr.) │      │ (SSR/API)    │      │ (per version)  │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│                        ┌──────────────┐                             │
│                        │ API Gateway  │                             │
│                        │ (per project)│                             │
│                        └──────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4. CONTENT DELIVERY                                                  │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ CloudFront │─────▶│ Origin Group │─────▶│ S3 (static)    │    │
│    │ Distribution│      │              │      │ API GW (SSR)   │    │
│    │ (per project)│     │              │      │                │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
│         │                                                            │
│         │ custom domain                                             │
│         ▼                                                            │
│    ┌────────────┐                                                   │
│    │ Route 53   │                                                   │
│    │ A/AAAA     │                                                   │
│    └────────────┘                                                   │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 5. DOMAIN & CERTIFICATE MANAGEMENT                                   │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ Lambda     │─────▶│ ACM          │─────▶│ Route 53       │    │
│    │ (DNS       │      │ Certificate  │      │ Hosted Zones   │    │
│    │ Manager)   │      │ (auto-renew) │      │                │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
│                              │                                       │
│                              ▼                                       │
│                        ┌──────────────┐                             │
│                        │ DynamoDB     │                             │
│                        │ Domains Table│                             │
│                        └──────────────┘                             │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 6. METADATA & STATE MANAGEMENT                                       │
│    ┌────────────────────┐    ┌─────────────────────┐               │
│    │ DynamoDB           │    │ S3                  │               │
│    │ - Projects         │    │ - Build Logs        │               │
│    │ - Deployments      │    │ - Build Artifacts   │               │
│    │ - Domains          │    │ - Static Assets     │               │
│    │ - Build Logs Index │    │ - ISR Cache         │               │
│    └────────────────────┘    └─────────────────────┘               │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│ 7. MANAGEMENT DASHBOARD                                              │
│    ┌────────────┐      ┌──────────────┐      ┌────────────────┐    │
│    │ Next.js    │─────▶│ API Gateway  │─────▶│ Lambda         │    │
│    │ Dashboard  │      │ /api/*       │      │ (CRUD)         │    │
│    │ (Static)   │      │              │      │                │    │
│    └────────────┘      └──────────────┘      └────────────────┘    │
│         │                                              │             │
│         ▼                                              ▼             │
│    ┌────────────┐                              ┌────────────────┐  │
│    │ CloudFront │                              │ DynamoDB       │  │
│    │ (Dashboard)│                              │ (All Tables)   │  │
│    └────────────┘                              └────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### 1. Webhook Ingestion Layer

**Responsibility:** Accept and validate GitHub webhooks, enqueue build jobs

**Components:**
- **API Gateway** (`/webhook` endpoint) - Public HTTPS endpoint for GitHub webhooks
- **Lambda Validator** - Validates webhook signatures, checks project ownership, creates deployment record
- **SQS Build Queue** - Decouples webhook receipt from build execution, provides retry and DLQ

**Communicates With:**
- **Downstream:** Build Orchestration (via SQS)
- **Data:** DynamoDB Projects table (read), Deployments table (write)

**Key Decisions:**
- Use SQS instead of direct Lambda invocation for build isolation and retry capability
- Validate GitHub webhook signatures using HMAC-SHA256
- Create deployment record immediately with "queued" status for UI feedback

**Sources:**
- [GitHub Webhook CI/CD architecture](https://dev.to/techlabma/github-webhook-cicd-step-by-step-guide-1j6g)
- [AWS CodeBuild webhook integration](https://docs.aws.amazon.com/codebuild/latest/userguide/github-webhook.html)

---

### 2. Build Orchestration Layer

**Responsibility:** Execute builds in isolated containers, store build outputs

**Components:**
- **Lambda Scheduler** - Polls SQS, invokes CodeBuild, updates deployment status
- **CodeBuild Project** - Runs `npm install && npm run build` in Docker container
- **S3 Build Artifacts** - Stores `.next` build output and static assets
- **DynamoDB Deployments Table** - Tracks build status, logs, and artifact locations

**Communicates With:**
- **Upstream:** Webhook Ingestion (via SQS)
- **Downstream:** Deployment Provisioning (via EventBridge or direct invocation)
- **Data:** S3 (write artifacts), DynamoDB (write status/logs)

**Key Decisions:**
- **Use CodeBuild over Lambda for builds** - Lambda has 10GB ephemeral storage limit and 15-minute timeout; CodeBuild supports larger builds and longer execution
- **Store logs in S3, index in DynamoDB** - Logs can be large (10MB+); store full logs in S3, keep metadata in DynamoDB for query efficiency
- **Use OpenNext adapter** - Standard tool for converting Next.js build output to AWS Lambda packages

**Build Container Specs:**
- Image: `aws/codebuild/standard:7.0` (Node.js 18+, Docker)
- Ephemeral storage: 128GB (CodeBuild default)
- Timeout: 30 minutes
- Environment: Inject GitHub token, project config as env vars

**Sources:**
- [AWS Lambda ephemeral storage limits](https://aws.amazon.com/blogs/aws/aws-lambda-now-supports-up-to-10-gb-ephemeral-storage/)
- [CodeBuild vs Lambda for builds](https://github.com/aws-samples/aws-lambda-nextjs)
- [OpenNext architecture](https://opennext.js.org/aws/inner_workings/architecture)

---

### 3. Deployment Provisioning Layer

**Responsibility:** Deploy Next.js build output to Lambda, API Gateway, and S3

**Components:**
- **Lambda Deployment Orchestrator** - Reads build artifacts, provisions infrastructure
- **Lambda Functions (SSR/API routes)** - One function per project, handles all SSR and API route requests
- **API Gateway** - HTTP API per project, routes requests to Lambda
- **S3 Static Assets** - Versioned static files (JS, CSS, images)

**Communicates With:**
- **Upstream:** Build Orchestration (triggered after successful build)
- **Downstream:** Content Delivery (CloudFront origins)
- **Data:** S3 (read artifacts, write static assets), DynamoDB (update deployment status)

**Key Decisions:**
- **One Lambda function per project** - Not per route; Lambda handles routing internally using OpenNext server adapter
- **Use Lambda function URLs or API Gateway** - API Gateway provides better monitoring, throttling, and custom domain support
- **Versioned static asset paths** - Use build ID in S3 prefix (`/static/{buildId}/*`) for immutable deployments and cache efficiency
- **Blue-green deployment pattern** - Deploy new version alongside old, switch traffic atomically, keep old version for instant rollback

**Lambda Configuration:**
- Runtime: Node.js 18+
- Memory: 1024MB - 2048MB (based on app complexity)
- Timeout: 30 seconds (for SSR)
- Ephemeral storage: 512MB (default, sufficient for most apps)
- Environment: Inject build-time env vars, secrets from Secrets Manager

**Static Asset Strategy:**
- Path structure: `s3://bucket/{projectId}/static/{buildId}/*`
- Immutable files: Cache-Control `max-age=31536000, immutable`
- HTML files: Cache-Control `max-age=0, must-revalidate`

**Sources:**
- [Next.js build output structure](https://bitskingdom.com/blog/nextjs-when-to-use-ssr-vs-ssg-vs-isr/)
- [AWS blue-green deployments](https://aws.amazon.com/blogs/compute/zero-downtime-blue-green-deployments-with-amazon-api-gateway/)
- [S3 CloudFront versioning](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html)

---

### 4. Content Delivery Layer

**Responsibility:** Serve static assets and SSR content via global CDN

**Components:**
- **CloudFront Distribution** - One per project, global edge caching
- **Origin Group** - S3 origin for static assets, API Gateway origin for SSR/API
- **Cache Behaviors** - Different rules for `/static/*`, `/_next/*`, and SSR routes

**Communicates With:**
- **Upstream:** Deployment Provisioning (origins)
- **Downstream:** End users (via custom domains)
- **Data:** None directly

**Key Decisions:**
- **Regional Lambda + CloudFront, NOT Lambda@Edge** - Lambda@Edge has 13 regional edge caches, higher costs, deployment complexity, and data locality issues. Regional Lambda with CloudFront provides better cost, simpler ops, and easier multi-region data access if needed later.
- **Origin Groups for failover** - Primary origin = S3 (static), fallback origin = API Gateway (SSR)
- **Cache key customization** - Include `Accept-Encoding`, `Host` headers; exclude CloudFront-added headers

**Cache Behaviors:**

| Path Pattern | Origin | TTL | Notes |
|--------------|--------|-----|-------|
| `/static/*` | S3 | 1 year | Immutable static assets with build ID in path |
| `/_next/static/*` | S3 | 1 year | Next.js static chunks |
| `/_next/data/*` | API Gateway | 0 | SSR data fetching |
| `/_next/image/*` | API Gateway | 1 week | Next.js Image Optimization (run in Lambda) |
| `/api/*` | API Gateway | 0 | API routes (no cache) |
| `/*` (default) | API Gateway | 0 | SSR pages |

**CloudFront Configuration:**
- Price class: Price Class 200 (includes Singapore, excludes South America)
- HTTP/2 and HTTP/3 enabled
- Compression: Automatic (Brotli, Gzip)
- SSL/TLS: Minimum TLS 1.2

**Regional Lambda Advantages over Lambda@Edge:**
- **Cost:** Regional Lambda charged by GB-second; Lambda@Edge charged by GB-second + per-request. Regional is ~40% cheaper for SSR workloads.
- **Latency:** For Singapore-based apps with Singapore database, regional Lambda avoids cross-region latency to data sources. Lambda@Edge runs in 13 regions, creating 60ms+ cross-region latency for every database query.
- **Deployment:** Regional Lambda updates in seconds; Lambda@Edge takes 5-15 minutes to propagate to all edge locations.
- **Debugging:** Regional Lambda logs in CloudWatch Logs in one region; Lambda@Edge logs scattered across multiple regions.

**Sources:**
- [CloudFront vs Lambda@Edge tradeoffs](https://dev.to/shamsup/psa-lambdaedge-isnt-a-quick-win-3252)
- [Lambda@Edge data locality problem](https://medium.com/trackit/cloudfront-functions-vs-lambda-edge-which-one-should-you-choose-c88527647695)
- [AWS serverless Next.js architecture](https://aws.amazon.com/blogs/compute/zero-downtime-blue-green-deployments-with-amazon-api-gateway/)

---

### 5. Domain & Certificate Management Layer

**Responsibility:** Provision custom domains with SSL certificates, DNS routing

**Components:**
- **Lambda DNS Manager** - Provisions Route 53 records, requests ACM certificates
- **ACM (Certificate Manager)** - Automatic SSL certificate issuance and renewal
- **Route 53 Hosted Zones** - DNS management for custom domains
- **DynamoDB Domains Table** - Tracks domain-to-project mappings, certificate ARNs

**Communicates With:**
- **Upstream:** Management Dashboard (user requests custom domain)
- **Downstream:** Content Delivery (CloudFront uses ACM certificate)
- **Data:** DynamoDB Domains table (read/write), Route 53 (write)

**Key Decisions:**
- **DNS validation for ACM** - Use DNS validation (not email) for automatic certificate issuance and renewal
- **Automatic record creation** - When domain is in Route 53, create CNAME validation records automatically via AWS SDK
- **Certificate renewal monitoring** - ACM auto-renews; monitor via CloudWatch Events for renewal failures
- **Support both apex and www** - Create both `example.com` and `www.example.com` CNAME/ALIAS records

**Domain Provisioning Flow:**

1. User adds custom domain in dashboard
2. Lambda DNS Manager validates domain ownership (check existing DNS or require TXT record)
3. Request ACM certificate for domain (`example.com` and `www.example.com` as SANs)
4. If domain in Route 53, automatically create CNAME validation records
5. ACM validates domain (takes 5-15 minutes)
6. Update CloudFront distribution with custom domain and certificate
7. Create Route 53 ALIAS record pointing to CloudFront distribution
8. Store domain-to-project mapping in DynamoDB

**DynamoDB Domains Table Schema:**

```
domainId (PK) - UUID
projectId (GSI) - Links to project
domain - "example.com"
certificateArn - ACM ARN
status - "pending" | "active" | "failed"
validationMethod - "dns" | "http"
validationRecords - CNAME records for DNS validation
cloudfrontDistributionId - For updating CloudFront
createdAt, updatedAt
```

**Sources:**
- [AWS ACM DNS validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)
- [Route 53 ACM automation](https://medium.com/@XeusNguyen/create-ssl-cert-with-acm-and-route53-for-aws-services-3286984834f9)
- [Serverless domain automation](https://dev.to/aws-builders/serverless-framework-aws-automatically-creating-certificate-and-domain-for-your-app-5832)

---

### 6. Metadata & State Management Layer

**Responsibility:** Persistent storage for all platform state and artifacts

**Components:**
- **DynamoDB Tables** - Projects, Deployments, Domains, Build Logs Index
- **S3 Buckets** - Build logs (full text), build artifacts, static assets, ISR cache

**Communicates With:**
- **All other layers** - Central data store for entire platform

**DynamoDB Schema Design:**

**Projects Table:**

```
projectId (PK) - UUID
userId (GSI) - Owner
name - "my-app"
repoUrl - "https://github.com/user/repo"
branch - "main"
buildCommand - "npm run build"
installCommand - "npm install"
framework - "nextjs"
nodeVersion - "18"
envVars - Map of build-time env vars
webhookSecret - For GitHub signature validation
status - "active" | "paused"
createdAt, updatedAt
```

**Deployments Table:**

```
deploymentId (PK) - UUID
projectId (GSI) - Foreign key to Projects
commitSha - Git commit hash
status - "queued" | "building" | "deploying" | "success" | "failed"
buildStartTime, buildEndTime
deployStartTime, deployEndTime
buildLogS3Key - "logs/{projectId}/{deploymentId}.log"
artifactS3Key - "artifacts/{projectId}/{deploymentId}.zip"
lambdaFunctionArn - Deployed Lambda ARN
cloudfrontDistributionId - CloudFront distribution ID
errorMessage - If failed
createdAt, updatedAt
```

**Domains Table:**

```
domainId (PK) - UUID
projectId (GSI) - Foreign key to Projects
domain - "example.com"
certificateArn - ACM certificate ARN
status - "pending" | "active" | "failed"
validationRecords - CNAME records for ACM validation
cloudfrontDistributionId - Associated CloudFront distribution
createdAt, updatedAt
```

**Build Logs Index Table:**

```
logId (PK) - UUID
deploymentId (GSI) - Foreign key to Deployments
timestamp - ISO8601
level - "info" | "warn" | "error"
message - Log line (truncated to 1KB)
s3Key - Full log file location
```

**S3 Bucket Structure:**

```
anchor-deploy-artifacts-{region}/
  artifacts/
    {projectId}/
      {deploymentId}.zip - OpenNext build output
  logs/
    {projectId}/
      {deploymentId}.log - Full build logs
  static/
    {projectId}/
      {buildId}/
        static/* - Static assets (versioned by build ID)
  cache/
    {projectId}/
      isr/* - ISR cache data
```

**Key Decisions:**
- **DynamoDB for metadata** - Low latency, flexible schema, automatic scaling
- **S3 for large objects** - Build logs can exceed 10MB; store in S3, index in DynamoDB
- **GSI on projectId** - Enable efficient queries like "get all deployments for project X"
- **Versioned static assets in S3** - Use build ID in path for immutable deploys and CloudFront cache efficiency

**Sources:**
- [Deployment platform database schema](https://developer.harness.io/docs/database-devops/use-database-devops/deploying-database-schema/)
- [Multi-tenant DynamoDB patterns](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)

---

### 7. Management Dashboard Layer

**Responsibility:** User interface for managing projects, deployments, domains

**Components:**
- **Next.js Dashboard** - SPA deployed to CloudFront, static hosting on S3
- **API Gateway** - `/api/*` endpoints for dashboard API
- **Lambda CRUD Functions** - Handle project creation, deployment listing, domain management

**Communicates With:**
- **Downstream:** All other layers (via API Gateway + Lambda)
- **Data:** DynamoDB (all tables), S3 (read logs)

**Key Decisions:**
- **Dashboard is itself a Next.js app** - Dogfooding; deploy dashboard using same platform
- **Static export for dashboard** - Use `output: 'export'` for dashboard to avoid SSR complexity; pure static SPA
- **Separate CloudFront distribution** - Dashboard has different caching rules than user apps
- **Authentication via Cognito** - User pools for dashboard login, API Gateway authorizers

**API Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/{id}` | Get project details |
| PUT | `/api/projects/{id}` | Update project settings |
| DELETE | `/api/projects/{id}` | Delete project |
| GET | `/api/projects/{id}/deployments` | List deployments |
| POST | `/api/projects/{id}/deployments` | Trigger manual deploy |
| GET | `/api/deployments/{id}` | Get deployment details |
| GET | `/api/deployments/{id}/logs` | Stream build logs |
| POST | `/api/deployments/{id}/rollback` | Rollback to previous deployment |
| POST | `/api/domains` | Add custom domain |
| DELETE | `/api/domains/{id}` | Remove custom domain |

**Sources:**
- [Next.js static export](https://nextjs.org/docs/pages/guides/incremental-static-regeneration)

---

## Data Flow

### Deployment Flow (Happy Path)

```
1. Developer pushes to GitHub main branch
   ↓
2. GitHub sends webhook POST to API Gateway /webhook
   ↓
3. Lambda Validator:
   - Validates HMAC signature
   - Checks projectId exists in DynamoDB
   - Creates deployment record (status: "queued")
   - Sends message to SQS Build Queue
   ↓
4. Lambda Scheduler (SQS consumer):
   - Receives message from queue
   - Updates deployment (status: "building")
   - Starts CodeBuild project with:
     * GitHub repo URL
     * Commit SHA
     * Build command
     * Environment variables
   ↓
5. CodeBuild:
   - Clones GitHub repo
   - Runs npm install
   - Runs npm run build (Next.js build)
   - Runs OpenNext adapter to convert .next to Lambda packages
   - Uploads artifacts to S3
   - Streams logs to CloudWatch and S3
   - On success: triggers Lambda Deployment Orchestrator
   - On failure: updates deployment (status: "failed")
   ↓
6. Lambda Deployment Orchestrator:
   - Downloads artifacts from S3
   - Creates/updates Lambda function with SSR handler
   - Creates/updates API Gateway with Lambda integration
   - Uploads static assets to S3 with versioned paths
   - Updates deployment (status: "deploying")
   ↓
7. CloudFront cache invalidation (optional):
   - If HTML files changed, invalidate CloudFront paths
   - Or: use versioned paths (preferred) to skip invalidation
   ↓
8. Lambda Deployment Orchestrator:
   - Updates deployment (status: "success")
   - Stores Lambda ARN, CloudFront distribution ID
   ↓
9. User accesses custom domain:
   - DNS resolves to CloudFront
   - CloudFront checks cache:
     * Cache hit: Return cached response
     * Cache miss: Route to origin (S3 or API Gateway)
   - S3 serves static assets
   - API Gateway → Lambda serves SSR pages and API routes
```

### Custom Domain Provisioning Flow

```
1. User adds custom domain in dashboard
   ↓
2. Dashboard API → Lambda DNS Manager:
   - Validates domain format
   - Creates domain record in DynamoDB (status: "pending")
   ↓
3. Lambda DNS Manager → ACM:
   - Requests certificate for domain + www subdomain
   - Specifies DNS validation method
   ↓
4. ACM returns validation CNAME records
   ↓
5. Lambda DNS Manager → Route 53:
   - If domain in Route 53, create CNAME validation records
   - If domain external, return CNAME records to user
   ↓
6. ACM validates domain (5-15 minutes):
   - Checks CNAME records exist
   - Issues certificate
   ↓
7. Lambda DNS Manager (CloudWatch Event trigger):
   - Receives ACM validation success event
   - Updates domain record (status: "active")
   - Updates CloudFront distribution:
     * Add domain to Aliases
     * Attach ACM certificate
   ↓
8. Lambda DNS Manager → Route 53:
   - Create ALIAS record pointing to CloudFront distribution
   ↓
9. DNS propagates (1-48 hours):
   - Users can access site via custom domain
```

### Rollback Flow

```
1. User clicks "Rollback" in dashboard
   ↓
2. Dashboard API → Lambda Deployment Orchestrator:
   - Finds previous successful deployment
   - Reads artifact S3 key and Lambda ARN from DynamoDB
   ↓
3. Lambda Deployment Orchestrator:
   - Updates API Gateway to point to previous Lambda version
   - Updates CloudFront origin (if needed)
   - Creates new deployment record (type: "rollback")
   ↓
4. API Gateway:
   - Routes traffic to old Lambda function version
   - New deployment is still deployed but receives no traffic
   ↓
5. Rollback completes in < 1 minute (blue-green pattern)
```

## Cross-Cutting Concerns

### Security

**Authentication & Authorization:**
- Dashboard: AWS Cognito User Pools + Identity Pools
- API Gateway: Cognito Authorizers on all `/api/*` endpoints
- GitHub webhooks: HMAC-SHA256 signature validation
- Inter-service: IAM roles with least-privilege policies

**Secrets Management:**
- GitHub tokens: AWS Secrets Manager
- Webhook secrets: Per-project secrets in DynamoDB (encrypted)
- User env vars: Secrets Manager or DynamoDB (encrypted at rest)

**Network Isolation:**
- Lambda functions in VPC (optional, for RDS access later)
- Security groups: Allow outbound HTTPS only
- API Gateway: Resource policies to limit access
- S3 buckets: Block public access, use CloudFront OAI

**Tenant Isolation:**
- Pool-based multi-tenancy: All projects share infrastructure
- Isolation enforced at data layer: DynamoDB queries filtered by userId/projectId
- Lambda execution: Shared functions, but separate execution environments per invocation
- S3: Separate prefixes per project (`{projectId}/*`)

**Sources:**
- [AWS multi-tenant isolation](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)
- [Lambda tenant isolation mode](https://aws.amazon.com/blogs/aws/streamlined-multi-tenant-application-development-with-tenant-isolation-mode-in-aws-lambda/)

### Monitoring & Observability

**Metrics (CloudWatch):**
- Build duration, success/failure rate (per project)
- Lambda cold start duration, invocation count, errors
- API Gateway 4xx/5xx rates, latency p50/p95/p99
- CloudFront cache hit rate, origin latency
- DynamoDB read/write capacity units consumed

**Logs (CloudWatch Logs):**
- Build logs: CodeBuild → CloudWatch → S3 (long-term storage)
- Lambda logs: CloudWatch Logs (7-day retention)
- API Gateway access logs: CloudWatch Logs
- Dashboard: Client-side errors sent to CloudWatch via SDK

**Tracing (X-Ray):**
- Enable X-Ray on API Gateway and Lambda
- Trace deployment flow: Webhook → Build → Deploy
- Identify bottlenecks in SSR request handling

**Alerting (CloudWatch Alarms + SNS):**
- Build failure rate > 50% in 5 minutes
- Lambda error rate > 5% in 1 minute
- API Gateway latency p99 > 1 second
- CloudFront 5xx rate > 1% in 5 minutes

### Cost Optimization

**Architecture Choices:**
- Regional Lambda instead of Lambda@Edge: ~40% cost reduction for compute
- Versioned static assets: Eliminate CloudFront invalidation costs ($0.005 per path)
- DynamoDB on-demand: Pay only for actual reads/writes, no over-provisioning
- S3 Intelligent-Tiering: Automatic cost savings for infrequently accessed build artifacts

**Resource Lifecycle:**
- Delete old build artifacts after 90 days
- Delete old deployment records after 1 year (archive to S3/Glacier)
- CloudFront log retention: 30 days

**Scaling Assumptions (50 sites):**
- Average 5 deploys/day per site = 250 builds/day = 7500 builds/month
- Average build time: 3 minutes
- Average Lambda SSR requests: 100K/day per site = 5M/day total
- CloudFront requests: 1M/day per site = 50M/day total

**Estimated Monthly Cost (50 sites, Singapore region):**

| Service | Usage | Cost |
|---------|-------|------|
| CodeBuild | 7500 builds × 3 min = 375 build-hours | ~$15 |
| Lambda (SSR) | 150M requests × 1024MB × 200ms avg | ~$200 |
| API Gateway | 150M requests | ~$150 |
| CloudFront | 1.5B requests + 5TB data transfer | ~$350 |
| DynamoDB | 500M reads, 50M writes (on-demand) | ~$80 |
| S3 | 500GB storage, 5M GET, 500K PUT | ~$15 |
| ACM | 50 certificates | Free |
| Route 53 | 50 hosted zones, 150M queries | ~$30 |
| **Total** | | **~$840/month** |

**Cost per site: ~$17/month** (at 50 sites scale)

**Sources:**
- [AWS pricing calculator](https://calculator.aws/)

## Patterns to Follow

### Pattern 1: Immutable Deployments with Versioned Paths

**What:** Use build ID in static asset paths for immutable deploys and efficient caching.

**Why:** Avoids CloudFront invalidation costs and complexity; enables instant rollback.

**How:**
- Build process generates unique build ID (timestamp or commit SHA)
- Static assets uploaded to `s3://bucket/{projectId}/static/{buildId}/*`
- HTML references assets with versioned paths: `/static/{buildId}/main.js`
- CloudFront caches static assets with `max-age=31536000, immutable`
- Rollback: Just update HTML to reference old build ID

**Example:**

```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.ASSET_PREFIX || '',
  generateBuildId: async () => {
    return process.env.BUILD_ID || `${Date.now()}`;
  },
};
```

### Pattern 2: Blue-Green Deployment for Zero-Downtime Updates

**What:** Deploy new version alongside old version, switch traffic atomically.

**Why:** Enables instant rollback; no downtime during deployment.

**How:**
- Create new Lambda function version with new code
- Update API Gateway stage to point to new Lambda version
- Old Lambda version remains deployed for 24 hours (configurable)
- Rollback: Update API Gateway to point back to old version

**Example:**

```javascript
// Lambda deployment
const newVersion = await lambda.publishVersion({
  FunctionName: 'project-123-ssr',
  CodeSha256: buildArtifactSha,
}).promise();

// Update API Gateway
await apigateway.updateIntegration({
  restApiId: 'api-123',
  resourceId: 'resource-123',
  httpMethod: 'ANY',
  patchOperations: [{
    op: 'replace',
    path: '/uri',
    value: `arn:aws:lambda:${region}:${account}:function:project-123-ssr:${newVersion.Version}`,
  }],
}).promise();
```

### Pattern 3: Asynchronous Build Pipeline with Status Updates

**What:** Decouple webhook receipt from build execution; update UI with build progress.

**Why:** GitHub webhooks timeout after 10 seconds; builds take minutes.

**How:**
- Webhook handler returns 202 Accepted immediately
- Enqueues build job in SQS
- Build worker updates deployment status in DynamoDB
- Dashboard polls deployment status or uses WebSocket for real-time updates

**Example:**

```javascript
// Webhook handler
exports.handler = async (event) => {
  const { projectId, commitSha } = parseWebhook(event);

  const deploymentId = uuid();
  await dynamodb.putItem({
    TableName: 'Deployments',
    Item: { deploymentId, projectId, commitSha, status: 'queued' },
  });

  await sqs.sendMessage({
    QueueUrl: process.env.BUILD_QUEUE_URL,
    MessageBody: JSON.stringify({ deploymentId }),
  });

  return { statusCode: 202, body: JSON.stringify({ deploymentId }) };
};
```

### Pattern 4: Centralized Error Handling with Structured Logging

**What:** All Lambda functions use consistent error handling and logging format.

**Why:** Simplifies debugging; enables automated alerting on specific error patterns.

**How:**
- Wrap all Lambda handlers in try/catch
- Log errors with structured format (JSON)
- Include context: projectId, deploymentId, requestId
- Send critical errors to SNS for alerting

**Example:**

```javascript
const logger = require('./logger');

exports.handler = async (event) => {
  const context = {
    projectId: event.pathParameters.projectId,
    requestId: event.requestId,
  };

  try {
    logger.info('Starting deployment', context);
    await deployProject(event.pathParameters.projectId);
    logger.info('Deployment successful', context);
    return { statusCode: 200 };
  } catch (error) {
    logger.error('Deployment failed', { ...context, error: error.message, stack: error.stack });
    await sns.publish({
      TopicArn: process.env.ALERT_TOPIC_ARN,
      Message: `Deployment failed: ${error.message}`,
    });
    return { statusCode: 500, body: JSON.stringify({ error: 'Deployment failed' }) };
  }
};
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Lambda@Edge for SSR

**What:** Using Lambda@Edge to run Next.js SSR close to users.

**Why bad:**
- **Data locality problem:** SSR often queries databases; Lambda@Edge runs far from Singapore database, adding 60ms+ latency per query
- **Cost:** Lambda@Edge is 40% more expensive than regional Lambda for SSR workloads
- **Deployment complexity:** Lambda@Edge takes 5-15 minutes to propagate updates to all edge locations
- **Debugging:** Logs scattered across 13 regions

**Instead:** Use regional Lambda in Singapore with CloudFront in front. CloudFront provides global caching of SSR responses; Lambda stays close to database.

**Sources:**
- [Lambda@Edge isn't a quick win](https://dev.to/shamsup/psa-lambdaedge-isnt-a-quick-win-3252)
- [CloudFront vs Lambda@Edge tradeoffs](https://medium.com/trackit/cloudfront-functions-vs-lambda-edge-which-one-should-you-choose-c88527647695)

### Anti-Pattern 2: CloudFront Invalidation on Every Deploy

**What:** Invalidating CloudFront cache paths after every deployment to serve updated content.

**Why bad:**
- **Cost:** $0.005 per path, up to first 1000 paths free/month. For 50 sites × 5 deploys/day × 100 paths = 25K invalidations/month = $120/month
- **Latency:** Invalidations take 1-5 minutes to propagate
- **Complexity:** Must track which paths changed and invalidate only those

**Instead:** Use versioned static asset paths with build ID. No invalidation needed; users always get correct version based on HTML reference.

**Sources:**
- [S3 CloudFront versioning patterns](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html)

### Anti-Pattern 3: One Lambda Function per Route

**What:** Creating separate Lambda functions for each Next.js page or API route.

**Why bad:**
- **Management overhead:** 50 sites × 20 pages/APIs avg = 1000 Lambda functions to manage
- **Cold starts:** Each function warms up independently; more cold starts overall
- **Deployment complexity:** Must update 20+ functions per deployment
- **Cost:** More Lambda versions to track and clean up

**Instead:** Use one Lambda function per project that handles all routes. OpenNext server adapter routes internally; same pattern Vercel uses.

**Sources:**
- [OpenNext architecture](https://opennext.js.org/aws/inner_workings/architecture)

### Anti-Pattern 4: Synchronous Build in Webhook Handler

**What:** Running `npm install && npm run build` directly in Lambda function triggered by webhook.

**Why bad:**
- **Timeout:** Lambda has 15-minute max timeout; large builds may exceed this
- **Memory:** Lambda has 10GB max memory; node_modules can exceed this
- **GitHub timeout:** GitHub webhooks timeout after 10 seconds; build takes minutes
- **Retry issues:** If Lambda fails, GitHub retries webhook, triggering duplicate builds

**Instead:** Webhook handler returns immediately (202 Accepted), enqueues build in SQS, CodeBuild processes queue asynchronously.

**Sources:**
- [AWS Lambda limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)
- [GitHub webhook best practices](https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads)

### Anti-Pattern 5: Silo-Based Multi-Tenancy (Separate Infrastructure per Project)

**What:** Creating separate VPCs, CloudFront distributions, Lambda functions, etc. for each project.

**Why bad:**
- **Cost:** 50 sites × $30/month (CloudFront distribution) = $1500/month just for CloudFront
- **Quotas:** AWS has soft limits (e.g., 200 CloudFront distributions per account); requires quota increases
- **Management overhead:** 50× more resources to monitor, update, and troubleshoot
- **Slow provisioning:** Creating CloudFront distribution takes 10-15 minutes; bad UX

**Instead:** Use pool-based multi-tenancy: One shared CloudFront distribution (or a few), projects isolated by path prefix or origin headers. For this platform, one CloudFront distribution per project is reasonable (cost ~$30/month per project) but all other infrastructure is shared.

**When silo makes sense:** Enterprise customers requiring dedicated infrastructure for compliance or SLA guarantees.

**Sources:**
- [AWS multi-tenant patterns](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/tenant-isolation.html)
- [Multi-tenant SaaS on AWS](https://www.clickittech.com/software-development/multi-tenant-architecture/)

## Scalability Considerations

### At 10 Sites (MVP Scale)

**Architecture:**
- Single AWS account, Singapore region
- Shared CodeBuild project (concurrent builds: 5)
- Shared Lambda functions for control plane
- One CloudFront distribution per site
- DynamoDB on-demand pricing

**Bottlenecks:**
- None; all services auto-scale

**Cost:** ~$170/month (~$17/site)

---

### At 50 Sites (Target Scale)

**Architecture:**
- Single AWS account, Singapore region
- CodeBuild concurrent builds: 20 (soft limit increase)
- Lambda reserved concurrency: 100 per function (avoid cold starts)
- DynamoDB on-demand with DAX cache for hot queries
- CloudWatch Logs retention: 7 days

**Bottlenecks:**
- CodeBuild concurrency: Default 20, can request increase to 100
- Lambda concurrency: Default 1000 per region, sufficient for 50 sites
- API Gateway throttle: Default 10K requests/second, sufficient

**Optimizations:**
- Enable DynamoDB auto-scaling or use on-demand
- Use Lambda provisioned concurrency for SSR functions (reduce cold starts)
- Implement build queue priority (production builds first)

**Cost:** ~$840/month (~$17/site)

---

### At 500 Sites (Future Scale)

**Architecture:**
- Multi-account strategy: Separate AWS accounts for build plane and control plane
- Multi-region: Singapore primary, Tokyo failover
- Dedicated CodeBuild fleet (self-managed EC2 Auto Scaling for builds)
- DynamoDB global tables for cross-region replication
- Dedicated VPC for Lambda functions (access to RDS/ElastiCache)

**Bottlenecks:**
- CodeBuild concurrency: Switch to self-managed build fleet
- DynamoDB throughput: Move to provisioned capacity with auto-scaling
- CloudFront distributions: May hit 200-distribution limit; use shared distributions with origin headers for routing

**Optimizations:**
- Build queue with priority levels (production, preview, dev)
- Lambda provisioned concurrency for all SSR functions
- ElastiCache Redis for ISR cache (instead of S3)
- SQS FIFO queues for build ordering guarantees
- Step Functions for complex deployment workflows

**Cost:** ~$8K/month (~$16/site, economies of scale)

---

### At 5000 Sites (Vercel Scale)

**Architecture:**
- Multi-region active-active: Singapore, Tokyo, Sydney
- Dedicated build cluster: Kubernetes on EKS with spot instances
- CloudFront with Lambda@Edge for global edge caching (revisit decision)
- Federated GraphQL API for dashboard (split monolith)
- Separate AWS accounts per region
- Centralized monitoring with Datadog or New Relic

**Bottlenecks:**
- All services at scale; custom solutions required
- AWS quotas: Request increases for all services
- Multi-region consistency: CAP theorem challenges

**Optimizations:**
- Custom build orchestration (replace CodeBuild)
- Dedicated database: Aurora Serverless or DynamoDB global tables
- CDN multi-provider: Cloudflare Workers + AWS CloudFront for redundancy
- Advanced routing: Geo-based routing, custom traffic splitting
- Predictive scaling: ML-based capacity planning

**Cost:** ~$80K/month (~$16/site)

---

## Build Order & Dependency Graph

When building this platform from scratch, follow this order to minimize rework:

### Phase 1: Foundation (Week 1-2)

**What to build:**
1. DynamoDB schema (Projects, Deployments tables)
2. S3 buckets (build artifacts, static assets)
3. IAM roles and policies

**Why first:**
- All other components depend on data layer
- No external dependencies
- Can iterate on schema quickly

**Validation:**
- Can create project records in DynamoDB
- Can upload files to S3

---

### Phase 2: Build Pipeline (Week 3-4)

**What to build:**
1. GitHub webhook receiver (API Gateway + Lambda)
2. SQS build queue
3. CodeBuild project with OpenNext
4. Build orchestration Lambda

**Why second:**
- Tests end-to-end build flow
- No deployment complexity yet
- Can debug builds in isolation

**Validation:**
- Push to GitHub triggers build
- Build outputs stored in S3
- Deployment record updated in DynamoDB

---

### Phase 3: Deployment Engine (Week 5-6)

**What to build:**
1. Lambda deployment orchestrator
2. Lambda function provisioning (SSR/API)
3. API Gateway provisioning
4. Static asset upload to S3

**Why third:**
- Depends on build outputs from Phase 2
- Core value prop: Deploy to AWS
- No custom domain complexity yet

**Validation:**
- Built Next.js app deploys to Lambda
- Can access via API Gateway URL
- Static assets served from S3

---

### Phase 4: Content Delivery (Week 7-8)

**What to build:**
1. CloudFront distribution provisioning
2. Origin configuration (S3 + API Gateway)
3. Cache behavior rules
4. Versioned asset paths

**Why fourth:**
- Depends on deployment outputs from Phase 3
- Adds global CDN and caching
- Improves performance significantly

**Validation:**
- App accessible via CloudFront URL
- Static assets cached correctly
- SSR responses cached per TTL

---

### Phase 5: Custom Domains (Week 9-10)

**What to build:**
1. ACM certificate automation
2. Route 53 record provisioning
3. Domain validation flow
4. DynamoDB Domains table

**Why fifth:**
- Depends on CloudFront from Phase 4
- Complex async flow (certificate validation)
- Nice-to-have, not critical for MVP

**Validation:**
- Can add custom domain in UI
- Certificate issued automatically
- DNS resolves to CloudFront

---

### Phase 6: Dashboard (Week 11-12)

**What to build:**
1. Next.js dashboard SPA
2. API Gateway endpoints (CRUD)
3. Lambda API handlers
4. Cognito authentication

**Why sixth:**
- Depends on all backend services
- Provides UI for all features built so far
- Can use API directly before dashboard ready

**Validation:**
- Can create projects via UI
- Can view deployments and logs
- Can add custom domains

---

### Phase 7: Monitoring & Rollback (Week 13-14)

**What to build:**
1. CloudWatch dashboards
2. CloudWatch alarms
3. SNS alerting
4. Rollback API and UI

**Why seventh:**
- Operational feature, not core value prop
- Requires understanding of failure modes from earlier phases
- Adds production-readiness

**Validation:**
- Alarms trigger on build failures
- Can rollback deployments via UI
- Metrics dashboard shows health

---

## Key Takeaways for Roadmap

### Critical Path Dependencies

1. **Data layer before everything** - DynamoDB schema must be stable before building controllers
2. **Build before deploy** - Must have working build pipeline before deployment logic
3. **Deploy before CDN** - Must have working Lambda/S3 deploy before adding CloudFront
4. **CDN before domains** - CloudFront required for custom domain setup

### Parallelizable Work

- Dashboard can be built in parallel with backend (use API Gateway directly for testing)
- Monitoring can be added incrementally throughout all phases
- Custom domains can be deferred to post-MVP

### High-Risk Areas (Need Deeper Research)

1. **OpenNext compatibility** - Ensure all Next.js features work (App Router, Server Actions, ISR, Image Optimization)
2. **Build isolation** - Test concurrent builds don't interfere with each other
3. **Multi-region data** - If expanding beyond Singapore, DynamoDB global tables have consistency tradeoffs
4. **Cost at scale** - Validate cost assumptions with real-world usage patterns

### Low-Risk Areas (Standard Patterns)

1. **DynamoDB schema** - Well-understood patterns for SaaS platforms
2. **Lambda + API Gateway** - Battle-tested serverless pattern
3. **CloudFront + S3** - Standard static hosting pattern
4. **ACM + Route 53** - Automatic certificate management works reliably

---

## Sources

### High Confidence (Official Documentation, Context7)

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
- [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [AWS Certificate Manager Documentation](https://docs.aws.amazon.com/acm/)
- [OpenNext Documentation](https://opennext.js.org/aws/inner_workings/architecture)
- [Next.js Documentation - ISR](https://nextjs.org/docs/pages/guides/incremental-static-regeneration)

### Medium Confidence (WebSearch Verified, Recent Articles)

- [A Fully Serverless approach for Next.js in AWS (2026)](https://medium.com/@nadun1indunil/a-fully-serverless-approach-for-next-js-in-aws-6099216b1e20)
- [Vercel Infrastructure Deep Dive](https://vercel.com/blog/behind-the-scenes-of-vercels-infrastructure)
- [AWS Multi-Tenant Architectures (2026)](https://www.clickittech.com/software-development/multi-tenant-architecture/)
- [Lambda@Edge vs CloudFront Tradeoffs](https://dev.to/shamsup/psa-lambdaedge-isnt-a-quick-win-3252)
- [AWS Blue-Green Deployments (2025)](https://aws.amazon.com/blogs/compute/zero-downtime-blue-green-deployments-with-amazon-api-gateway/)

### Low Confidence (WebSearch Only, Needs Validation)

- Build duration estimates (need to test with real Next.js apps)
- Cost projections at 500+ sites (need to validate with AWS calculator)
- OpenNext support for all Next.js 15 features (need to verify in phase-specific research)

---

## Open Questions for Phase-Specific Research

1. **OpenNext Compatibility:** Does OpenNext support Next.js 15 App Router, Server Actions, and Partial Prerendering? (Research in build phase)

2. **ISR Cache Storage:** Should ISR cache use S3, ElastiCache Redis, or DynamoDB? Tradeoffs for cost and latency? (Research in deployment phase)

3. **Build Concurrency:** What's the real-world limit for concurrent CodeBuild projects before performance degrades? (Research in build phase)

4. **Lambda Cold Start Mitigation:** At what scale should we enable provisioned concurrency? Cost vs latency tradeoff? (Research in deployment phase)

5. **Multi-Region Strategy:** If expanding beyond Singapore, how to handle DynamoDB global tables consistency? (Research if multi-region becomes requirement)

6. **Image Optimization:** Should Next.js image optimization run in Lambda or use external service (Cloudinary, Imgix)? (Research in deployment phase)

7. **Log Retention:** What's the optimal log retention policy balancing cost and debuggability? (Research in monitoring phase)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Overall Architecture | HIGH | Well-established patterns; similar to Vercel/Netlify |
| Component Boundaries | HIGH | Clear separation of concerns; industry best practices |
| Data Flow | HIGH | Standard async pipeline pattern |
| Build Orchestration | HIGH | CodeBuild + OpenNext is proven approach |
| Deployment Strategy | HIGH | Lambda + API Gateway + CloudFront is battle-tested |
| Custom Domains | HIGH | ACM + Route 53 automation is well-documented |
| Multi-Tenancy | MEDIUM | Pool-based model is standard, but need to verify isolation at scale |
| Cost Projections | MEDIUM | Based on calculator, but need real-world validation |
| Scalability (500+ sites) | MEDIUM | Patterns exist, but may need custom solutions |
| OpenNext Next.js 15 Support | LOW | Need to verify all features work (App Router, Server Actions) |

---

## Recommended Next Steps

1. **Validate OpenNext with Next.js 15** - Build test apps with App Router, Server Actions, PPR; verify OpenNext compatibility
2. **Prototype build pipeline** - Implement Phases 1-2 as proof-of-concept; measure build times, resource usage
3. **Cost modeling** - Deploy 5 test sites, run for 1 month, measure actual AWS costs
4. **Define DynamoDB schema** - Finalize schema with consideration for future query patterns
5. **Security review** - Validate tenant isolation model with security team before implementing

---

**End of Architecture Research**
