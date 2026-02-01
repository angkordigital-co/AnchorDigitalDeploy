---
phase: 03-dashboard-observability
plan: 01
subsystem: auth
tags: [nextjs, auth.js, shadcn-ui, dynamodb, jwt, bcrypt]

# Dependency graph
requires:
  - phase: 01-infrastructure-build
    provides: DynamoDB tables pattern, SST infrastructure
provides:
  - Next.js 16 dashboard application with shadcn/ui
  - Auth.js v5 with DynamoDB credentials provider
  - UsersTable with EmailIndex GSI for login lookup
  - Login page with email/password form
  - Dashboard layout with sidebar and header
  - Route protection middleware
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: [next-auth@beta, react-hook-form, @hookform/resolvers, shadcn-ui, zod]
  patterns: [Route groups for layout separation, Suspense for useSearchParams, JWT sessions]

key-files:
  created:
    - dashboard/package.json
    - dashboard/lib/auth.ts
    - dashboard/middleware.ts
    - dashboard/app/(auth)/login/page.tsx
    - dashboard/app/(dashboard)/layout.tsx
    - dashboard/components/dashboard/sidebar.tsx
    - dashboard/components/dashboard/header.tsx
  modified:
    - infra/database.ts
    - sst.config.ts

key-decisions:
  - "Next.js 16 instead of 15: create-next-app@latest installed v16 (most recent)"
  - "JWT session strategy: Serverless-friendly, no server-side session storage needed"
  - "Route groups for layout: (auth) and (dashboard) groups separate auth and dashboard layouts"
  - "Suspense boundary for useSearchParams: Required for static page generation in Next.js 16"

patterns-established:
  - "Route groups: (auth) for login/register, (dashboard) for protected pages"
  - "Client components: Suffix with 'use client', separate from server components"
  - "Auth pattern: Server components call auth(), client components use useSession/signIn/signOut"
  - "Form pattern: react-hook-form + zod + @hookform/resolvers"

# Metrics
duration: 6min
completed: 2026-02-01
---

# Phase 03 Plan 01: Dashboard Foundation & Auth Summary

**Next.js 16 dashboard with Auth.js v5 credentials provider, DynamoDB-backed user storage, and shadcn/ui components**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-01T15:23:15Z
- **Completed:** 2026-02-01T15:29:11Z
- **Tasks:** 3
- **Files modified:** 14 files created/modified

## Accomplishments

- Created Next.js 16 dashboard application with shadcn/ui component library
- Configured Auth.js v5 with DynamoDB credentials provider querying UsersTable via EmailIndex GSI
- Implemented route protection middleware that redirects unauthenticated users to /login
- Built login page with email/password form using react-hook-form and zod validation
- Created dashboard layout with fixed sidebar navigation and header with user info/sign out
- Added UsersTable to DynamoDB infrastructure with email GSI for login lookup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Next.js 16 Dashboard with shadcn/ui** - `a6f6505` (feat)
2. **Task 2: Add UsersTable and Configure Auth.js v5** - `2c7a734` (feat)
3. **Task 3: Add Login Page and Dashboard Layout** - `a462fe5` (feat)

## Files Created/Modified

- `dashboard/package.json` - Next.js 16 with Auth.js, shadcn/ui, AWS SDK
- `dashboard/lib/auth.ts` - Auth.js v5 config with DynamoDB credentials provider
- `dashboard/lib/utils.ts` - cn() utility for className merging
- `dashboard/middleware.ts` - Route protection, redirects to /login
- `dashboard/app/(auth)/login/page.tsx` - Login page with form
- `dashboard/app/(auth)/login/login-form.tsx` - Client form component with useSearchParams
- `dashboard/app/(auth)/layout.tsx` - Centered card layout for auth pages
- `dashboard/app/(dashboard)/layout.tsx` - Dashboard layout with sidebar/header
- `dashboard/app/(dashboard)/page.tsx` - Dashboard home with welcome message
- `dashboard/app/api/auth/[...nextauth]/route.ts` - Auth.js API routes
- `dashboard/components/ui/*.tsx` - shadcn/ui components (button, input, card, form, label)
- `dashboard/components/dashboard/sidebar.tsx` - Fixed sidebar with nav links
- `dashboard/components/dashboard/header.tsx` - Header with user info and sign out
- `dashboard/types/next-auth.d.ts` - Type extensions for userId in session
- `infra/database.ts` - Added UsersTable with EmailIndex GSI
- `sst.config.ts` - Export usersTable

## Decisions Made

1. **Next.js 16 instead of 15** - create-next-app@latest installed the most recent version (16.1.6). This is compatible with the plan requirements and provides latest features.

2. **JWT session strategy** - Chose JWT over database sessions for serverless compatibility. No server-side session storage needed.

3. **Route groups for layout separation** - Used (auth) and (dashboard) route groups to have different layouts without URL path segments.

4. **Suspense boundary for useSearchParams** - Next.js 16 requires useSearchParams to be wrapped in Suspense for static generation. Separated LoginForm into client component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wrapped useSearchParams in Suspense**
- **Found during:** Task 3 (Login page)
- **Issue:** Next.js 16 build failed with "useSearchParams() should be wrapped in a suspense boundary"
- **Fix:** Extracted LoginForm into separate client component, wrapped with Suspense in page.tsx
- **Files modified:** dashboard/app/(auth)/login/page.tsx, dashboard/app/(auth)/login/login-form.tsx
- **Verification:** Build succeeds
- **Committed in:** a462fe5 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (blocking issue)
**Impact on plan:** Required change for Next.js 16 compatibility. No scope creep.

## Issues Encountered

- **create-next-app interactive prompts**: Initial attempts hung on interactive prompts. Resolved by using `--yes` flag for non-interactive execution.
- **Next.js middleware deprecation warning**: Next.js 16 shows deprecation warning for middleware in favor of "proxy". Middleware still functions correctly; can migrate to proxy pattern in future if needed.

## User Setup Required

**Manual configuration needed before testing:**

1. Generate AUTH_SECRET:
   ```bash
   openssl rand -base64 32
   ```
   Add to dashboard/.env.local

2. Deploy infrastructure to create UsersTable:
   ```bash
   npx sst dev --stage dev
   ```

3. Create test user in DynamoDB UsersTable:
   ```bash
   # Hash password with bcrypt (10 rounds)
   # Insert: userId, email, name, passwordHash, createdAt, updatedAt
   ```

4. Update dashboard/.env.local with actual table name from sst outputs

## Next Phase Readiness

- Dashboard foundation complete with authentication
- Ready for Plan 02: Sites CRUD API (list/create/edit projects)
- Sidebar navigation ready for /sites and /settings routes
- Auth session provides userId for multi-tenant data filtering

---
*Phase: 03-dashboard-observability*
*Completed: 2026-02-01*
