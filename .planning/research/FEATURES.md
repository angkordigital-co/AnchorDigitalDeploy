# Feature Landscape: Serverless Deployment Platforms

**Domain:** Self-hosted serverless deployment platform for Next.js on AWS
**Researched:** 2026-02-01
**Confidence:** HIGH (verified with official platform docs, current 2026 sources)

## Executive Summary

Modern deployment platforms in 2026 compete on three dimensions: developer experience (Git integration, zero-config deployments), production readiness (observability, rollback, security), and cost efficiency (build caching, right-sizing, multi-tenancy). For a self-hosted alternative, **table stakes features determine whether developers even try the platform**, while **differentiators determine whether they stay**.

The competitive landscape shows:
- **Vercel/Netlify**: Premium DX, highest cost, vendor lock-in concerns
- **Railway**: Full-stack focus, database included, unpredictable pricing
- **Coolify/Dokploy**: Self-hosted, full control, requires ops expertise
- **Anchor Deploy opportunity**: Production-ready self-hosted with Vercel-like DX

---

## Table Stakes Features

Features users expect from ANY deployment platform in 2026. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Git Push to Deploy** | Industry standard since Heroku 2010. Users expect `git push` triggers automatic build and deploy. | Medium | GitHub API, webhook infrastructure, build queue | For v1: GitHub only. Must handle concurrent deployments per site. |
| **Automatic SSL/TLS** | Let's Encrypt made this free and expected since 2015. Manual SSL is a dealbreaker. | Medium | Let's Encrypt, DNS validation, auto-renewal logic | Use AWS Certificate Manager or certbot. Must support custom domains, not subdomains. |
| **Build Logs (Real-time)** | Developers need to see build progress and debug failures. No logs = blind deployment. | Low-Medium | WebSocket/SSE for streaming, log storage (S3) | Stream to browser, persist for 30 days. Essential for debugging. |
| **Deployment Logs (Runtime)** | CloudWatch/stdout logs for debugging production issues. | Low | CloudWatch Logs integration, log aggregation | Must include Lambda/container logs. Filter by time/severity. |
| **Environment Variables** | Configuration without code changes. Standard since 12-factor app. | Low | Encrypted storage (AWS Secrets Manager or DB), injection at build/runtime | Must support build-time and runtime vars. Encrypted at rest. |
| **Custom Domains** | Requirement per project brief. Users won't accept `*.anchorapp.io` subdomains for production. | Medium-High | DNS management, CloudFront custom domain config, SSL | Route53 or external DNS. Validate domain ownership. |
| **Deployment History** | View past deployments, when deployed, by whom. Basic audit trail. | Low | Database records with timestamps, Git SHA | 90 day retention minimum. Links to Git commits. |
| **Instant Rollback** | Revert to previous working deployment when new version breaks production. | Medium | Immutable deployments, traffic switching (CloudFront behavior), zero-downtime cutover | Critical for production confidence. Must be <30 second operation. |
| **Next.js Full Support** | SSR, API routes, middleware, ISR must all work. Partial support is not viable. | High | Node.js runtime (Lambda or Fargate), EFS for cache sharing, CloudFront for routing | This is the core product requirement. Cannot compromise. |
| **Zero-Downtime Deploys** | New deployment doesn't cause 503s or dropped requests. | Medium | Blue-green or atomic CloudFront behavior switch | Use CloudFront origin groups or Lambda versioning. |
| **Dashboard (Web UI)** | View deployments, logs, config without CLI. Non-technical stakeholders need this. | Medium-High | React/Next.js frontend, API backend, authentication | Per project brief. Cannot be CLI-only for v1. |
| **Observability (Errors)** | Error tracking, stack traces, error rates. Production without error monitoring is incomplete. | Medium | CloudWatch Insights, error aggregation, source maps | Must handle Next.js server/client errors separately. Integration with Sentry optional. |

**Implementation Priority:** These must ALL be in v1. Missing any = incomplete product that users will abandon.

**Complexity Rating:**
- **Low:** 1-2 weeks for experienced developer
- **Medium:** 2-4 weeks, requires AWS service integration
- **High:** 4-8 weeks, complex multi-service coordination

---

## Differentiators

Features that set platforms apart. Not expected by default, but highly valued when present. These drive retention and word-of-mouth.

