# Roadmap: Anchor Deploy

## Overview

Build a self-hosted serverless deployment platform for Next.js applications on AWS. Start with core infrastructure and automated build pipeline, add deployment and custom domain capabilities, then finish with a management dashboard for multi-site operations. Each phase delivers a complete, verifiable capability that brings us closer to production-ready automated deployments.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Infrastructure & Build** - AWS foundation and automated build pipeline
- [ ] **Phase 2: Deployment & CDN** - Serverless deployment with custom domains
- [ ] **Phase 3: Dashboard & Observability** - Management UI and production monitoring

## Phase Details

### Phase 1: Infrastructure & Build
**Goal**: Automated build pipeline transforms GitHub pushes into deployable Next.js artifacts

**Depends on**: Nothing (first phase)

**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, GIT-01, GIT-02, GIT-03, GIT-04, BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05

**Success Criteria** (what must be TRUE):
  1. GitHub push to main triggers build automatically via webhook
  2. Build runs `npm install` and `next build` with OpenNext packaging
  3. User can view real-time build logs during deployment
  4. Build artifacts stored in S3 with metadata in DynamoDB
  5. Environment variables can be configured and used during builds

**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — SST Infrastructure Foundation (DynamoDB + S3 with lifecycle policies)
- [x] 01-02-PLAN.md — GitHub Webhook Integration (API Gateway + signature validation)
- [x] 01-03-PLAN.md — Build Pipeline (CodeBuild + SQS orchestration with OpenNext)
- [x] 01-04-PLAN.md — Environment Variables & Build Logs (configuration + CloudWatch)

### Phase 2: Deployment & CDN
**Goal**: Next.js sites deploy to Lambda with custom domains and automatic SSL

**Depends on**: Phase 1

**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05, DEPLOY-06, DOMAIN-01, DOMAIN-02, DOMAIN-03, DOMAIN-04

**Success Criteria** (what must be TRUE):
  1. Next.js SSR pages render via Lambda functions
  2. Next.js API routes work correctly via Lambda
  3. Static assets serve from CloudFront with CDN caching
  4. Custom domains configured with automatic SSL via ACM
  5. User can rollback to previous deployment instantly
  6. Deployments complete with zero downtime

**Plans**: TBD

Plans:
- [ ] 02-01: TBD during phase planning
- [ ] 02-02: TBD during phase planning

### Phase 3: Dashboard & Observability
**Goal**: Web dashboard provides full visibility and control over all deployed sites

**Depends on**: Phase 2

**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, OBS-01, OBS-02, OBS-03, OBS-04, OBS-05

**Success Criteria** (what must be TRUE):
  1. User can log in to web dashboard and view all connected sites
  2. User can view deployment history and trigger rollbacks
  3. User can view and edit environment variables from dashboard
  4. User can configure custom domains from dashboard
  5. User can view runtime logs, errors, and performance metrics
  6. User can view AWS cost breakdown per site

**Plans**: TBD

Plans:
- [ ] 03-01: TBD during phase planning
- [ ] 03-02: TBD during phase planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Infrastructure & Build | 4/4 | Complete | 2026-02-01 |
| 2. Deployment & CDN | 0/2 | Ready to execute | - |
| 3. Dashboard & Observability | 0/2 | Not started | - |
