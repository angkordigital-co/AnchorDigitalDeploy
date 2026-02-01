---
phase: 01-infrastructure-build
plan: 02
subsystem: api
tags: [webhook, github, hmac, lambda, api-gateway, dynamodb]

# Dependency graph
requires:
  - phase: 01-infrastructure-build/01
    provides: DynamoDB tables (Projects, Deployments), data access layer
provides:
  - POST /webhook/{projectId} endpoint for GitHub push events
  - GET /projects/{projectId}/deployments endpoint for deployment history (GIT-04)
  - HMAC-SHA256 signature validation with timing-safe comparison
  - Deployment record creation with status "queued"
affects:
  - 01-03 (Build Pipeline needs to process queued deployments)
  - 02-* (Dashboard needs deployment history API)

# Tech tracking
tech-stack:
  added:
    - crypto.timingSafeEqual (Node.js built-in for secure comparison)
    - SST Secret (WEBHOOK_SECRET for HMAC validation)
  patterns:
    - Webhook signature validation with HMAC-SHA256
    - Async 202 response pattern (return immediately, process later)
    - Row-level security verification before data access

key-files:
  created:
    - infra/webhooks.ts
    - packages/functions/webhook-handler/index.ts
    - packages/functions/deployments-handler/index.ts
    - packages/core/schemas/webhook.ts
    - test-webhook.sh
  modified:
    - sst.config.ts

key-decisions:
  - "Return 202 immediately for async build processing (avoid API Gateway 29s timeout)"
  - "Use crypto.timingSafeEqual for signature validation (prevent timing attacks)"
  - "Temporary x-user-id header for auth (full auth in Phase 2)"
  - "Branch filter: only process refs/heads/main"

patterns-established:
  - "Webhook handlers: validate signature before processing payload"
  - "API handlers: return 404 for both not-found and access-denied (prevent info leakage)"
  - "Deployment creation: inherit userId from project for tenant isolation"

# Metrics
duration: 6min
completed: 2026-02-01
---

# Phase 01 Plan 02: Webhook Handler Summary

**GitHub webhook integration with HMAC signature validation, 202 async response pattern, and deployment history API**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-01T05:04:35Z
- **Completed:** 2026-02-01T05:10:10Z
- **Tasks:** 5
- **Files modified:** 6

## Accomplishments
- POST /webhook/{projectId} endpoint deployed and accepting GitHub push events
- HMAC-SHA256 signature validation using timing-safe comparison (security)
- 202 Accepted response in < 1 second (measured 0.152s)
- Invalid/missing signatures rejected with 401 Unauthorized
- GET /projects/{projectId}/deployments returns deployment history with commit SHA and message (GIT-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create webhook API Gateway infrastructure** - `a608a55` (feat)
2. **Task 2: Create GitHub webhook payload validation schema** - `93a85f2` (feat)
3. **Task 3: Implement webhook handler with signature validation** - `a819f02` (feat)
4. **Task 4: Create deployment history API endpoint (GIT-04)** - `7d957c0` (feat)
5. **Task 5: Wire webhook infrastructure and test** - `013c88e` (feat)

## Files Created/Modified
- `infra/webhooks.ts` - API Gateway with webhook and deployments routes
- `packages/core/schemas/webhook.ts` - Zod schema for GitHub push payload validation
- `packages/functions/webhook-handler/index.ts` - Webhook handler with HMAC validation
- `packages/functions/deployments-handler/index.ts` - Deployment history API handler
- `sst.config.ts` - Updated to deploy webhook infrastructure
- `test-webhook.sh` - Integration test script for signature validation

## Deployed Resources

| Resource | Name | Endpoint |
|----------|------|----------|
| API Gateway | WebhookApi | https://ksha1s4pnc.execute-api.ap-southeast-1.amazonaws.com |
| Lambda | WebhookHandler | anchor-deploy-dev-WebhookHandlerFunction-svfhrrck |
| Lambda | DeploymentsHandler | anchor-deploy-dev-DeploymentsHandlerFunction-mdatkxca |
| Secret | WEBHOOK_SECRET | SST managed secret |

## Decisions Made
- Used crypto.timingSafeEqual instead of === for signature comparison (prevents timing attacks)
- Handler returns 202 immediately; build processing deferred to SQS queue (Plan 03)
- Branch filtering: only process refs/heads/main, return 200 for other branches
- Temporary auth via x-user-id header until full auth in Phase 2

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Test script bash syntax issue with `head -n-1` on macOS (fixed with `sed '$d'`)
- Secret value not persisted in bash variable between commands (re-retrieved from SST)

## User Setup Required

None - WEBHOOK_SECRET is managed by SST secrets. When connecting GitHub, user will need to configure webhook in GitHub repository settings with the secret value.

## Next Phase Readiness
- Webhook endpoint ready to receive GitHub push events
- Deployment records created with status "queued"
- Plan 03 (Build Pipeline) can now consume queued deployments from DynamoDB
- Deployment history API ready for dashboard integration

---
*Phase: 01-infrastructure-build*
*Completed: 2026-02-01*
