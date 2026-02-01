# Anchor Deploy

## What This Is

A self-hosted serverless deployment platform for Next.js applications, built on AWS. Similar to Vercel but privately operated by Anchor Digital in Cambodia for hosting client websites. Provides automatic GitHub-based deployments, custom domain management, and full observability.

## Core Value

When a developer pushes to main, the Next.js site is automatically built and deployed to production with zero manual intervention.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Connect GitHub repositories for automatic deployments
- [ ] Build and deploy Next.js sites on push to main branch
- [ ] Support dynamic Next.js features (API routes, SSR)
- [ ] Serverless architecture on AWS Singapore region
- [ ] Custom domain configuration per site
- [ ] Automatic SSL certificate provisioning
- [ ] View deployment logs and build output
- [ ] Error tracking and alerting
- [ ] Performance metrics (response times, request counts)
- [ ] Web dashboard to manage all sites
- [ ] Scale cost-efficiently from 3 to 50+ sites

### Out of Scope

- Preview deployments for branches — v1 is production-only
- Docker containers — using serverless instead
- Mobile app — web dashboard only
- Multi-region deployment — Singapore only for v1
- Self-service signup — internal use only for Anchor Digital clients

## Context

- Anchor Digital is a web development company in Cambodia (anchordigital.co)
- Initial deployment: 3 client websites
- Target scale: 50+ websites over time
- All sites are Next.js with dynamic features (API routes, SSR)
- AWS is the cloud provider with existing CLI access
- Cost efficiency is important given the number of sites

## Constraints

- **Cloud Provider**: AWS — existing account and CLI access configured
- **Region**: Singapore (ap-southeast-1) — closest to Cambodia
- **Architecture**: Serverless only — no always-on containers for cost efficiency
- **Framework**: Next.js support required — all client sites use Next.js
- **SSL**: Must be automatic — no manual certificate management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Serverless over Docker | Cost efficiency at scale, pay only for usage | — Pending |
| Production-only deployments | Simplify v1 scope, preview can come later | — Pending |
| AWS Singapore region | Lowest latency to Cambodia users | — Pending |
| Web dashboard included | Needed for managing multiple sites effectively | — Pending |

---
*Last updated: 2025-02-01 after initialization*
