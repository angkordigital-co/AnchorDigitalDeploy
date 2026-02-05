# Anchor Deploy

## What This Is

A self-hosted serverless deployment platform for Next.js applications, built on AWS. Similar to Vercel but privately operated by Anchor Digital in Cambodia for hosting client websites. Provides automatic GitHub-based deployments, zero-downtime Lambda deployments with instant rollback, custom domain management with automatic SSL, and a full observability dashboard.

## Core Value

When a developer pushes to main, the Next.js site is automatically built and deployed to production with zero manual intervention.

## Requirements

### Validated

- ✓ Connect GitHub repositories for automatic deployments — v1.0
- ✓ Build and deploy Next.js sites on push to main branch — v1.0
- ✓ Support dynamic Next.js features (API routes, SSR) — v1.0
- ✓ Serverless architecture on AWS Singapore region — v1.0
- ✓ Custom domain configuration per site — v1.0
- ✓ Automatic SSL certificate provisioning — v1.0
- ✓ View deployment logs and build output — v1.0
- ✓ Error tracking and aggregation — v1.0
- ✓ Performance metrics (response times, request counts) — v1.0
- ✓ Web dashboard to manage all sites — v1.0
- ✓ Scale cost-efficiently from 3 to 50+ sites — v1.0 (serverless architecture)

### Active

- ✓ GitHub OAuth integration for streamlined site creation — v1.1
- ✓ Repository selection dropdown from connected GitHub account — v1.1
- ✓ Automatic webhook creation on site creation — v1.1
- ✓ Settings page for managing integrations — v1.1

### Out of Scope

- Preview deployments for branches — deferred to v2
- Docker containers — using serverless instead
- Mobile app — web dashboard only
- Multi-region deployment — Singapore only for v1
- Self-service signup — internal use only for Anchor Digital clients
- GitLab/Bitbucket — GitHub only for now
- Monorepo support — single app per repo

## Context

Shipped v1.0 MVP with 33,723 lines of TypeScript across 141 files. v1.1 adds GitHub OAuth integration for streamlined site creation.

**Tech stack:**
- SST Ion v3 for infrastructure-as-code
- DynamoDB for metadata storage
- S3 for artifacts and static assets
- SQS + CodeBuild for build pipeline
- Lambda for SSR and API routes
- CloudFront for CDN
- ACM for SSL certificates
- Auth.js v5 for dashboard authentication
- Next.js 16 dashboard with shadcn/ui

**Known issues (tech debt):**
- API_GATEWAY_URL env var needs configuration for dashboard API calls
- CloudFront invalidation relies on TTL (no manual invalidation)
- Secret env vars stored in DynamoDB (Secrets Manager migration planned)

## Constraints

- **Cloud Provider**: AWS — existing account and CLI access configured
- **Region**: Singapore (ap-southeast-1) — closest to Cambodia
- **Architecture**: Serverless only — no always-on containers for cost efficiency
- **Framework**: Next.js support required — all client sites use Next.js
- **SSL**: Must be automatic — no manual certificate management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Serverless over Docker | Cost efficiency at scale, pay only for usage | ✓ Good — Lambda cold starts acceptable |
| Production-only deployments | Simplify v1 scope, preview can come later | ✓ Good — shipped faster |
| AWS Singapore region | Lowest latency to Cambodia users | ✓ Good — low latency confirmed |
| Web dashboard included | Needed for managing multiple sites effectively | ✓ Good — essential for operations |
| SST Ion v3 over CDK | Modern IaC with live dev mode | ✓ Good — fast iteration |
| OpenNext for Lambda packaging | Standard Next.js → Lambda adapter | ✓ Good — works with Next.js 15 |
| Lambda aliases for zero-downtime | Instant rollback via alias switch | ✓ Good — <1s rollbacks |
| DynamoDB over PostgreSQL | Serverless, no connection pooling | ✓ Good — scales naturally |
| Auth.js v5 for dashboard | JWT sessions, serverless-friendly | ✓ Good — stateless auth |
| ACM in us-east-1 | CloudFront requires us-east-1 certs | ✓ Good — automatic integration |

---
*Last updated: 2026-02-05 — v1.1 GitHub OAuth integration*
