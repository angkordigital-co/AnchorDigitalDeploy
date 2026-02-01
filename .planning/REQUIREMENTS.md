# Requirements: Anchor Deploy

**Defined:** 2026-02-01
**Core Value:** When a developer pushes to main, the Next.js site is automatically built and deployed to production with zero manual intervention.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Platform deploys to AWS Singapore region (ap-southeast-1)
- [ ] **INFRA-02**: System uses serverless architecture (Lambda, not containers)
- [ ] **INFRA-03**: DynamoDB stores site metadata and deployment records
- [ ] **INFRA-04**: S3 stores build artifacts and static assets
- [ ] **INFRA-05**: CloudFront serves sites with CDN caching

### GitHub Integration

- [ ] **GIT-01**: User can connect a GitHub repository to deploy
- [ ] **GIT-02**: Push to main branch triggers automatic build and deploy
- [ ] **GIT-03**: Webhook receives GitHub push events securely
- [ ] **GIT-04**: Deployment history shows Git commit SHA and message

### Build System

- [ ] **BUILD-01**: System runs `npm install` and `next build` for each deployment
- [ ] **BUILD-02**: Build output uses OpenNext to package for Lambda
- [ ] **BUILD-03**: User can view real-time build logs during deployment
- [ ] **BUILD-04**: Build artifacts are cached to speed up subsequent builds
- [ ] **BUILD-05**: User can set environment variables for build-time use

### Deployment

- [ ] **DEPLOY-01**: Next.js SSR pages render via Lambda functions
- [ ] **DEPLOY-02**: Next.js API routes work via Lambda functions
- [ ] **DEPLOY-03**: Static assets serve from S3 via CloudFront
- [ ] **DEPLOY-04**: Deployments complete with zero downtime
- [ ] **DEPLOY-05**: User can rollback to previous deployment instantly
- [ ] **DEPLOY-06**: Each deployment gets a unique version identifier

### Domains & SSL

- [ ] **DOMAIN-01**: User can configure custom domain for each site
- [ ] **DOMAIN-02**: SSL certificate provisioned automatically via ACM
- [ ] **DOMAIN-03**: CloudFront routes custom domain to correct site
- [ ] **DOMAIN-04**: User sees instructions for DNS configuration

### Observability

- [ ] **OBS-01**: User can view runtime logs from Lambda functions
- [ ] **OBS-02**: Errors are tracked and aggregated for each site
- [ ] **OBS-03**: User can view response time metrics per site
- [ ] **OBS-04**: User can view request count metrics per site
- [ ] **OBS-05**: User can view AWS cost breakdown per site

### Dashboard

- [ ] **DASH-01**: User can log in to web dashboard
- [ ] **DASH-02**: Dashboard shows list of all connected sites
- [ ] **DASH-03**: User can view deployment history for each site
- [ ] **DASH-04**: User can view and edit environment variables
- [ ] **DASH-05**: User can view logs and metrics from dashboard
- [ ] **DASH-06**: User can trigger rollback from dashboard
- [ ] **DASH-07**: User can configure custom domain from dashboard

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Preview Deployments

- **PREVIEW-01**: Each pull request gets unique preview URL
- **PREVIEW-02**: Preview deployments auto-delete when PR closes
- **PREVIEW-03**: Preview URL shown as GitHub PR comment

### Team Collaboration

- **TEAM-01**: Multiple users can access same organization
- **TEAM-02**: Role-based access control (admin, developer, viewer)
- **TEAM-03**: Deployment approvals before production

### Advanced Features

- **ADV-01**: Secrets scanning blocks deployments with exposed keys
- **ADV-02**: Automated dependency update suggestions
- **ADV-03**: Multi-site shared Lambda infrastructure

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-cloud (GCP, Azure) | 10x complexity for <5% benefit. AWS-only is acceptable. |
| Docker containers | Using serverless for cost efficiency per project constraints |
| Custom build scripts | Debugging nightmare. Use Next.js built-in build only. |
| Integrated databases | Database lifecycle ≠ app lifecycle. Link to external RDS/Atlas. |
| Visual/no-code builder | Building deployment platform, not web builder. |
| Custom edge runtime | Lambda cold starts acceptable. Edge runtime has compatibility issues. |
| GitLab/Bitbucket | GitHub-only for v1. Can add later if demand exists. |
| Monorepo support | Single app per repo for v1. Complex to detect which subdirectory changed. |
| Preview deployments | Explicitly deferred to v2 per user decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 2 | Complete |
| GIT-01 | Phase 1 | Complete |
| GIT-02 | Phase 1 | Complete |
| GIT-03 | Phase 1 | Complete |
| GIT-04 | Phase 1 | Complete |
| BUILD-01 | Phase 1 | Complete |
| BUILD-02 | Phase 1 | Complete |
| BUILD-03 | Phase 1 | Complete |
| BUILD-04 | Phase 1 | Complete |
| BUILD-05 | Phase 1 | Complete |
| DEPLOY-01 | Phase 2 | Complete |
| DEPLOY-02 | Phase 2 | Complete |
| DEPLOY-03 | Phase 2 | Complete |
| DEPLOY-04 | Phase 2 | Complete |
| DEPLOY-05 | Phase 2 | Complete |
| DEPLOY-06 | Phase 2 | Complete |
| DOMAIN-01 | Phase 2 | Complete |
| DOMAIN-02 | Phase 2 | Complete |
| DOMAIN-03 | Phase 2 | Complete |
| DOMAIN-04 | Phase 2 | Complete |
| OBS-01 | Phase 3 | Pending |
| OBS-02 | Phase 3 | Pending |
| OBS-03 | Phase 3 | Pending |
| OBS-04 | Phase 3 | Pending |
| OBS-05 | Phase 3 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| DASH-07 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after Phase 2 completion (25/37 requirements complete)*
