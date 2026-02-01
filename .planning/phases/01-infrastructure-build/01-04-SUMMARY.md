---
phase: 01-infrastructure-build
plan: 04
subsystem: api
tags: [env-vars, cloudwatch, dynamodb, lambda, api-gateway]

# Dependency graph
requires:
  - phase: 01-03
    provides: CodeBuild project, build orchestrator Lambda, SQS queue
provides:
  - Project environment variables storage and API
  - Environment variables injection into CodeBuild builds
  - Build logs retrieval from CloudWatch via API
  - NODE_ENV=production in all builds
affects: [02-domain-serving, 03-dashboard]

# Tech tracking
tech-stack:
  added: ["@aws-sdk/client-cloudwatch-logs"]
  patterns:
    - "Structured env vars with isSecret flag for Secrets Manager migration"
    - "CloudWatch Logs integration for build log streaming"
    - "x-user-id header for Phase 1 auth (proper auth in Phase 3)"

key-files:
  created:
    - packages/functions/env-vars-handler/index.ts
    - packages/functions/logs-handler/index.ts
    - test-env-vars.sh
  modified:
    - packages/core/schemas/project.ts
    - packages/core/db/projects.ts
    - packages/functions/build-orchestrator/index.ts
    - infra/webhooks.ts
    - infra/build-pipeline.ts
    - package.json

key-decisions:
  - "Structured EnvVar schema with isSecret flag for future Secrets Manager migration"
  - "x-user-id header for Phase 1 auth (placeholder until dashboard in Phase 3)"
  - "Log stream name extraction from CodeBuild buildId (format: project:uuid)"
  - "Polling-based logs (Phase 3 adds WebSocket/SSE for real-time)"

patterns-established:
  - "EnvVar schema: {key, value, isSecret} for all environment variables"
  - "Build orchestrator fetches project config before triggering CodeBuild"
  - "CloudWatch Logs integration pattern for Lambda-to-CodeBuild log access"

# Metrics
duration: 8min
completed: 2026-02-01
---

# Phase 1 Plan 4: Environment Variables & Log Streaming Summary

**Project env vars stored in DynamoDB, injected into CodeBuild via environmentVariablesOverride, build logs streamed from CloudWatch via REST API**

## Performance

- **Duration:** 8 min
- **Started:** 2026-02-01T05:29:39Z
- **Completed:** 2026-02-01T05:37:12Z
- **Tasks:** 5
- **Files modified:** 9

## Accomplishments

- Users can set/get project environment variables via REST API (GET/PUT /projects/{id}/env)
- Environment variables stored in DynamoDB Projects table with structured schema
- Build orchestrator injects all project env vars into CodeBuild via environmentVariablesOverride
- NODE_ENV=production automatically set in all builds (critical for Next.js)
- Build logs accessible via GET /deployments/{id}/logs from CloudWatch Logs
- Access control verified (wrong user gets "access denied")

## Task Commits

Each task was committed atomically:

1. **Task 1: Add environment variables storage to Projects table** - `b27b282` (feat)
2. **Task 2: Update build orchestrator to inject environment variables** - `174c7e8` (feat)
3. **Task 3: Create API endpoints for environment variables management** - `cd9fe7c` (feat)
4. **Task 4: Create build logs API endpoint with CloudWatch integration** - `efefe11` (feat)
5. **Task 5: Test environment variables and logs end-to-end** - `f16194f` (test)

## Files Created/Modified

- `packages/core/schemas/project.ts` - Added EnvVarSchema, UpdateEnvVarsSchema with isSecret flag
- `packages/core/db/projects.ts` - Added getProjectEnvVars, setProjectEnvVars functions
- `packages/functions/build-orchestrator/index.ts` - Fetches project env vars, injects into CodeBuild
- `packages/functions/env-vars-handler/index.ts` - Handles GET/PUT for env vars API
- `packages/functions/logs-handler/index.ts` - Fetches build logs from CloudWatch
- `infra/webhooks.ts` - Added env vars and logs API routes with IAM policy
- `infra/build-pipeline.ts` - Added PROJECTS_TABLE link to build orchestrator
- `package.json` - Added @aws-sdk/client-cloudwatch-logs dependency
- `test-env-vars.sh` - End-to-end test script

## Decisions Made

1. **Structured EnvVar schema with isSecret flag** - Prepares for Phase 2 Secrets Manager migration. Non-secret vars stored in DynamoDB (fast, cheap), secrets marked for later migration.

2. **x-user-id header for auth** - Placeholder for Phase 1. Proper authentication via dashboard in Phase 3.

3. **Log stream name extraction** - CodeBuild buildId format is `project:uuid`. We extract the uuid part for CloudWatch log stream name.

4. **Polling for logs** - Phase 1 uses REST polling. Phase 3 dashboard will add WebSocket/SSE for real-time streaming.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues.

## User Setup Required

None - no external service configuration required. All infrastructure deployed via SST.

## Next Phase Readiness

**Phase 1 Complete!** All infrastructure requirements satisfied:
- Projects and Deployments tables with userId isolation
- S3 buckets for artifacts and logs
- GitHub webhook processing with HMAC validation
- SQS-based async build queue
- CodeBuild with OpenNext packaging
- Environment variables injection
- Build log streaming

**Ready for Phase 2: Domain & Serving**
- CloudFront distribution for static assets
- Lambda@Edge for SSR
- Custom domain support with ACM certificates
- ISR cache invalidation

---
*Phase: 01-infrastructure-build*
*Completed: 2026-02-01*
