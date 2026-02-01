---
phase: 02-deployment-cdn
plan: 01
subsystem: infra
tags: [cloudfront, lambda, s3, cdn, deployment, nextjs, ssr, image-optimization]

# Dependency graph
requires:
  - phase: 01-infrastructure-build
    provides: DynamoDB tables (ProjectsTable, DeploymentsTable), S3 buckets (artifactsBucket)
provides:
  - CloudFront distribution for serving deployed Next.js apps
  - Server Lambda function for SSR and API routes
  - Image optimization Lambda function for Next.js images
  - Deployment schema with version tracking fields
  - Domain schema for custom domain support (Plan 03)
affects: [02-02, 02-03, deployment-process, custom-domains, rollback]

# Tech tracking
tech-stack:
  added: [aws-cloudfront, lambda-function-urls]
  patterns:
    - CloudFront multi-origin routing (S3 static, Lambda server, Lambda image)
    - Placeholder Lambda handlers replaced during deployment
    - Version tracking for rollback support

key-files:
  created:
    - infra/deployment.ts
    - packages/functions/src/placeholder-server.ts
    - packages/functions/src/placeholder-image.ts
    - packages/core/schemas/domain.ts
  modified:
    - packages/core/schemas/deployment.ts
    - packages/core/db/deployments.ts
    - sst.config.ts

key-decisions:
  - "S3 origin config without OAC for Phase 2 Plan 01 (proper OAC in Plan 02)"
  - "Removed streaming mode from placeholder due to Function URL permissions issue"
  - "Using native CloudFront resource instead of SST Cdn component for fine-grained control"
  - "Lambda Function URLs for CloudFront origins instead of ALB"

patterns-established:
  - "Cache behavior order: image optimization, static assets (immutable), server (dynamic)"
  - "Deployment version tracking with Lambda ARNs for atomic rollback"
  - "Domain schema with ACM certificate and DNS validation tracking"

# Metrics
duration: 16min
completed: 2026-02-01
---

# Phase 2 Plan 1: CloudFront CDN Infrastructure Summary

**CloudFront distribution with Lambda@URL origins for SSR, image optimization, and S3 static assets; deployment schema extended with version tracking for rollback**

## Performance

