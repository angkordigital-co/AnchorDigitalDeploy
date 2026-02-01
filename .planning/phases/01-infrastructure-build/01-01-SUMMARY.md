---
phase: 01-infrastructure-build
plan: 01
subsystem: infrastructure
tags: [sst, dynamodb, s3, typescript, aws]
dependency-graph:
  requires: []
  provides: [dynamodb-tables, s3-buckets, data-access-layer]
  affects: [01-02, 01-03, 01-04, 02-01, 02-02]
tech-stack:
  added:
    - sst@3.17.38
    - "@aws-sdk/client-dynamodb"
    - "@aws-sdk/lib-dynamodb"
    - "@aws-sdk/client-s3"
    - zod
    - nanoid
  patterns:
    - Row-level security with userId GSI
    - S3 lifecycle policies for cost management
    - DynamoDB single-table design principles
key-files:
  created:
    - sst.config.ts
    - infra/database.ts
    - infra/storage.ts
    - packages/core/schemas/project.ts
    - packages/core/schemas/deployment.ts
    - packages/core/db/index.ts
    - packages/core/db/client.ts
    - packages/core/db/projects.ts
    - packages/core/db/deployments.ts
  modified: []
decisions:
  - id: tenant-isolation
    choice: Row-level security with userId GSI
    reason: Simpler than schema-per-tenant, sufficient for 50 internal sites
  - id: dynamodb-billing
    choice: ON_DEMAND billing mode
    reason: Low traffic, no benefit from provisioned capacity
  - id: artifact-retention
    choice: 90-day expiration
    reason: Sufficient for rollback, prevents cost balloon
metrics:
  duration: 8min
  completed: 2026-02-01
---

# Phase 01 Plan 01: Infrastructure Foundation Summary

**One-liner:** SST Ion v3 project with multi-tenant DynamoDB tables (userId GSI), S3 buckets with lifecycle policies, and typed data access layer - deployed to AWS Singapore.

## What Was Built

### Infrastructure Components

1. **SST Ion v3 Project**
   - App name: anchor-deploy
   - Region: ap-southeast-1 (Singapore)
   - Removal policy: retain for production, remove for non-prod

2. **DynamoDB Tables**
   - Projects table with UserIdIndex GSI for tenant isolation
   - Deployments table with composite key (projectId + deploymentId)
   - DeploymentIdIndex GSI for deployment lookups
   - UserIdIndex GSI on both tables for user-scoped queries
   - ON_DEMAND billing mode

3. **S3 Buckets**
   - Artifacts bucket with 90-day expiration policy
   - Logs bucket with Glacier transition (30 days) and Deep Archive (365 days)
   - Multipart upload cleanup (7 days)

4. **Data Access Layer**
   - Typed TypeScript functions with Zod validation
   - Row-level security via userId filtering on all queries
   - Project operations: getProject, listUserProjects, createProject, updateProject
   - Deployment operations: createDeployment, getDeployment, listProjectDeployments, updateDeployment

### Deployed Resources

| Resource | Name | Region |
|----------|------|--------|
| DynamoDB | anchor-deploy-dev-ProjectsTable-cwdhxuwt | ap-southeast-1 |
| DynamoDB | anchor-deploy-dev-DeploymentsTable-sdhkosws | ap-southeast-1 |
| S3 | anchor-deploy-dev-artifactsbucket-vowmncbh | ap-southeast-1 |
| S3 | anchor-deploy-dev-logsbucket-wacxnrhx | ap-southeast-1 |

## Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Initialize SST Ion v3 project with TypeScript | 7f7b2f4 |
| 2 | Create DynamoDB tables with multi-tenant isolation | 2d4dd78 |
| 3 | Create S3 buckets with lifecycle policies | 2baa017 |
| 4 | Create TypeScript data access layer with tenant isolation | 9eadc98 |
| 5 | Wire infrastructure and verify deployment | 73e2944 |

## Verification Results

| Check | Result |
|-------|--------|
| SST deployment succeeds | PASS |
| DynamoDB tables exist | PASS |
| Tables have userId GSI | PASS |
| S3 buckets exist | PASS |
| Lifecycle policies configured | PASS |
| TypeScript compiles | PASS |

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

### 1. Row-Level Security for Tenant Isolation

**Decision:** Use shared DynamoDB tables with userId GSI filtering instead of schema-per-tenant.

**Rationale:**
- Simpler: 2 shared tables vs 100+ tables (50 projects x 2 tables)
- Sufficient isolation for internal use (not SaaS product)
- Standard pattern used by Vercel, Netlify, Railway at this scale

**Impact:** All data access functions enforce userId filtering. GSI on userId enables efficient "list all projects for user" queries.

### 2. ON_DEMAND DynamoDB Billing

**Decision:** Use ON_DEMAND billing mode for both tables.

**Rationale:**
- Expected usage: ~15K writes/month, ~500 reads/day
- Break-even for provisioned: ~2M writes/month
- ON_DEMAND cost: ~$0.10/month at expected scale

### 3. 90-Day Artifact Retention

**Decision:** Delete build artifacts after 90 days.

**Rationale:**
- Sufficient for rollback needs (rarely need builds older than 90 days)
- Prevents cost balloon: 50 sites x 10 deploys/day = 100GB/day without cleanup
- Estimated savings: ~$600/year

## Technical Notes

### Schema Design

**Projects Table:**
```
PK: projectId
GSI: UserIdIndex (hashKey: userId)
```

**Deployments Table:**
```
PK: projectId
SK: deploymentId
GSI: DeploymentIdIndex (hashKey: deploymentId)
GSI: UserIdIndex (hashKey: userId)
```

### Security Pattern

All data access functions enforce userId verification:
```typescript
// ALWAYS filter by userId
KeyConditionExpression: "userId = :userId"
// or
ConditionExpression: "userId = :userId"
```

## Next Phase Readiness

**Ready for Phase 1 Plan 2 (Webhook Handler):**
- DynamoDB tables deployed and accessible
- Data access layer ready for Lambda functions
- S3 buckets ready for artifact storage

**Dependencies satisfied:**
- createDeployment() ready for webhook handler
- updateDeploymentStatus() ready for build orchestrator
- PROJECTS_TABLE and DEPLOYMENTS_TABLE environment variables defined

**Blockers:** None
