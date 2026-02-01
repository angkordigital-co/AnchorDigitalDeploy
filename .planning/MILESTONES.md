# Project Milestones: Anchor Deploy

## v1.0 MVP (Shipped: 2026-02-02)

**Delivered:** Self-hosted serverless deployment platform for Next.js applications on AWS, with automatic GitHub-triggered builds, zero-downtime Lambda deployments, and a full management dashboard.

**Phases completed:** 1-3 (11 plans total)

**Key accomplishments:**

- Automated build pipeline: GitHub push triggers SQS → CodeBuild → OpenNext packaging → S3 artifacts
- Zero-downtime deployment: Lambda alias routing with instant rollback (<1s via alias switch)
- CloudFront CDN: Static assets cached at edge, SSR via Lambda with Function URLs
- Custom domains: ACM certificate provisioning with automatic CloudFront integration
- Full dashboard: Auth, sites list, deployments, env vars, domains, logs, metrics, costs
- Observability: CloudWatch Logs, Lambda metrics (p50/p95/p99), AWS Cost Explorer breakdown

**Stats:**

- 141 files created/modified
- 33,723 lines of TypeScript
- 3 phases, 11 plans, ~86 tasks
- 1 day from start to ship (2026-02-01 → 2026-02-02)

**Git range:** first commit → `6e86df6`

**What's next:** Preview deployments for branches, team collaboration features, or multi-region support

---