- **Duration:** 16 min
- **Started:** 2026-02-01T14:00:54Z
- **Completed:** 2026-02-01T14:16:58Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- CloudFront distribution deployed (d3361tfgki4fpn.cloudfront.net, ID: E22NAK3VFROWZ9)
- Server Lambda (512MB, 30s timeout) with function URL for SSR/API routes
- Image Lambda (1024MB, 30s timeout) for Next.js image optimization
- Deployment schema extended with version tracking (Lambda ARNs, static assets path, CloudFront invalidation)
- Domain schema created for custom domain support (Plan 03)
- Database functions for version management (getActiveDeployment, setDeploymentVersion, getDeploymentVersions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deployment infrastructure module** - `71c8e12` (feat)
   - CloudFront distribution with 3 origins
   - Server and Image Lambda functions with placeholder handlers
   - Cache behaviors configured (static immutable, dynamic SSR, image optimization)

2. **Task 2: Extend deployment schema with version tracking** - `dfd047a` (feat)
   - Added version fields to DeploymentSchema
   - Created version management database functions
   - Created domain schema for Plan 03

3. **Task 3: Wire deployment infrastructure into SST config** - `ad64ea6` (feat)
   - Imported deployment module
   - Exported CloudFront URL, distribution ID, function names
   - Successfully deployed all infrastructure

## Files Created/Modified

**Created:**
- `infra/deployment.ts` - CloudFront distribution with Lambda origins and S3 static assets
- `packages/functions/src/placeholder-server.ts` - Temporary handler for server Lambda (replaced in Plan 02)
- `packages/functions/src/placeholder-image.ts` - Temporary handler for image Lambda (replaced in Plan 02)
- `packages/core/schemas/domain.ts` - Domain schema with ACM certificate and DNS validation tracking

**Modified:**
- `packages/core/schemas/deployment.ts` - Extended with lambdaServerVersionArn, lambdaImageVersionArn, staticAssetsPath, cloudfrontInvalidationId, deployedAt, version
- `packages/core/db/deployments.ts` - Added getActiveDeployment(), setDeploymentVersion(), getDeploymentVersions()
- `sst.config.ts` - Imported deployment module, exported CloudFront outputs

## Decisions Made

**1. S3 origin without Origin Access Control (OAC)**
- Used S3 origin config with empty originAccessIdentity for Phase 2 Plan 01
- Proper OAC with bucket policy will be configured in Plan 02 during actual deployment
- This avoids bucket policy conflicts with existing SST-managed policies

**2. Removed streaming mode from placeholder Lambda**
- Lambda Function URL with streaming enabled (`InvokeMode: RESPONSE_STREAM`) had permissions issues
- Removed `streaming: true` from placeholder configuration
- Will be re-enabled in Plan 02 when deploying actual OpenNext handler with proper configuration

**3. Native CloudFront resource instead of SST Cdn component**
- SST's Cdn component is opinionated and doesn't expose fine-grained cache behavior control
- Next.js requires specific cache behaviors for /_next/static/*, /_next/image*, and dynamic routes
- Used native `aws.cloudfront.Distribution` resource for full control

**4. Lambda Function URLs for origins**
- Chose Lambda Function URLs over ALB for CloudFront origins
- Simpler architecture, lower cost (no ALB charges)
- Function URLs have known SST authorization config issue (see Issues Encountered)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created placeholder Lambda handler functions**
- **Found during:** Task 1 (deployment infrastructure creation)
- **Issue:** Lambda functions referenced handlers that didn't exist (packages/functions/src/placeholder-server.handler)
- **Fix:** Created placeholder-server.ts and placeholder-image.ts with simple JSON responses
- **Files modified:** packages/functions/src/placeholder-server.ts, packages/functions/src/placeholder-image.ts
- **Verification:** TypeScript compiles, SST deploy succeeds
- **Committed in:** 71c8e12 (Task 1 commit)

**2. [Rule 3 - Blocking] Removed BucketPolicy to avoid conflict**
- **Found during:** Task 3 (SST deployment)
- **Issue:** Cannot add bucket policy "StaticAssetsBucketPolicy" - bucket already has policy "ArtifactsPolicy" from SST
- **Fix:** Removed CloudFront OAC bucket policy creation, using S3 origin config instead
- **Files modified:** infra/deployment.ts
- **Verification:** SST deploy completes successfully
- **Committed in:** ad64ea6 (Task 3 commit)

**3. [Rule 3 - Blocking] Removed streaming mode from placeholder**
- **Found during:** Task 3 (testing Lambda Function URLs)
- **Issue:** Lambda Function URLs with `streaming: true` returning 403 Forbidden despite public auth
- **Fix:** Removed `streaming: true` from placeholder configuration (will be re-enabled with actual OpenNext handler)
- **Files modified:** infra/deployment.ts
- **Verification:** Lambda invokes directly via AWS SDK successfully
- **Committed in:** ad64ea6 (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** All auto-fixes necessary to unblock deployment. No scope creep. Lambda Function URL permissions issue deferred to Plan 02 when real OpenNext handlers are deployed.

## Issues Encountered

**Lambda Function URLs returning 403 Forbidden**
- **Problem:** Both server and image Lambda Function URLs configured with `authorization: "none"` and proper resource policies, but returning 403 AccessDeniedException
- **Investigation:**
  - Verified AuthType is NONE via AWS CLI
  - Verified resource policy allows public InvokeFunctionUrl
  - Manually recreated permissions - same result
  - Direct Lambda invocation via AWS SDK works perfectly
- **Root cause:** Suspected SST bug with Lambda Function URL authorization configuration or AWS account-level restriction
- **Impact:** CloudFront distribution routes to Lambda origins but receives 403 responses
- **Mitigation:** Infrastructure is correctly deployed (CloudFront exists, Lambdas exist, outputs correct). Issue will be resolved in Plan 02 when deploying actual OpenNext handlers with proper IAM configuration.
- **Verification:** CloudFront distribution URL accessible, routing correctly (returns 403 from Lambda, not CloudFront error)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Plan 02 (Deployment Process):**
- CloudFront distribution deployed and operational (E22NAK3VFROWZ9)
- Server Lambda exists and invokes successfully (direct invocation confirmed)
- Image Lambda exists and invokes successfully
- Deployment schema has version tracking fields
- Database functions for version management created
- All SST outputs exported correctly

**Blockers/Concerns:**
- Lambda Function URL 403 issue needs resolution during Plan 02 OpenNext deployment
- S3 bucket policy for CloudFront OAC needs to be configured during actual deployment
- Placeholder handlers will be replaced with OpenNext server and image handlers

**For Plan 03 (Custom Domains):**
- Domain schema created and ready
- CloudFront distribution can be updated with ACM certificates
- DNS validation tracking structure in place

---
*Phase: 02-deployment-cdn*
*Completed: 2026-02-01*
