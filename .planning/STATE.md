# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** When a developer pushes to main, the Next.js site is automatically built and deployed to production with zero manual intervention.

**Current focus:** Phase 2 - Deployment & CDN - Ready to plan

## Current Position

Phase: 2 of 3 (Deployment & CDN) - In progress
Plan: 3 of TBD in current phase
Status: Phase 2 in progress
Last activity: 2026-02-01 - Completed 02-03-PLAN.md (Rollback & Custom Domains)

Progress: [████░░░░░░] 47% (2/3 phases, Plan 02-03 complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 7
- Average duration: 9 min
- Total execution time: 1.05 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infrastructure-build | 4/4 | 35 min | 9 min |
| 02-deployment-cdn | 3/? | 28 min | 9 min |

**Recent Trend:**
- Last 5 plans: 01-04 (8 min), 02-01 (16 min), 02-02 (5 min), 02-03 (7 min)
- Trend: Stable at 9 min average

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Serverless over Docker: Cost efficiency at scale, pay only for usage
- Production-only deployments: Simplify v1 scope, preview can come later
- AWS Singapore region: Lowest latency to Cambodia users
- Web dashboard included: Needed for managing multiple sites effectively
- **Row-level security for tenant isolation:** Shared DynamoDB tables with userId GSI (01-01)
- **ON_DEMAND DynamoDB billing:** Low traffic, no benefit from provisioned (01-01)
- **90-day artifact retention:** Sufficient for rollback, prevents cost balloon (01-01)
- **Async 202 response pattern:** Webhook returns immediately, build processing via SQS (01-02)
- **timingSafeEqual for HMAC validation:** Prevents timing attacks on signature comparison (01-02)
- **Branch filter on main only:** Only process refs/heads/main pushes (01-02)
- **SQS visibility timeout 1800s:** Matches CodeBuild 30-minute timeout to prevent duplicate builds (01-03)
- **BUILD_GENERAL1_SMALL compute:** 3GB RAM needed for Next.js builds; nano causes OOM (01-03)
- **Embedded buildspec:** Inline in CodeBuild project for atomic deployment (01-03)
- **DLQ after 3 retries:** Balance recovery attempts vs investigation delay (01-03)
- **Structured EnvVar schema with isSecret flag:** Prepares for Secrets Manager migration in Phase 2 (01-04)
- **x-user-id header for Phase 1 auth:** Placeholder until dashboard auth in Phase 3 (01-04)
- **Polling-based logs:** Phase 1 uses REST polling; Phase 3 adds WebSocket/SSE (01-04)
- **S3 origin without OAC for Plan 01:** Deferred proper Origin Access Control to Plan 02 to avoid bucket policy conflicts (02-01)
- **Lambda Function URLs for CloudFront origins:** Simpler than ALB, lower cost (02-01)
- **Native CloudFront resource over SST Cdn:** Fine-grained cache behavior control needed for Next.js (02-01)
- **Lambda aliases for zero-downtime:** CloudFront invokes 'live' alias; deploy-handler atomically updates to new versions (02-02)
- **Separate staticAssetsBucket:** Deployed assets in dedicated bucket, different lifecycle from build artifacts (02-02)
- **Asynchronous deployment invocation:** CodeBuild triggers deploy-handler with Event type for faster build completion (02-02)
- **'built' deployment status:** Separates build completion from deployment start for clearer status tracking (02-02)
- **Lambda alias switching for rollback:** Instant (<1s) rollback by updating alias, no code re-upload needed (02-03)
- **ACM certificates in us-east-1:** CloudFront requires certificates in us-east-1 region (02-03)
- **Automatic CloudFront update on cert validation:** GET domain endpoint triggers distribution update when certificate becomes ISSUED (02-03)
- **CloudFrontStatus separate from certificateStatus:** Certificate can be ISSUED but CloudFront update failed, enables retry logic (02-03)

### Pending Todos

None.

### Blockers/Concerns

**Phase 1 - Architecture Decisions Required:**
- ~~Multi-tenant data isolation model~~ RESOLVED: Row-level security with userId GSI
- ~~Lambda packaging strategy~~ RESOLVED: OpenNext packaging to Lambda zip uploaded to S3
- ~~Database connection pooling strategy~~ NOT NEEDED: Using DynamoDB, no connection pooling required

**Phase 2 - Issues to Resolve:**
- ~~Lambda Function URL 403 Forbidden~~ NOT BLOCKING: Function URLs work, will address OAC in future if needed
- ~~S3 bucket policy for CloudFront OAC~~ DEFERRED: Using public bucket for now, OAC in future optimization
- ISR cache storage strategy (S3 vs ElastiCache vs DynamoDB) for cost/latency tradeoffs
- Certificate quota management strategy for scaling to 50+ custom domains
- **Deployment flow end-to-end verification needed:** Manual test to confirm build → deploy → CloudFront serving

**Phase 3 - Validation Needed:**
- OpenNext v3 compatibility with Next.js 15 features (App Router, Server Actions) needs testing

## Deployed Resources (dev stage)

| Resource | Name | Region |
|----------|------|--------|
| DynamoDB | anchor-deploy-dev-ProjectsTable-cwdhxuwt | ap-southeast-1 |
| DynamoDB | anchor-deploy-dev-DeploymentsTable-sdhkosws | ap-southeast-1 |
| DynamoDB | anchor-deploy-dev-DomainsTable-* | ap-southeast-1 |
| S3 | anchor-deploy-dev-artifactsbucket-vowmncbh | ap-southeast-1 |
| S3 | anchor-deploy-dev-logsbucket-wacxnrhx | ap-southeast-1 |
| API Gateway | WebhookApi | https://ksha1s4pnc.execute-api.ap-southeast-1.amazonaws.com |
| Lambda | WebhookHandler | anchor-deploy-dev-WebhookHandlerFunction-svfhrrck |
| Lambda | DeploymentsHandler | anchor-deploy-dev-DeploymentsHandlerFunction-mdatkxca |
| Lambda | BuildOrchestrator | anchor-deploy-dev-BuildOrchestratorFunction-bdwwezte |
| Lambda | EnvVarsHandler | anchor-deploy-dev-EnvVarsHandlerFunction-* |
| Lambda | LogsHandler | anchor-deploy-dev-LogsHandlerFunction-* |
| Lambda | RollbackHandler | anchor-deploy-dev-RollbackHandlerFunction-* |
| Lambda | DomainsHandler | anchor-deploy-dev-DomainsHandlerFunction-* |
| Lambda | ServerFunction (SSR) | anchor-deploy-dev-ServerFunctionFunction-bcdnwtma |
| Lambda | ImageFunction (optimization) | anchor-deploy-dev-ImageFunctionFunction-ewvzazcs |
| Lambda | DeployHandler | anchor-deploy-dev-DeployHandlerFunction-* |
| Lambda Alias | ServerFunction:live | Points to $LATEST (updated by deploy-handler) |
| Lambda Alias | ImageFunction:live | Points to $LATEST (updated by deploy-handler) |
| S3 | staticAssetsBucket | anchor-deploy-dev-staticassetsbucket-* |
| SQS | BuildQueue | anchor-deploy-dev-BuildQueueQueue-wwzrzbfu |
| SQS | BuildQueueDLQ | anchor-deploy-dev-BuildQueueDLQQueue-twxkcxct |
| CodeBuild | NextjsBuild | anchor-deploy-nextjs-build |
| CloudFront | Distribution | E22NAK3VFROWZ9 (d3361tfgki4fpn.cloudfront.net) |
| Secret | WEBHOOK_SECRET | SST managed |

## API Endpoints

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| POST | /webhook/{projectId} | WebhookHandler | GitHub push webhook receiver |
| GET | /projects/{projectId}/deployments | DeploymentsHandler | List deployment history |
| GET | /projects/{projectId}/env | EnvVarsHandler | Get project env vars |
| PUT | /projects/{projectId}/env | EnvVarsHandler | Update project env vars |
| GET | /deployments/{deploymentId}/logs | LogsHandler | Get build logs from CloudWatch |
| POST | /projects/{projectId}/rollback | RollbackHandler | Instant rollback to previous deployment |
| GET | /projects/{projectId}/domains | DomainsHandler | List custom domains for project |
| POST | /projects/{projectId}/domains | DomainsHandler | Add custom domain with ACM certificate |
| GET | /projects/{projectId}/domains/{domainId} | DomainsHandler | Get domain status + trigger CloudFront update |
| DELETE | /projects/{projectId}/domains/{domainId} | DomainsHandler | Remove custom domain |

## Session Continuity

Last session: 2026-02-01 14:40 UTC
Stopped at: Completed Phase 2 Plan 03 (02-03-PLAN.md - Rollback & Custom Domains)
Resume file: None

## Phase 2 Plan 03 Complete - Summary

Rollback and custom domain management complete:
- Rollback API enables instant (<1s) reversion using Lambda alias switching
- Custom domain API provisions ACM certificates in us-east-1
- DNS validation instructions returned to users
- CloudFront distribution automatically updated when certificates validate
- Domain status tracking with separate certificate and CloudFront states
- Zero-downtime rollback without code re-upload
- Full domain flow: Add domain → DNS validation → ACM cert issued → CloudFront updated → active

Ready for: Phase 3 dashboard with rollback UI and domain management interface