| Feature | Value Proposition | Complexity | User Segment | Competitive Analysis |
|---------|-------------------|------------|--------------|----------------------|
| **Cost Transparency** | Show exact AWS costs per site. Self-hosted platforms rarely do this. | Medium | Cost-conscious teams (3-50 sites) | Vercel/Netlify hide infrastructure costs. Railway shows usage but not AWS breakdown. **Opportunity for differentiation.** |
| **Multi-Site Efficiency** | Single Lambda function shared across sites. Dramatically reduces cold starts and costs. | High | Teams managing 10+ sites | Most self-hosted platforms deploy 1 container per app. Shared infrastructure = 10x cost savings at scale. |
| **Build Caching (Aggressive)** | Cache node_modules, .next, shared layers. 5min build → 30sec build. | Medium | All users (saves time and $) | Vercel/Netlify have this. Coolify/Dokploy do not. Cloudflare just added in 2026. **Critical for DX.** |
| **Regional Deployment (AP Southeast)** | Guarantee Singapore region for <50ms latency. | Low | Southeast Asia users | Vercel deploys globally but you can't force region. AWS Singapore = competitive advantage for local traffic. |
| **Preview Deployments (Optional)** | Each PR gets unique URL for testing before merge. | Medium-High | Teams with QA process | **Explicitly deferred in v1** per project brief. But high-value for future. |
| **Deployment Analytics** | Deployment frequency, success rate, MTTR, build time trends (DORA metrics). | Low-Medium | Engineering managers | Most platforms lack DORA metrics. Easy win with CloudWatch + dashboard. |
| **Secrets Scanning** | Block deployments with exposed API keys in code. | Low | Security-conscious teams | Prevents credential leaks. Source: [Best Secrets Management Tools 2026](https://cycode.com/blog/best-secrets-management-tools/) |
| **Automatic Dependency Updates** | Detect outdated dependencies, suggest updates. | Medium | Maintenance-heavy projects | Requires npm/GitHub API integration. Low priority for v1. |

**Strategy:**
- **v1 Must-Have:** Cost transparency, build caching, regional deployment
- **v2 High-Value:** Multi-site efficiency (architectural foundation needed in v1)
- **Future:** Preview deployments, secrets scanning, dependency updates

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain that waste effort or create maintainability nightmares.

| Anti-Feature | Why Avoid | What to Do Instead | Source |
|--------------|-----------|-------------------|--------|
| **Multi-Cloud Support** | Adds 10x complexity for <5% user benefit. AWS-only is acceptable for self-hosted. | Focus on AWS excellence. Document AWS-only clearly. | [AWS Deployment Strategies](https://medium.com/@redrobotdev/next-js-on-aws-a-guide-to-common-deployment-strategies-a583772e7372) |
| **Custom Build Scripts** | Becomes a debugging nightmare. Every framework has edge cases. | Use Next.js built-in build. Add escape hatch (custom Dockerfile) for advanced users only. | [Platform Engineering Anti-Patterns](https://jellyfish.co/library/platform-engineering/anti-patterns/) |
| **Integrated Database** | Database lifecycle ≠ app lifecycle. Coupling them creates data loss risk. | Link to external databases (RDS, MongoDB Atlas). Provide connection guides. | Railway's approach causes vendor lock-in per [Railway vs Vercel comparison](https://docs.railway.com/maturity/compare-to-vercel) |
| **Visual Builder / No-Code UI** | Scope creep. You're building a deployment platform, not a web builder. | Let users build in their IDE. Deploy what they push. | Vercel's success = focus on deployment, not building. |
| **Edge Functions (Custom Runtime)** | Vercel's Edge Runtime has 40+ compatibility issues. Maintaining a custom runtime is a trap. | Use standard Node.js Lambda. 50-100ms cold start is acceptable for v1. | [Edge vs Serverless 2025](https://byteiota.com/edge-functions-vs-serverless-the-2025-performance-battle/) shows Lambda is sufficient. |
| **Team Chat/Communication** | Not a competitive differentiator. Users have Slack/Discord. | Integrate with Slack for deployment notifications. Don't build chat. | [Platform Engineering Anti-Patterns](https://octopus.com/devops/platform-engineering/patterns-anti-patterns/) |
| **Git Provider Abstraction** | Supporting GitHub, GitLab, Bitbucket 3x's integration complexity. | GitHub-only for v1. GitLab in v2 if demand exists. | Project brief specifies GitHub. Vercel started GitHub-only. |
| **Monorepo Support** | Detecting which subdirectory changed, partial builds, shared dependencies = complexity minefield. | Single app per repo for v1. Monorepo = v2 feature if needed. | [DevOps Anti-Patterns](https://alpacked.io/blog/devops-anti-patterns/) warns against premature complexity. |

**Philosophy:** Ship a focused, working product. Avoid "field of dreams" platform engineering where you build features no one requested.

---

## Feature Dependencies

Understanding which features require others prevents architectural mistakes.

```
Foundation Layer (Build First):
├─ GitHub OAuth + Webhook Infrastructure
│  └─ Required by: Git push to deploy, deployment history
│
├─ Build Queue + Worker System
│  └─ Required by: All deployments, build logs, caching
│
├─ Next.js → Lambda/Fargate Packaging
│  └─ Required by: Core deployment functionality
│
└─ CloudFront Distribution per Site
   └─ Required by: Custom domains, SSL, zero-downtime deploys

Deployment Layer (Build Second):
├─ Deployment History Database
│  └─ Required by: Rollback, audit logs, analytics
│
├─ Environment Variables (Encrypted Storage)
│  └─ Required by: Build-time and runtime config
│
└─ CloudWatch Logs Integration
   └─ Required by: Build logs, runtime logs, error tracking

Observability Layer (Build Third):
├─ Real-time Log Streaming (WebSocket/SSE)
│  └─ Required by: Build log viewing in dashboard
│
├─ Error Aggregation
│  └─ Required by: Error monitoring, alerts
│
└─ Deployment Analytics
   └─ Required by: DORA metrics, cost tracking

Advanced Features (v2+):
├─ Preview Deployments
│  └─ Requires: GitHub PR API, ephemeral environments, cost isolation
│
└─ Multi-Site Shared Infrastructure
   └─ Requires: Request routing, cost attribution, resource isolation
```

**Critical Path:** Foundation → Deployment → Observability. Can't skip layers.

---

## MVP Feature Prioritization

For **Anchor Deploy v1** (3-50 sites, self-hosted, production-only):

### Must Ship (v1):
1. Git push to deploy (GitHub only)
2. Automatic SSL for custom domains
3. Build + deployment logs (real-time streaming)
4. Environment variables (encrypted)
5. Next.js full support (SSR, API routes, middleware)
6. Zero-downtime deploys
7. Instant rollback
8. Dashboard (deployments list, logs viewer, settings)
9. Error tracking (CloudWatch integration)
10. Cost transparency per site
11. Build caching (aggressive)

**Rationale:** These 11 features = complete, production-ready platform. Missing any = users can't ship confidently.

### Defer to v2:
- Preview deployments (PR environments)
- Multi-site shared infrastructure optimization
- Team collaboration features (RBAC, comments)
- Deployment approvals / manual triggers
- Advanced analytics (beyond DORA basics)
- Secrets scanning
- Automated dependency updates

**Rationale:** Nice-to-have, but not blockers for initial adoption. Can add based on user feedback.

### Never Build:
- Multi-cloud (AWS, GCP, Azure)
- Custom build scripts
- Integrated databases
- Visual/no-code builder
- Custom edge runtime
- Built-in team chat
- Multi-framework support (focus on Next.js excellence)

---

## Complexity vs. Value Matrix

Helps prioritize which differentiators to build first.

```
High Value, Low Complexity (DO FIRST):
- Cost transparency (CloudWatch + simple math)
- Regional deployment (just configure AWS region)
- Deployment analytics (DORA metrics from existing data)

High Value, High Complexity (DO EVENTUALLY):
- Build caching (complex cache invalidation logic)
- Multi-site efficiency (requires architectural planning)
- Preview deployments (ephemeral infrastructure)

Low Value, Low Complexity (MAYBE):
- Secrets scanning (nice security feature, easy to add)
- Dependency update suggestions (GitHub API integration)

Low Value, High Complexity (AVOID):
- Multi-cloud support
- Custom build scripts
- Edge functions runtime
```

---

## Competitive Positioning

| Feature Category | Vercel | Netlify | Railway | Coolify | Dokploy | **Anchor Deploy** |
|------------------|--------|---------|---------|---------|---------|-------------------|
| **Next.js Support** | ✅ Excellent | ⚠️ Good | ⚠️ Good | ⚠️ Fair | ⚠️ Fair | ✅ Excellent (v1 goal) |
| **Custom Domains** | ✅ Included | ✅ Included | ✅ Included | ✅ Included | ✅ Included | ✅ Included |
| **Auto SSL** | ✅ Free | ✅ Free | ✅ Free | ✅ Free | ✅ Free | ✅ Free |
| **Build Caching** | ✅ Excellent | ✅ Good | ❌ No | ❌ No | ❌ No | ✅ Excellent (v1) |
| **Preview Deploys** | ✅ Included | ✅ Included | ✅ Included | ❌ Manual | ❌ Manual | ❌ v2 |
| **Observability** | ✅ Excellent | ⚠️ Good | ⚠️ Basic | ❌ Minimal | ❌ Minimal | ✅ Good (v1) |
| **Self-Hosted** | ❌ No | ❌ No | ❌ No | ✅ Yes | ✅ Yes | ✅ Yes |
| **Cost Transparency** | ❌ Opaque | ❌ Opaque | ⚠️ Usage shown | ❌ DIY | ❌ DIY | ✅ **Per-site AWS costs** |
| **Regional Control** | ❌ Global only | ❌ Global only | ⚠️ Limited | ✅ You choose | ✅ You choose | ✅ **AWS Singapore** |
| **Pricing Model** | $20/user + overages | $19/member + overages | Usage-based (unpredictable) | VPS cost only | VPS cost only | AWS cost only |

**Positioning:** "Production-ready self-hosted Next.js deployment for AWS. Vercel DX without vendor lock-in."

---

## Sources

### Platform Comparisons
- [Vercel vs Netlify vs Railway 2026](https://www.nucamp.co/blog/deploying-full-stack-apps-in-2026-vercel-netlify-railway-and-cloud-options)
- [Railway vs Vercel Official Comparison](https://docs.railway.com/maturity/compare-to-vercel)
- [Next.js Hosting Providers 2026](https://makerkit.dev/blog/tutorials/best-hosting-nextjs)

### Feature Analysis
- [Platform Engineering Tools 2026](https://platformengineering.org/blog/platform-engineering-tools-2026)
- [Deployment Platform Requirements](https://northflank.com/blog/best-cloud-app-deployment-platforms)
- [Next.js Deployment Requirements](https://render.com/articles/how-to-deploy-next-js-applications-with-ssr-and-api-routes)

### Observability & Monitoring
- [Observability Tools 2026](https://platformengineering.org/blog/10-observability-tools-platform-engineers-should-evaluate-in-2026)
- [DevOps Metrics 2026](https://middleware.io/blog/devops-metrics-you-should-be-monitoring/)
- [Observability Best Practices](https://spacelift.io/blog/observability-best-practices)

### Security & Secrets
- [Secrets Management Tools 2026](https://cycode.com/blog/best-secrets-management-tools/)
- [Environment Variables Safety](https://securityboulevard.com/2025/12/are-environment-variables-still-safe-for-secrets-in-2026/)

### Deployment Strategies
- [Zero-Downtime Deployments](https://developer.hashicorp.com/well-architected-framework/define-and-automate-processes/deploy/zero-downtime-deployments)
- [Blue-Green vs Canary](https://circleci.com/blog/canary-vs-blue-green-downtime/)
- [Next.js on AWS Deployment Strategies](https://medium.com/@redrobotdev/next-js-on-aws-a-guide-to-common-deployment-strategies-a583772e7372)

### Build Performance
- [Build Caching Overview](https://docs.gradle.org/current/userguide/gradle_optimizations.html)
- [Cloudflare Build Caching](https://blog.cloudflare.com/race-ahead-with-build-caching/)
- [Spring Boot CI/CD Performance](https://medium.com/@himanshu675/spring-boot-ci-cd-is-broken-can-remote-caching-and-incremental-builds-fix-the-mess-dba4549b9e6d)

### Anti-Patterns
- [DevOps Anti-Patterns](https://alpacked.io/blog/devops-anti-patterns/)
- [Platform Engineering Anti-Patterns](https://jellyfish.co/library/platform-engineering/anti-patterns/)
- [Deployment Anti-Patterns AWS](https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/anti-patterns-for-advanced-deployment-strategies.html)

### Self-Hosted Alternatives
- [Coolify GitHub](https://github.com/coollabsio/coolify)
- [Dokploy GitHub](https://github.com/Dokploy/dokploy)
- [Coolify Alternatives 2026](https://northflank.com/blog/coolify-alternatives-in-2026)
- [Vercel Alternatives](https://openalternative.co/alternatives/vercel)

### Official Platform Documentation
- [Vercel Documentation](https://vercel.com/docs)
- [Netlify Documentation](https://docs.netlify.com)
- [Railway Documentation](https://docs.railway.com)

### AWS & Infrastructure
- [Next.js on AWS Lambda Guide](https://dev-end.com/blog/deploying-nextjs-to-aws-lambda-the-complete-journey)
- [SST (Serverless Stack Toolkit)](https://sst.dev/docs/start/aws/nextjs/)
- [CDK Next.js](https://github.com/cdklabs/cdk-nextjs)

---

## Research Quality Assessment

| Area | Confidence Level | Verification Method |
|------|------------------|-------------------|
| Table Stakes Features | **HIGH** | Official Vercel/Netlify/Railway docs + 2026 comparison articles |
| Next.js Deployment Requirements | **HIGH** | Official Next.js docs + AWS deployment guides |
| Complexity Estimates | **MEDIUM** | Based on AWS service complexity, adjusted for team experience |
| Competitive Positioning | **HIGH** | Multiple comparison sources + direct platform documentation |
| Anti-Features | **MEDIUM** | DevOps anti-pattern research + platform engineering best practices |
| Cost Transparency Value | **MEDIUM** | Inferred from user complaints in comparison articles (not quantified) |

**Gaps:**
- No direct user interviews with Vercel/Railway users about pain points
- Cost modeling examples would strengthen business case
- Preview deployment implementation complexity needs deeper technical research

**Next Steps:**
- Validate complexity estimates with AWS architect
- Confirm table stakes priority with potential users (if available)
- Investigate SST vs CDK for Next.js deployment architecture
