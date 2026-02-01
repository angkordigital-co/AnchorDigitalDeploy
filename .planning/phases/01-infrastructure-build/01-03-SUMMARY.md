---
phase: 01-infrastructure-build
plan: 03
subsystem: build-pipeline
tags: [sqs, codebuild, opennext, lambda, async]

dependency_graph:
  requires: [01-01, 01-02]
  provides:
    - SQS build queue for async job processing
    - CodeBuild project for Next.js builds
    - Build orchestrator Lambda for triggering builds
    - OpenNext packaging integration
  affects: [01-04, 02-01]

tech_stack:
  added:
    - "@aws-sdk/client-codebuild": "^3.x"
    - "@aws-sdk/client-sqs": "^3.x"
  patterns:
    - Async job processing with SQS
    - Fire-and-forget build triggering
    - CodeBuild with embedded buildspec

key_files:
  created:
    - infra/build-pipeline.ts
    - packages/functions/build-orchestrator/index.ts
    - buildspecs/nextjs-build.yml
  modified:
    - packages/functions/webhook-handler/index.ts
    - infra/webhooks.ts
    - sst.config.ts

decisions:
  - id: "sqs-visibility-timeout"
    choice: "1800 seconds (30 minutes)"
    reason: "Matches CodeBuild timeout to prevent duplicate builds"
  - id: "codebuild-compute"
    choice: "BUILD_GENERAL1_SMALL (3GB RAM, 2 vCPU)"
    reason: "Nano (1.5GB) causes OOM on Next.js builds"
  - id: "embedded-buildspec"
    choice: "Inline buildspec in CodeBuild project"
    reason: "Atomic deployment with project, no separate file sync needed"
  - id: "dlq-retry-count"
    choice: "3 retries before DLQ"
    reason: "Balance between recovery and fail-fast for investigation"

metrics:
  duration: "13 min"
  completed: "2026-02-01"
---

# Phase 01 Plan 03: Build Pipeline Summary

**One-liner:** Async build pipeline with SQS queue, CodeBuild orchestrator, and OpenNext packaging for Lambda-compatible Next.js artifacts.

## What Was Built

### 1. SQS Build Queue
- Queue URL: `https://sqs.ap-southeast-1.amazonaws.com/775039091390/anchor-deploy-dev-BuildQueueQueue-wwzrzbfu`
- Visibility timeout: 1800 seconds (30 minutes)
- Dead letter queue after 3 failed attempts
- Message format: `{deploymentId, projectId, commitSha, repoUrl, branch}`

### 2. CodeBuild Project
- Name: `anchor-deploy-nextjs-build`
- Image: `aws/codebuild/standard:7.0` (Node.js 22)
- Compute: `BUILD_GENERAL1_SMALL` (3GB RAM, 2 vCPU)
- Timeout: 30 minutes
- Cache: S3-based for node_modules and .next/cache

### 3. Build Orchestrator Lambda
- Name: `anchor-deploy-dev-BuildOrchestratorFunction-bdwwezte`
- Triggered by SQS event source mapping
- Updates deployment status: queued -> building
- Triggers CodeBuild with environment variables

### 4. Buildspec Implementation
Embedded buildspec with phases:
1. **install:** Node.js 22, pnpm
2. **pre_build:** Clone repo, checkout commit, install deps
3. **build:** Next.js build, OpenNext packaging
4. **post_build:** Package Lambda, upload to S3, update DynamoDB status

## Build Flow

```
GitHub Push
    |
    v
Webhook Handler (validates, creates deployment record)
    |
    v
SQS Queue (build job message)
    |
    v
Build Orchestrator Lambda (updates status to "building")
    |
    v
CodeBuild (clone, build, package with OpenNext)
    |
    v
S3 (artifacts/projectId/commitSha/lambda.zip)
    |
    v
DynamoDB (status = "success", artifactPath set)
```

## Deployed Resources

