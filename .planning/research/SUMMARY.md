# Project Research Summary

**Project:** Anchor Deploy - Self-hosted serverless Next.js deployment platform
**Domain:** Serverless deployment platform (Next.js on AWS)
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

Anchor Deploy is a self-hosted serverless deployment platform for Next.js applications on AWS, targeting teams managing 3-50 sites who want Vercel-like developer experience without vendor lock-in. Research shows this domain has well-established patterns in 2026, with **OpenNext v3 + SST Ion** emerging as the standard stack for deploying Next.js to AWS Lambda.

The recommended approach centers on pool-based multi-tenancy architecture with seven major subsystems: webhook ingestion, build orchestration (CodeBuild), deployment provisioning (Lambda + API Gateway), content delivery (CloudFront), domain/certificate management (ACM + Route 53), metadata storage (DynamoDB + S3), and a Next.js management dashboard. This architecture balances cost efficiency ($17/site/month at scale) with production-readiness, using regional Lambda instead of Lambda@Edge for better cost, latency, and operational simplicity in the Singapore region.

Key risks center on multi-tenancy design decisions that must be made upfront: database connection pooling strategy (RDS Proxy mandatory), tenant data isolation model (row-level security vs schema-per-tenant), and certificate quota management at scale (CloudFront SaaS Manager for 50+ custom domains). These architectural choices cannot be retrofitted after launch without major refactoring. The platform requires 11 table-stakes features in v1 (Git push to deploy, SSL, logs, rollback) and can strategically defer 7 nice-to-have features to v2 (preview deployments, team collaboration, advanced analytics).

## Key Findings

### Recommended Stack

The 2026 standard for Next.js on AWS is **SST Ion (v3)** as infrastructure-as-code layer, using **OpenNext v3** under the hood to translate Next.js builds into AWS primitives. This combination provides production-ready Next.js 15 support (App Router, Server Actions, SSR, ISR) while maintaining serverless cost efficiency.

**Core technologies:**
- **SST Ion v3**: Batteries-included IaC built on Pulumi/Terraform, automatic OpenNext integration, faster than CloudFormation-based alternatives
- **OpenNext v3**: Standard adapter for Next.js to Lambda, actively maintained by SST team, supports all Next.js 15 features
- **Regional Lambda (Node.js 22)**: ~40% cheaper than Lambda@Edge, 15-min timeout vs 30s, simpler debugging for Singapore-focused traffic
- **CloudFront + S3**: Global CDN with edge caching, S3 for static assets with 1-year cache TTL
- **CodeBuild**: Fully managed build service, pay-per-minute, better than custom EC2 or Lambda builds (10GB storage limit, 30-min timeout)
- **DynamoDB + S3**: DynamoDB on-demand for metadata (projects, deployments, domains), S3 for large objects (build artifacts, logs)
- **ACM + Route 53**: Free SSL certificates with automatic renewal, DNS validation for custom domains
- **Next.js 15 + Tailwind + shadcn/ui**: Dashboard built on same platform (dogfooding)

**Critical version requirements:**
- Node.js 22 LTS (Node.js 20 EOL April 30, 2026)
- Next.js 15.x (required for OpenNext v3 compatibility)
- TypeScript 5.5+ (required by Zod for runtime validation)

### Expected Features

Research across Vercel, Netlify, Railway, Coolify, and Dokploy identified **11 table-stakes features** users expect from any deployment platform in 2026, plus **8 differentiators** that drive adoption and retention.

