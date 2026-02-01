---
phase: 03-dashboard-observability
plan: 02
subsystem: dashboard
tags: [tanstack-table, dynamodb, sites-list, deployments, rollback, server-actions]

# Dependency graph
requires:
  - phase: 03-01
    provides: Dashboard foundation with Auth.js and shadcn/ui
  - phase: 02-03
    provides: Rollback API endpoint
provides:
  - Sites list page at /sites with TanStack Table
  - Deployment history page at /sites/[siteId]/deployments
  - Rollback functionality via server action calling existing API
  - DynamoDB query functions for projects and deployments
affects: [03-03, 03-04]

# Tech tracking
tech-stack:
  added: [@tanstack/react-table, date-fns]
  patterns: [TanStack Table with DataTable wrapper, Server actions for mutations, GSI queries for multi-tenant data]

key-files:
  created:
    - dashboard/lib/aws/types.ts
    - dashboard/lib/aws/dynamodb.ts
    - dashboard/components/ui/data-table.tsx
    - dashboard/components/tables/sites-table.tsx
    - dashboard/components/tables/deployments-table.tsx
    - dashboard/components/dashboard/site-nav.tsx
    - dashboard/app/(dashboard)/sites/page.tsx
    - dashboard/app/(dashboard)/sites/[siteId]/layout.tsx
    - dashboard/app/(dashboard)/sites/[siteId]/page.tsx
    - dashboard/app/(dashboard)/sites/[siteId]/deployments/page.tsx
    - dashboard/app/(dashboard)/sites/[siteId]/deployments/actions.ts
  modified:
    - dashboard/app/(dashboard)/page.tsx
    - dashboard/package.json

key-decisions:
  - "Dashboard home redirects to /sites: Users land directly on sites list"
  - "Site overview redirects to deployments: Deployments is primary site view for now"
  - "Project ownership check in layout: Security verification once for all site pages"
  - "Rollback via server action: Type-safe mutation with automatic revalidation"

patterns-established:
  - "DataTable wrapper: Reusable TanStack Table component with shadcn/ui styling"
  - "Site layout pattern: Shared layout verifies ownership and renders nav for all site pages"
  - "Server action for API calls: triggerRollback wraps external API with auth check"
  - "GSI queries: getUserProjects and getProjectDeployments use indexed lookups"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 03 Plan 02: Sites List & Deployments Summary

**Sites list page with TanStack Table and deployment history with rollback functionality**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T15:41:11Z
- **Completed:** 2026-02-01T15:45:29Z
- **Tasks:** 3
- **Files created/modified:** 14

## Accomplishments

- Installed TanStack Table and date-fns for data tables and date formatting
- Added shadcn/ui table, badge, and dropdown-menu components
- Created TypeScript interfaces for Project, Deployment, User, Domain entities
- Created DynamoDB query functions using GSI lookups for multi-tenant queries
- Built reusable DataTable component wrapping TanStack Table with shadcn/ui
- Created SitesTable showing all user projects with status badges
- Created site layout with ownership verification and sub-navigation
- Created DeploymentsTable with rollback action for successful deployments
- Created triggerRollback server action calling POST /projects/{projectId}/rollback API
- Dashboard home now redirects directly to /sites

## Task Commits

Each task was committed atomically:

1. **Task 1: DynamoDB Query Functions and TanStack Table** - `9b0033e` (feat)
2. **Task 2: Sites List Page with TanStack Table** - `adf8e4c` (feat)
3. **Task 3: Deployment History Page with Rollback** - `7cfbd8f` (feat)

## Files Created/Modified

**Created:**
- `dashboard/lib/aws/types.ts` - TypeScript interfaces for DynamoDB entities
- `dashboard/lib/aws/dynamodb.ts` - Query functions: getUserProjects, getProjectDeployments, getProject, getDeployment
- `dashboard/components/ui/data-table.tsx` - Reusable TanStack Table wrapper with sorting
- `dashboard/components/ui/table.tsx` - shadcn/ui table component
- `dashboard/components/ui/badge.tsx` - shadcn/ui badge component
- `dashboard/components/ui/dropdown-menu.tsx` - shadcn/ui dropdown-menu component
- `dashboard/components/tables/sites-table.tsx` - Sites table with columns: Name, Repository, Status, Last Updated
- `dashboard/components/tables/deployments-table.tsx` - Deployments table with rollback action
- `dashboard/components/dashboard/site-nav.tsx` - Site sub-navigation (Overview, Deployments, Logs, Metrics, Env, Domains)
- `dashboard/app/(dashboard)/sites/page.tsx` - Sites list server component
- `dashboard/app/(dashboard)/sites/[siteId]/layout.tsx` - Site layout with ownership check
- `dashboard/app/(dashboard)/sites/[siteId]/page.tsx` - Site overview (redirects to deployments)
- `dashboard/app/(dashboard)/sites/[siteId]/deployments/page.tsx` - Deployments history page
- `dashboard/app/(dashboard)/sites/[siteId]/deployments/actions.ts` - triggerRollback server action

**Modified:**
- `dashboard/package.json` - Added @tanstack/react-table, date-fns
- `dashboard/app/(dashboard)/page.tsx` - Now redirects to /sites

## Decisions Made

1. **Dashboard home redirects to /sites** - Users land directly on the sites list rather than a welcome page with cards. More useful for returning users.

2. **Site overview redirects to deployments** - Deployments is the primary site view; overview can show stats later when metrics are added.

3. **Project ownership check in layout** - Security verification happens once in the site layout, protecting all nested pages (deployments, logs, env, etc.).

4. **Rollback via server action** - Type-safe mutation with automatic page revalidation. Uses existing POST /projects/{projectId}/rollback API.

## Deviations from Plan

None - plan executed exactly as written.

## Success Criteria Verification

- [x] Sites list page at /sites shows all user's projects
- [x] TanStack Table with sorting for sites
- [x] Deployment history at /sites/[siteId]/deployments
- [x] Rollback button visible on successful deployments
- [x] Rollback calls POST /projects/{projectId}/rollback API
- [x] UI shows success/error feedback after rollback
- [x] Page revalidates after rollback

## Next Phase Readiness

- Sites list and deployment history complete
- Site navigation tabs ready for Logs, Metrics, Env, Domains pages
- DynamoDB query functions reusable for other pages
- Ready for Plan 03-03: Env variables editor

---
*Phase: 03-dashboard-observability*
*Completed: 2026-02-01*
