# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-01)

**Core value:** When a developer pushes to main, the Next.js site is automatically built and deployed to production with zero manual intervention.

**Current focus:** Phase 1 - Infrastructure & Build

## Current Position

Phase: 1 of 3 (Infrastructure & Build)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-01 - Completed 01-03-PLAN.md (Build Pipeline)

Progress: [███░░░░░░░] 30%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: 9 min
- Total execution time: 0.45 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-infrastructure-build | 3/4 | 27 min | 9 min |

**Recent Trend:**
- Last 5 plans: 01-01 (8 min), 01-02 (6 min), 01-03 (13 min)
- Trend: Stable (01-03 larger scope with CodeBuild)

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

### Pending Todos

None.

### Blockers/Concerns

**Phase 1 - Architecture Decisions Required:**
- ~~Multi-tenant data isolation model~~ RESOLVED: Row-level security with userId GSI
- ~~Lambda packaging strategy~~ RESOLVED: OpenNext packaging to Lambda zip uploaded to S3
- ~~Database connection pooling strategy~~ NOT NEEDED: Using DynamoDB, no connection pooling required

**Phase 2 - Research Needed:**
- ISR cache storage strategy (S3 vs ElastiCache vs DynamoDB) for cost/latency tradeoffs
- Certificate quota management strategy for scaling to 50+ custom domains

**Phase 3 - Validation Needed:**
- OpenNext v3 compatibility with Next.js 15 features (App Router, Server Actions) needs testing

## Deployed Resources (dev stage)

| Resource | Name | Region |
|----------|------|--------|
| DynamoDB | anchor-deploy-dev-ProjectsTable-cwdhxuwt | ap-southeast-1 |
| DynamoDB | anchor-deploy-dev-DeploymentsTable-sdhkosws | ap-southeast-1 |
| S3 | anchor-deploy-dev-artifactsbucket-vowmncbh | ap-southeast-1 |
| S3 | anchor-deploy-dev-logsbucket-wacxnrhx | ap-southeast-1 |
| API Gateway | WebhookApi | https://ksha1s4pnc.execute-api.ap-southeast-1.amazonaws.com |
| Lambda | WebhookHandler | anchor-deploy-dev-WebhookHandlerFunction-svfhrrck |
| Lambda | DeploymentsHandler | anchor-deploy-dev-DeploymentsHandlerFunction-mdatkxca |
| Lambda | BuildOrchestrator | anchor-deploy-dev-BuildOrchestratorFunction-bdwwezte |
| SQS | BuildQueue | anchor-deploy-dev-BuildQueueQueue-wwzrzbfu |
| SQS | BuildQueueDLQ | anchor-deploy-dev-BuildQueueDLQQueue-twxkcxct |
| CodeBuild | NextjsBuild | anchor-deploy-nextjs-build |
| Secret | WEBHOOK_SECRET | SST managed |

## Session Continuity

Last session: 2026-02-01 05:26 UTC
Stopped at: Completed 01-03-PLAN.md, ready for 01-04 (Log Streaming)
Resume file: None