**Must have (table stakes):**
- Git push to deploy (GitHub webhooks)
- Automatic SSL/TLS (Let's Encrypt/ACM, zero config)
- Build logs (real-time streaming via WebSocket/SSE)
- Deployment logs (runtime CloudWatch integration)
- Environment variables (encrypted at rest, build-time + runtime)
- Custom domains (not subdomains, real custom domains)
- Deployment history (90-day retention minimum)
- Instant rollback (<30 seconds)
- Next.js full support (SSR, API routes, middleware, ISR)
- Zero-downtime deploys (blue-green pattern)
- Observability (error tracking, CloudWatch Insights)

**Should have (competitive differentiators):**
- Cost transparency (show exact AWS costs per site) — Vercel/Netlify hide this
- Build caching (5min → 30sec builds) — critical for DX, Coolify/Dokploy lack this
- Regional deployment (guarantee Singapore for <50ms latency)
- Deployment analytics (DORA metrics: frequency, MTTR)
- Multi-site efficiency (shared Lambda functions across sites)

**Defer (v2+):**
- Preview deployments (PR environments)
- Team collaboration (RBAC, comments, approvals)
- Secrets scanning
- Automated dependency updates
- Advanced analytics beyond DORA basics
- Multi-framework support (focus Next.js excellence first)
- Multi-cloud (AWS-only is acceptable)

**Competitive positioning:** "Production-ready self-hosted Next.js deployment for AWS. Vercel DX without vendor lock-in." Target cost: ~$17/site/month at 50-site scale vs Vercel's $20/user/month + opaque overages.

### Architecture Approach

The architecture consists of **7 major subsystems** orchestrated through asynchronous events and shared data stores, following pool-based multi-tenancy model (shared infrastructure, tenant isolation at data/execution level).

**Major components:**

1. **Webhook Ingestion** — API Gateway receives GitHub webhooks, Lambda validates signatures, SQS queues build jobs (decouples receipt from execution, enables retry/DLQ)

2. **Build Orchestration** — Lambda scheduler triggers CodeBuild projects, runs `npm install && npm run build && opennext`, uploads artifacts to S3, streams logs to CloudWatch

3. **Deployment Provisioning** — Lambda orchestrator deploys build artifacts: updates Lambda functions (SSR/API), uploads static assets to S3 with versioned paths, provisions API Gateway per project

4. **Content Delivery** — CloudFront distribution per project with origin groups (S3 for static, API Gateway for SSR), cache behaviors by path pattern (/_next/static/* = 1yr, SSR = 0s)

5. **Domain & Certificate Management** — Lambda DNS manager provisions ACM certificates with DNS validation, creates Route 53 records, updates CloudFront distributions, tracks in DynamoDB

6. **Metadata & State** — DynamoDB tables (Projects, Deployments, Domains, Build Logs Index) + S3 buckets (artifacts, logs, static assets, ISR cache)

7. **Management Dashboard** — Next.js SPA deployed on same platform (dogfooding), API Gateway + Lambda for CRUD operations, Cognito for authentication

**Key architectural decisions:**
- Regional Lambda + CloudFront (NOT Lambda@Edge) — 40% cheaper, simpler debugging, avoids data locality problems
- Blue-green deployments — new Lambda version alongside old, atomic traffic switch, instant rollback
- Versioned static asset paths — `/static/{buildId}/*` eliminates CloudFront invalidation costs ($0.005/path)
- Async build pipeline — webhook returns 202 immediately, build status polled/streamed separately (API Gateway 29s timeout)
- One Lambda function per project — handles all routes internally via OpenNext adapter (not one function per route)

**Data flow (happy path):** GitHub push → Webhook → Lambda validator → SQS → Lambda scheduler → CodeBuild (build + OpenNext) → S3 artifacts → Lambda deploy orchestrator → Lambda functions + S3 static → CloudFront distribution → Custom domain via Route 53

### Critical Pitfalls

Research identified 15 domain-specific pitfalls (6 critical, 6 moderate, 3 minor) that cause rewrites, outages, or cost overruns. Top 5 requiring architectural prevention:

1. **Lambda size limits** — Next.js bundles exceed 250MB unzipped limit; must plan for Lambda Container Images (10GB) or Layers from day one, never assume standard packaging works

2. **Database connection pool exhaustion** — Lambda auto-scales to 100+ instances, each creating connections; use RDS Proxy (mandatory for multi-tenant), set pool size to 1 per function, monitor DatabaseConnectionsBorrowLatency

3. **Multi-tenant data isolation** — Must design tenant isolation BEFORE first database schema (row-level security, schema-per-tenant, or DB-per-tenant); retrofitting requires full migration affecting all tenants

4. **CloudFront certificate quotas** — AWS default: 10 ACM certs (max 100 with request), ALB hard limit 100 certs; use CloudFront SaaS Manager (2025 release) for multi-tenant distributions, track quota usage

5. **API Gateway 29-second timeout** — Hard limit, non-configurable; builds must be async (webhook returns 202, client polls status), never synchronous HTTP for >20s operations

6. **Missing NODE_ENV=production** — Lambda doesn't set by default; causes blank pages, 10x slower performance, development bundles in production; must verify in IaC for every function

**Phase-specific warnings:**
- Phase 1 (Infrastructure): Connection pooling, Lambda size strategy, NODE_ENV, tenant isolation model
- Phase 2 (Custom Domains): Certificate quota strategy, multi-domain routing
- Phase 3 (Build System): Async architecture for API Gateway timeout, S3 lifecycle policies for artifacts
- Phase 4 (ISR): Cache invalidation budget, On-Demand vs time-based ISR

## Implications for Roadmap

Based on research dependencies and pitfall prevention, recommended 7-phase structure:

### Phase 1: Infrastructure Foundation (Weeks 1-2)
**Rationale:** All other components depend on data layer and core AWS services; critical architectural decisions (multi-tenancy model, connection pooling strategy, Lambda packaging approach) must be locked in before building controllers.

**Delivers:** DynamoDB schema (Projects, Deployments tables), S3 buckets (artifacts, static assets), IAM roles/policies, RDS Proxy if using relational DB, tenant isolation model documented

**Addresses:**
- Architecture: Metadata & State Management subsystem
- Pitfalls: Multi-tenant data isolation (#3), connection pooling (#2), NODE_ENV mandate (#6)

**Critical decisions required:**
- Tenant isolation model: Row-level security in shared DB vs schema-per-tenant (affects all future phases)
- Lambda packaging strategy: Container Images vs Layers for Next.js size limits
- Database choice: DynamoDB (recommended) vs Aurora Serverless

**Research flags:** None — DynamoDB schema and IAM are well-documented AWS patterns

---

### Phase 2: Build Pipeline (Weeks 3-4)
**Rationale:** Tests end-to-end build flow without deployment complexity; validates CodeBuild can handle Next.js builds with OpenNext; establishes async pattern critical for API Gateway timeout avoidance.

**Delivers:** GitHub webhook receiver (API Gateway + Lambda validator), SQS build queue, CodeBuild project with OpenNext adapter, build orchestrator Lambda, build logs stored in S3 and indexed in DynamoDB

**Addresses:**
- Features: Git push to deploy, build logs (real-time streaming)
- Architecture: Webhook Ingestion + Build Orchestration subsystems
- Pitfalls: API Gateway timeout (#5), async build pattern

**Avoids:** Pitfall #5 (API Gateway timeout) by designing async from start — webhook returns 202 immediately, build status polled separately

**Uses:** SST Ion for Lambda functions, CodeBuild for managed builds, OpenNext for Next.js → Lambda packaging

**Research flags:** **NEEDS RESEARCH** — OpenNext v3 compatibility with Next.js 15 features (App Router, Server Actions, Partial Prerendering) must be verified with test apps during this phase

---

### Phase 3: Deployment Engine (Weeks 5-6)
**Rationale:** Depends on build artifacts from Phase 2; delivers core value prop (deploy to AWS); tests Lambda size limits and versioned asset strategy.

**Delivers:** Lambda deployment orchestrator, Lambda function provisioning (SSR/API handlers), API Gateway provisioning per project, static asset upload to S3 with versioned paths (`/static/{buildId}/*`), blue-green deployment pattern

**Addresses:**
- Features: Next.js full support, zero-downtime deploys, instant rollback
- Architecture: Deployment Provisioning subsystem
- Pitfalls: Lambda size limits (#1), static assets separation (#7)

**Avoids:** Pitfall #7 (static assets in Lambda) by using OpenNext's automatic S3 separation; Pitfall #1 by using Container Images if bundles >200MB

**Implements:** Blue-green deployment (Lambda versioning + API Gateway stage switching) for instant rollback capability

**Research flags:** **NEEDS RESEARCH** — ISR cache storage strategy (S3 vs ElastiCache Redis vs DynamoDB) — tradeoffs for cost and latency need validation during this phase

---

### Phase 4: Content Delivery (Weeks 7-8)
**Rationale:** Depends on deployment outputs from Phase 3; adds global CDN and caching for performance; implements versioned asset paths to eliminate invalidation costs.

**Delivers:** CloudFront distribution provisioning per project, origin configuration (S3 for static, API Gateway for SSR), cache behaviors by path pattern, versioned asset path enforcement

**Addresses:**
- Features: Production performance, global CDN
- Architecture: Content Delivery subsystem
- Pitfalls: CloudFront invalidation costs (#8)

**Avoids:** Pitfall #8 (invalidation costs) by using versioned static assets with build ID — no invalidation needed, users always get correct version based on HTML reference

**Uses:** Regional Lambda (not Lambda@Edge) — 40% cheaper, simpler debugging for Singapore region

**Cache behaviors implemented:**
- `/_next/static/*` → S3 origin, 1yr TTL (immutable)
- `/api/*` → API Gateway origin, 0s TTL (no cache)
- `/*` (SSR pages) → API Gateway origin, 0s TTL initially (configurable per route later)

**Research flags:** None — CloudFront + S3 is well-established pattern

---

### Phase 5: Custom Domains (Weeks 9-10)
**Rationale:** Depends on CloudFront from Phase 4; complex async flow (certificate validation takes 5-15 minutes); table-stakes feature but not critical for proof-of-concept.

**Delivers:** ACM certificate automation with DNS validation, Route 53 record provisioning, domain validation flow, DynamoDB Domains table, certificate quota tracking/alerting

**Addresses:**
- Features: Custom domains (table stakes), automatic SSL/TLS
- Architecture: Domain & Certificate Management subsystem
- Pitfalls: Certificate quota limits (#4)

**Avoids:** Pitfall #4 (certificate quotas) by implementing CloudFront SaaS Manager pattern for multi-tenant distributions, tracking quota usage, alerting at 70% of limit

**Critical decisions required:**
- Multi-domain strategy: One CloudFront distribution per project vs shared distribution with Host header routing
- Certificate management: Individual ACM certs vs wildcard certs strategy

**Research flags:** **NEEDS RESEARCH** — CloudFront SaaS Manager implementation details (released 2025, limited documentation) — may need deeper research during this phase

---

### Phase 6: Management Dashboard (Weeks 11-12)
**Rationale:** Depends on all backend services being functional; provides UI for features built in Phases 1-5; can use API directly via Postman before dashboard ready (doesn't block backend development).

**Delivers:** Next.js dashboard SPA (deployed on same platform for dogfooding), API Gateway endpoints for CRUD operations, Lambda API handlers, Cognito authentication, deployment list view, log streaming UI, settings management

**Addresses:**
- Features: Dashboard (web UI) — table stakes feature
- Architecture: Management Dashboard subsystem

**Uses:** Next.js 15 + Tailwind CSS + shadcn/ui for UI components, React Hook Form + Zod for form validation

**Implements:**
- Project creation/management
- Deployment history viewing
- Real-time build log streaming (WebSocket or SSE)
- Environment variable management
- Custom domain addition
- Rollback UI

**Research flags:** None — Next.js dashboard is standard pattern, multiple open-source templates available (TailAdmin, Horizon UI)

---

### Phase 7: Observability & Production Hardening (Weeks 13-14)
**Rationale:** Operational feature, not core value prop; requires understanding of failure modes from earlier phases; adds production-readiness before launch.

**Delivers:** CloudWatch dashboards (build metrics, Lambda performance, API Gateway health), CloudWatch alarms (build failures, error rates, latency spikes), SNS alerting, X-Ray distributed tracing, structured logging with correlation IDs, rollback API and UI

**Addresses:**
- Features: Observability (errors), deployment analytics (DORA metrics)
- Pitfalls: Missing observability (#9)

**Avoids:** Pitfall #9 (no observability) by implementing from start, not post-launch

**Implements:**
- Build success/failure rate tracking
- Lambda cold start monitoring
- API Gateway 4xx/5xx rate alarms
- Deployment frequency metrics (DORA)
- Mean time to recovery (MTTR) tracking
- Cost tracking per project

**Research flags:** None — CloudWatch metrics and X-Ray are well-documented

---

### Phase Ordering Rationale

**Critical path dependencies:**
1. Data layer (Phase 1) before everything — DynamoDB schema must be stable before building controllers
2. Build (Phase 2) before deploy (Phase 3) — must have working build pipeline before deployment logic
3. Deploy (Phase 3) before CDN (Phase 4) — must have working Lambda/S3 deploy before adding CloudFront
4. CDN (Phase 4) before domains (Phase 5) — CloudFront required for custom domain setup with ACM

**Parallelizable work:**
- Dashboard (Phase 6) can start in parallel with Phases 4-5 using API Gateway directly
- Observability (Phase 7) can be added incrementally throughout all phases

**Pitfall-driven ordering:**
- Phase 1 addresses architectural pitfalls that cannot be retrofitted (#2, #3, #6)
- Phase 2 establishes async pattern to avoid #5 before building more features
- Phase 3 implements static asset separation (#7) and Lambda sizing (#1) with OpenNext
- Phase 5 implements certificate quota strategy (#4) before scaling to 50 sites

### Research Flags

**Phases needing deeper research during planning:**

- **Phase 2 (Build Pipeline):** OpenNext v3 compatibility with Next.js 15 App Router, Server Actions, Partial Prerendering — build test apps to verify all features work
- **Phase 3 (Deployment Engine):** ISR cache storage strategy (S3 vs ElastiCache vs DynamoDB) — need cost/latency comparison
- **Phase 5 (Custom Domains):** CloudFront SaaS Manager implementation (new service in 2025, limited docs) — may need API research or AWS support consultation

**Phases with standard patterns (skip research-phase):**

- **Phase 1 (Infrastructure):** DynamoDB schema, S3 buckets, IAM roles — well-documented AWS patterns
- **Phase 4 (Content Delivery):** CloudFront + S3 static hosting — battle-tested pattern, extensive docs
- **Phase 6 (Dashboard):** Next.js SPA with Tailwind — mature ecosystem, many templates available
- **Phase 7 (Observability):** CloudWatch metrics/alarms, X-Ray — comprehensive AWS documentation

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | OpenNext + SST Ion verified via official docs, GitHub activity (Jan 2026), multiple Medium articles; Node.js 22 LTS confirmed via AWS Lambda runtime docs |
| Features | HIGH | Table stakes verified against Vercel/Netlify/Railway official docs + 2026 comparison articles; complexity estimates based on AWS service docs |
| Architecture | HIGH | Component boundaries follow established serverless patterns; regional Lambda vs Lambda@Edge tradeoffs verified via AWS blogs + production post-mortems |
| Pitfalls | HIGH | All critical pitfalls verified via multiple sources (AWS docs + 2025-2026 production incidents); phase warnings mapped to specific architectural decisions |

**Overall confidence:** HIGH

### Gaps to Address

**OpenNext Next.js 15 feature support:** Research indicates OpenNext v3 supports Next.js 15, but specific features (App Router, Server Actions, Partial Prerendering, Middleware) need validation with test applications during Phase 2. OpenNext GitHub shows active commits in Jan 2026, but comprehensive compatibility matrix not published.

**How to handle:** Build test Next.js 15 apps with all features in Phase 2, verify OpenNext packaging produces working Lambda functions. If gaps found, research workarounds or contribute to OpenNext.

**ISR cache storage tradeoffs:** Research shows three options (S3, ElastiCache Redis, DynamoDB) but lacks 2026 cost/latency comparison for Singapore region at 50-site scale. S3 is simplest (OpenNext default), ElastiCache is fastest, DynamoDB is most consistent.

**How to handle:** Start with S3 (OpenNext default) in Phase 3, measure latency/cost in staging with real traffic patterns, migrate to ElastiCache in Phase 4 if needed.

**CloudFront SaaS Manager implementation details:** Service released in 2025 for multi-tenant custom domain management, but documentation is sparse compared to mature AWS services. May require experimentation or AWS support consultation.

**How to handle:** Research CloudFront SaaS Manager API in Phase 5 before implementation. If insufficient docs, fallback to traditional multi-distribution approach with quota tracking.

**Multi-region expansion strategy:** Research focused on Singapore single-region deployment. If future requires multi-region (Tokyo, Sydney), DynamoDB global tables introduce eventual consistency tradeoffs not fully explored.

**How to handle:** Single-region for v1 (per project brief). If multi-region required in v2, research DynamoDB global tables vs Aurora Global Database during roadmap update.

**Lambda cold start mitigation at scale:** Research indicates cold starts are 200ms-3s for Next.js on Lambda. Provisioned concurrency reduces cold starts but costs money. Break-even point for 50 sites not calculated.

**How to handle:** Measure cold start frequency and impact in Phase 3 staging environment. If p95 latency >1s due to cold starts, research provisioned concurrency cost/benefit in Phase 7.

## Sources

### Primary (HIGH confidence)

**Official AWS Documentation:**
- AWS Lambda runtimes and limits (Node.js 22 LTS verified)
- AWS CodeBuild user guide (buildspec, artifacts, concurrent builds)
- AWS CloudFront distributions and cache behaviors
- AWS Certificate Manager DNS validation and renewal
- AWS DynamoDB on-demand pricing and schema design

**OpenNext Official:**
- opennext.js.org/aws — Architecture, inner workings, FAQ
- github.com/opennextjs/opennextjs-aws — Active commits Jan 2026

**SST Documentation:**
- sst.dev/docs/start/aws/nextjs/ — Next.js deployment with SST Ion
- SST v3 Ion architecture (Pulumi/Terraform-based, not CloudFormation)

**Next.js Official:**
- nextjs.org/blog/next-15 — Next.js 15 features (App Router, Server Actions)
- Next.js ISR documentation

### Secondary (MEDIUM confidence)

**Production Experience Articles (2025-2026):**
- "A Fully Serverless approach for Next.js in AWS" (Medium, Jan 2026) — OpenNext + SST patterns
- "Next.js Deployment on AWS Lambda, ECS, Amplify, and Vercel: What I Learned" (DEV, 2026) — Lambda size limits, NODE_ENV pitfall
- "Let Your AWS Lambdas Survive Thousands of Connections" (Neon blog, 2025) — RDS Proxy pattern
- "Scalable Multi-Tenant Architecture for Hundreds of Custom Domains" (DEV, 2025) — CloudFront certificate quota strategies

**Platform Comparisons:**
- "Deploying Full-Stack Apps in 2026: Vercel, Netlify, Railway, and Cloud Options" (Nucamp) — Feature comparison
- Railway vs Vercel official comparison (docs.railway.com) — Pricing models, integrated database concerns
- "Best Next.js Hosting Providers 2026" (MakerKit) — Feature analysis

**AWS Service Announcements:**
- "Reduce Operational Overhead with Amazon CloudFront SaaS Manager" (AWS blog, 2025) — Multi-tenant distribution management
- "Node.js 24 runtime now available in AWS Lambda" (AWS Compute blog, Nov 2025) — Runtime lifecycle
- "AWS Databases are now available on v0 by Vercel" (AWS announcement, Jan 2026) — DynamoDB + Next.js

### Tertiary (LOW confidence, needs validation)

**Cost Projections:**
- Estimated $840/month for 50 sites based on AWS pricing calculator — needs validation with real-world usage patterns

**Build Duration Estimates:**
- 3-minute average build time assumption — needs measurement with real Next.js apps in Phase 2

**Lambda Cold Start Performance:**
- 200ms-3s cold start range from community reports — needs measurement in staging with Next.js 15 + OpenNext v3

**OpenNext Next.js 15 Full Compatibility:**
- GitHub activity shows active development, but comprehensive feature compatibility matrix not published — needs verification in Phase 2

---

*Research completed: 2026-02-01*
*Ready for roadmap: Yes*