| Resource | Name | Configuration |
|----------|------|---------------|
| SQS Queue | anchor-deploy-dev-BuildQueueQueue-wwzrzbfu | 30 min visibility |
| SQS DLQ | anchor-deploy-dev-BuildQueueDLQQueue-twxkcxct | 3 retry limit |
| CodeBuild | anchor-deploy-nextjs-build | 30 min timeout, 3GB RAM |
| Lambda | anchor-deploy-dev-BuildOrchestratorFunction-bdwwezte | 60 sec timeout |
| IAM Role | CodeBuildRole | S3, DynamoDB, CloudWatch |

## Files Changed

### Created
- `infra/build-pipeline.ts` - SQS, CodeBuild, orchestrator definitions
- `packages/functions/build-orchestrator/index.ts` - SQS handler
- `buildspecs/nextjs-build.yml` - Reference buildspec documentation

### Modified
- `packages/functions/webhook-handler/index.ts` - Added SQS enqueue
- `infra/webhooks.ts` - Linked buildQueue to webhook handler
- `sst.config.ts` - Import build-pipeline module

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| SQS visibility timeout | 1800s | Must match CodeBuild timeout to prevent duplicate builds |
| CodeBuild compute | BUILD_GENERAL1_SMALL | 3GB RAM needed; nano causes OOM |
| Buildspec location | Embedded in project | Atomic deployment, no file sync issues |
| DLQ retry count | 3 | Balance recovery attempts vs investigation delay |
| Enqueue after deployment | Yes | Deployment record exists even if SQS fails |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] IAM role policy name vs ARN**
- **Found during:** Task 5 deployment
- **Issue:** `aws.iam.RolePolicy` requires role name, not ARN
- **Fix:** Changed from `buildOrchestrator.nodes.function.role` to `buildOrchestrator.nodes.role.name`
- **Commit:** 888dc85

**2. [Rule 3 - Blocking] SQS permissions for Lambda**
- **Found during:** Task 5 deployment
- **Issue:** EventSourceMapping failed without ReceiveMessage permission
- **Fix:** Added `buildQueue` to orchestrator's `link` array
- **Commit:** 888dc85

**3. [Rule 3 - Blocking] Queue subscription approach**
- **Found during:** Task 5 deployment
- **Issue:** `buildQueue.subscribe()` with handler ARN caused "Handler not found" error
- **Fix:** Used `aws.lambda.EventSourceMapping` directly instead
- **Commit:** 888dc85

## Testing Notes

**Manual Test Commands:**

```bash
# Send test message to SQS
aws sqs send-message \
  --queue-url "https://sqs.ap-southeast-1.amazonaws.com/775039091390/anchor-deploy-dev-BuildQueueQueue-wwzrzbfu" \
  --message-body '{"deploymentId":"test-123","projectId":"test-project","commitSha":"abc123def456","repoUrl":"https://github.com/user/repo","branch":"main"}' \
  --region ap-southeast-1

# Check CodeBuild logs
aws logs tail /aws/codebuild/anchor-deploy-nextjs-build --region ap-southeast-1

# List artifacts
aws s3 ls s3://anchor-deploy-dev-artifactsbucket-vowmncbh/artifacts/ --region ap-southeast-1
```

**Note:** Full end-to-end test requires a real GitHub repository with Next.js project and OpenNext configuration.

## Next Phase Readiness

### Ready For
- Plan 04: Log streaming and build status API
- Phase 02: Runtime deployment using Lambda artifacts

### Prerequisites for Plan 04
- CloudWatch log group: `/aws/codebuild/anchor-deploy-nextjs-build`
- Deployment record has `buildId` field for log retrieval

### Blockers
- None identified

## Verification Checklist

- [x] SQS queue exists with correct visibility timeout
- [x] CodeBuild project exists with 30-minute timeout
- [x] CodeBuild uses BUILD_GENERAL1_SMALL (3GB RAM)
- [x] Build orchestrator Lambda deployed and connected to queue
- [x] Webhook handler enqueues messages to SQS
- [x] IAM roles have correct permissions
- [ ] Full end-to-end build test (requires real repo)
