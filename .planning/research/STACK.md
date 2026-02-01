# Technology Stack - Anchor Deploy

**Project:** Anchor Deploy - Self-hosted serverless Next.js deployment platform
**Researched:** 2026-02-01
**Region:** AWS ap-southeast-1 (Singapore)

## Executive Summary

The standard 2026 stack for building a serverless Next.js deployment platform on AWS centers around **OpenNext v3** as the core adapter, paired with either **SST Ion (v3)** or **AWS CDK** for infrastructure as code. This combination provides production-ready Next.js 15 support with all modern features (App Router, Server Actions, SSR, ISR) while maintaining cost efficiency through serverless architecture.

Key architectural decision: Choose between SST (faster, opinionated, higher-level) or AWS CDK (more control, AWS-native, steeper learning curve). Both use OpenNext under the hood and are production-ready.

## Recommended Stack

### Core Framework & Runtime

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **Next.js** | 15.x | Application framework | Industry standard, fully supported by OpenNext v3. All client sites use Next.js. Supports App Router, Server Actions, API routes, SSR, ISR. | HIGH |
| **Node.js** | 22.x | Lambda runtime | Node.js 22 LTS (supported until April 2027). Node.js 20 reaches EOL April 30, 2026. Node.js 24 is available but Node.js 22 provides better ecosystem stability for 2026. | HIGH |
| **TypeScript** | 5.5+ | Type safety | Required by Zod, standard across modern Next.js projects. Type safety critical for multi-site platform. | HIGH |
| **React** | 19.x | UI framework | Ships with Next.js 15, includes Server Components and Server Actions. | HIGH |

### Next.js Deployment Adapter

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **OpenNext** | 3.x | Next.js → AWS adapter | The standard adapter for Next.js on AWS. Reverse-engineers Next.js build output into AWS primitives (Lambda, S3). Supports all Next.js 15 features. Maintained by SST team. Actively updated (commits in Jan 2026). | HIGH |

### Infrastructure as Code (Choose One)

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **SST Ion** | v3 (Ion) | IaC + deployment orchestration | **RECOMMENDED for this project**. Built on Pulumi/Terraform (not CloudFormation). Highest-level abstraction. Single `sst.config.ts` file. Built-in dev mode (`sst dev`). Automatic OpenNext integration. Handles CloudFront, Lambda, S3, domain config automatically. Best for fast iteration and deployment platform use case. | HIGH |
| **AWS CDK** | 2.x + cdk-nextjs | IaC (alternative) | More control, AWS-native, steeper learning curve. Use if you need deep AWS customization or already have CDK expertise. `cdklabs/cdk-nextjs` is experimental but actively maintained (commits in 2026). Supports NextjsGlobalFunctions, NextjsRegionalFunctions, etc. | MEDIUM |

**Recommendation:** Use **SST Ion** for this project. SST is purpose-built for serverless full-stack apps, has excellent Next.js integration, and will accelerate development of the deployment platform itself. AWS CDK is overkill for a deployment platform focused on Next.js.

### AWS Compute & Distribution

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **AWS Lambda** | Node.js 22 runtime | Serverless compute | Regional Lambda functions for SSR/API routes. More cost-efficient than Lambda@Edge for Singapore-focused traffic. 15-minute timeout (vs 30s for Lambda@Edge). No 1MB response size limit. | HIGH |
| **CloudFront** | N/A | Global CDN | Caches static assets and SSR responses at edge. Required for custom domains with SSL. Auto-configured by SST/OpenNext. | HIGH |
| **AWS S3** | N/A | Static asset storage | Stores `_next/static/*` files, ISR/SSG pages. Integrated with CloudFront. Cache headers: 1 year for hashed assets, no-cache for HTML. | HIGH |

**Why NOT Lambda@Edge:** Lambda@Edge has 1MB response size limit, 30s timeout, and higher complexity. For a Singapore-region platform, regional Lambda + CloudFront is simpler and more cost-effective.

### Database & State

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **DynamoDB** | N/A | Application database | Serverless, pay-per-request pricing. Perfect for deployment metadata, site configs, build logs. Single-digit ms latency. Auto-scales from 3 to 50+ sites. AWS announced enhanced Vercel integration Jan 2026. SST has first-class DynamoDB support. | HIGH |
| **S3** | N/A | Build artifact storage | Store build outputs, deployment snapshots, raw logs. Lifecycle policies for cost management. | HIGH |

**Alternative considered:** Aurora Serverless - Rejected due to higher cost for this use case. DynamoDB's key-value model fits deployment metadata well (site configs, build records, deployment history).

### Build & Deployment Orchestration

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **AWS CodeBuild** | N/A | Build service | Fully managed, pay-per-build-minute. Runs Next.js builds in isolated containers. Supports custom buildspec.yml. Faster and more flexible than custom EC2-based builders. 2026 improvements: GitHub App integration (faster, more reliable than OAuth). | HIGH |
| **AWS SQS** | N/A | Build queue | Decouples GitHub webhooks from builds. Enables build retries, handles burst traffic. Lambda processes queue → triggers CodeBuild. Standard queue sufficient (FIFO not needed for deployments). | HIGH |
| **GitHub Webhooks** | N/A | Trigger deployments | Push events on main branch. Delivered via API Gateway → Lambda → SQS → CodeBuild. | HIGH |

**Build Flow:** GitHub push → Webhook → API Gateway → Lambda (webhook handler) → SQS → Lambda (build orchestrator) → CodeBuild → S3 (artifacts) → Lambda (deploy to CloudFront/S3)

### API & Backend Framework (Dashboard Backend)

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **Next.js API Routes** | 15.x | Dashboard API | Leverage Next.js for dashboard backend. Simpler than separate API framework. API routes run in Lambda via OpenNext. Server Actions for mutations. | HIGH |
| **Zod** | 3.x | Runtime validation | TypeScript-first schema validation. Validate webhook payloads, API inputs, deployment configs. Widely adopted in Next.js ecosystem 2026. Works with Server Actions and API routes. | HIGH |

**Alternative considered:** tRPC - Excellent for type-safe APIs, but adds complexity. Not needed for internal dashboard. Next.js Server Actions + Zod provide sufficient type safety for this use case.

### SSL & Domain Management

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **AWS Certificate Manager (ACM)** | N/A | SSL certificates | Free SSL certificates. Automatic renewal (13-month validity, renews at 11 months). DNS validation recommended. **Regional requirement:** Certificates for CloudFront must be in us-east-1; regional custom domains use same region as API. Supports wildcards (*.example.com). | HIGH |
| **Route 53** (optional) | N/A | DNS management | Use if managing client domains in AWS. Not required if clients use external DNS (just CNAME to CloudFront). | MEDIUM |

### Observability & Monitoring

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **CloudWatch Logs** | N/A | Centralized logging | Automatic log collection from Lambda functions. SST auto-provisions Log Groups per function. Use Logs Insights for querying. Retention policies for cost control. | HIGH |
| **CloudWatch Metrics** | N/A | Performance metrics | Lambda invocations, duration, errors. API Gateway request counts. CodeBuild success/failure rates. Custom metrics for deployment tracking. | HIGH |
| **AWS X-Ray** (optional) | N/A | Distributed tracing | Enable for Lambda functions to trace request latency and performance bottlenecks. Not critical for v1, add if performance issues arise. | MEDIUM |

**Note:** SST automatically treats Next.js logs as standard AWS infrastructure data, enabling CloudWatch Console filtering and Logs Insights analysis.

### Dashboard UI Framework

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **Next.js** | 15.x | Dashboard framework | Self-hosted on same platform as client sites. App Router for layouts, Server Actions for mutations, React Server Components. | HIGH |
| **Tailwind CSS** | 4.x | Styling | Industry standard for utility-first CSS. Fast development. Multiple free admin dashboard templates available (TailAdmin, Horizon UI). | HIGH |
| **shadcn/ui** | Latest | UI components | Copy-paste component library built on Radix UI + Tailwind. Type-safe, accessible, customizable. Popular choice for Next.js 15 dashboards 2026. | MEDIUM |
| **React Hook Form** | 7.x | Form management | Client-side form state. Integrates with Zod for validation. Minimal re-renders. | HIGH |

**Dashboard template starting point:** Use TailAdmin Next.js (free, open-source, Next.js 14+, TypeScript, Tailwind) or build custom with shadcn/ui.

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **AWS SDK v3** | Latest | AWS service clients | Interact with DynamoDB, S3, CodeBuild from Lambda functions. Tree-shakeable for smaller bundles. | HIGH |
| **Octokit** | Latest | GitHub API client | Create GitHub App, handle OAuth, verify webhook signatures. TypeScript-first. | HIGH |
| **date-fns** | 3.x | Date utilities | Format deployment timestamps, calculate build durations. Lighter than Moment.js. | MEDIUM |
| **nanoid** | 5.x | ID generation | Generate deployment IDs, build IDs. Cryptographically strong, URL-safe. Lighter than UUID. | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not | Confidence |
|----------|-------------|-------------|---------|------------|
| **Deployment Adapter** | OpenNext v3 | Serverless Next.js Component | Serverless Next.js Component is deprecated/stale (uses Lambda@Edge, Beta Serverless Components). OpenNext is actively maintained, modern, and SST-backed. | HIGH |
| **Deployment Adapter** | OpenNext v3 | AWS Amplify | Amplify is managed service, not self-hosted. Locked into Amplify ecosystem. Cannot build multi-tenant platform. | HIGH |
| **IaC** | SST Ion | Serverless Framework | Serverless Framework uses CloudFormation (slower deploys). SST Ion uses Pulumi/Terraform (faster). SST has better Next.js integration via OpenNext. | HIGH |
| **IaC** | SST Ion | Terraform alone | Raw Terraform requires manual OpenNext integration. SST provides batteries-included Next.js deployment. Use raw Terraform only if you need multi-cloud. | MEDIUM |
| **Compute** | Regional Lambda | Lambda@Edge | Lambda@Edge: 1MB response limit, 30s timeout, higher complexity, harder debugging. Regional Lambda: no size limit, 15min timeout, simpler, cheaper for Singapore-only traffic. | HIGH |
| **Compute** | Regional Lambda | ECS Fargate | ECS Fargate always-on cost defeats serverless efficiency. Lambda scales to zero. For 50 sites, Lambda is more cost-efficient. | HIGH |
| **Database** | DynamoDB | Aurora Serverless v2 | Aurora Serverless has minimum capacity units, higher cost. DynamoDB pay-per-request is cheaper for low-traffic deployment metadata. | HIGH |
| **Database** | DynamoDB | RDS (PostgreSQL) | RDS requires always-on instance. Not serverless. Over-engineered for deployment metadata. | HIGH |
| **Build Service** | CodeBuild | Custom EC2 + Docker | CodeBuild is fully managed, no server management, pay-per-build-minute. Custom EC2 requires maintenance, higher baseline cost. | HIGH |
| **API Framework** | Next.js API Routes | tRPC | tRPC adds complexity for internal-only API. Next.js Server Actions + Zod provide sufficient type safety. Use tRPC if you need external API consumers. | MEDIUM |
| **API Gateway** | HTTP API | REST API | HTTP APIs are 70% cheaper, 60% lower latency than REST APIs. REST API features (API keys, usage plans) not needed for internal platform. | HIGH |

## Installation & Setup

### Package Dependencies

```bash
# Core SST + Next.js
npm install sst@latest next@latest react@latest react-dom@latest

# TypeScript
npm install -D typescript @types/node @types/react @types/react-dom

# Validation
npm install zod

# AWS SDK (for Lambda functions)
npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-s3 @aws-sdk/client-codebuild

# GitHub integration
npm install octokit

# Dashboard UI
npm install tailwindcss postcss autoprefixer
npm install @radix-ui/react-* # shadcn/ui dependencies
npm install react-hook-form @hookform/resolvers

# Utilities
npm install date-fns nanoid

# Dev dependencies
npm install -D @types/aws-lambda
```

### AWS CLI Configuration

```bash
# Verify AWS credentials for ap-southeast-1
aws configure list
aws sts get-caller-identity

# Ensure Singapore region is default
export AWS_REGION=ap-southeast-1
```

### SST Project Initialization

```bash
# Initialize SST project (Ion/v3)
npx create-sst@latest

# Choose "Next.js" template
# SST will auto-configure:
# - sst.config.ts (infrastructure definition)
# - OpenNext integration
# - CloudFront distribution
# - S3 buckets
# - Lambda functions
```

## Architecture Pattern (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Repository (Client Next.js Site)                     │
│ Push to main → Webhook                                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ API Gateway (HTTP API) → Lambda (Webhook Handler)           │
│ - Verify GitHub signature                                   │
│ - Enqueue build job to SQS                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ SQS Queue → Lambda (Build Orchestrator)                     │
│ - Dequeue build job                                         │
│ - Trigger CodeBuild project                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ CodeBuild                                                    │
│ - Clone repo, npm install, next build (standalone)          │
│ - Run OpenNext adapter                                      │
│ - Upload artifacts to S3                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Lambda (Deploy Handler)                                      │
│ - Deploy static assets to S3                                │
│ - Update Lambda function code (SSR handler)                 │
│ - Invalidate CloudFront cache                               │
│ - Update DynamoDB deployment record                         │
└─────────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Client Site (Live)                                           │
│ - CloudFront (CDN)                                          │
│ - S3 (static assets: _next/*, images)                       │
│ - Lambda (SSR pages, API routes)                            │
│ - ACM SSL certificate                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Dashboard (Next.js App)                                      │
│ - View all sites, deployments, logs                         │
│ - Configure domains, environment variables                   │
│ - Deployed using same stack (SST + OpenNext)                │
│ - Reads from DynamoDB, CloudWatch Logs API                  │
└─────────────────────────────────────────────────────────────┘
```

## Regional Considerations for Singapore (ap-southeast-1)

1. **ACM Certificates:** Create CloudFront certificates in us-east-1 (global requirement). Regional API Gateway certificates in ap-southeast-1.

2. **Lambda Functions:** Deploy SSR/API route handlers in ap-southeast-1 (closest to Cambodia users).

3. **DynamoDB:** Single-region table in ap-southeast-1 (no global tables needed for v1).

4. **CodeBuild:** Run builds in ap-southeast-1 (same region as artifact storage).

5. **CloudFront:** Global CDN (automatically distributed) - edges in Singapore and nearby regions.

## Cost Optimization Strategy

For scaling from 3 to 50+ sites cost-efficiently:

1. **Lambda:** Pay only for execution time. Cold starts acceptable for low-traffic sites. Use provisioned concurrency only for high-traffic sites.

2. **DynamoDB:** On-demand pricing. No pre-allocated capacity. Scales automatically.

3. **S3:** Lifecycle policies to transition old build artifacts to S3 Glacier after 90 days. Delete after 1 year.

4. **CloudFront:** Free tier: 1TB data transfer/month. Shared across all sites. Caching reduces origin requests.

5. **CodeBuild:** Pay per build minute. Optimize Dockerfile/buildspec for faster builds. Reuse npm cache via S3.

6. **CloudWatch Logs:** Retention policies. Keep deployment logs for 30 days, error logs for 90 days.

**Expected monthly cost (50 sites, low-medium traffic):** $50-150 USD. Dominated by Lambda invocations and data transfer.

## Version Verification Strategy

**HIGH confidence items:** Verified via official AWS docs, SST docs, OpenNext docs, npm (Jan 2026).

**MEDIUM confidence items:** Verified via web search with 2026-dated articles, multiple sources agreeing.

**LOW confidence items:** None in this stack - all core decisions backed by HIGH or MEDIUM sources.

## Confidence Assessment

| Technology | Confidence | Source |
|------------|------------|--------|
| OpenNext v3 | HIGH | Official docs (opennext.js.org), GitHub (active Jan 2026), Medium articles (Jan 2026) |
| SST Ion | HIGH | Official docs (sst.dev), Medium articles (Jan 2026), GitHub activity |
| Next.js 15 | HIGH | Official Next.js blog, docs, npm |
| Node.js 22 LTS | HIGH | AWS Lambda runtime docs, official AWS blog (Node.js 24 announcement Nov 2025) |
| AWS Lambda (regional) | HIGH | AWS docs, multiple 2025-2026 deployment guides |
| DynamoDB | HIGH | AWS announcement (Vercel integration Jan 2026), AWS docs |
| CodeBuild | HIGH | AWS docs, 2026 CI/CD guide (KodeKloud) |
| Zod | HIGH | Official docs (zod.dev), Next.js docs, npm |
| AWS ACM | HIGH | AWS docs (official) |
| CloudWatch | HIGH | AWS docs, SST logging documentation |
| Tailwind CSS | HIGH | Widely adopted, 2026 dashboard templates |
| shadcn/ui | MEDIUM | Popular in 2026 but rapidly evolving ecosystem |
| AWS CDK | MEDIUM | cdklabs/cdk-nextjs is experimental, actively maintained |
| X-Ray | MEDIUM | Optional, not critical for v1 |

## Sources

### Core Infrastructure
- [A Fully Serverless approach for Next.js in AWS (Jan 2026)](https://medium.com/@nadun1indunil/a-fully-serverless-approach-for-next-js-in-aws-6099216b1e20)
- [OpenNext Official Docs](https://opennext.js.org/aws)
- [SST v3 with Next.js and Node.js (Medium)](https://medium.com/@vivekmanavadariya/sst-v3-with-next-js-and-node-js-serverless-made-human-friendly-33b286e4df2a)
- [Next.js on AWS with SST](https://sst.dev/docs/start/aws/nextjs/)
- [GitHub - opennextjs/opennextjs-aws](https://github.com/opennextjs/opennextjs-aws)

### AWS CDK Alternative
- [GitHub - cdklabs/cdk-nextjs](https://github.com/cdklabs/cdk-nextjs)
- [Deploy Next.js using Amplify & AWS CDK](https://medium.com/@redrobotdev/deploy-next-js-using-amplify-aws-cdk-4a4a60497298)

### Lambda & Runtime
- [Node.js 24 runtime now available in AWS Lambda (Nov 2025)](https://aws.amazon.com/blogs/compute/node-js-24-runtime-now-available-in-aws-lambda/)
- [AWS Lambda Runtimes (Official Docs)](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- [AWS Lambda end of support for Node.js 18 extended to March 2026](https://sinovi.uk/articles/aws-lambda-end-of-support-for-nodejs-18)

### Build & Deployment
- [CI/CD Pipeline on AWS in 2026: Step-by-Step Guide (KodeKloud)](https://kodekloud.com/blog/how-to-build-a-ci-cd-pipeline-on-aws-in-2026-step-by-step-guide/)
- [Deploying a Next.js with AWS CodePipeline](https://allthingsserverless.com/post/deploying-nextjs-15-static-s3-codepipeline/)
- [Building Scalable Serverless Applications with AWS SQS and Lambda](https://dev.to/aws-builders/building-scalable-serverless-applications-with-aws-sqs-and-lambda-using-sam-339c)

### Database
- [AWS Databases are now available on v0 by Vercel (Jan 2026)](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-databases-available-vercel-v0/)
- [Using DynamoDB with Next.js](https://egghead.io/courses/using-dynamodb-with-next-js-b40c)

### SSL & Domains
- [AWS Certificate Manager Best Practices](https://docs.aws.amazon.com/acm/latest/userguide/acm-bestpractices.html)
- [Get certificates ready in AWS Certificate Manager](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains-prerequisites.html)

### Observability
- [AWS CloudWatch Guide 2026: Metrics, Logs, Dashboards](https://www.netcomlearning.com/blog/amazon-cloudwatch)

### Next.js 15 & Server Actions
- [Next.js 15 Official Blog](https://nextjs.org/blog/next-15)
- [Next.js 15 Server Actions: Complete Guide (Jan 2026)](https://medium.com/@saad.minhas.codes/next-js-15-server-actions-complete-guide-with-real-examples-2026-6320fbfa01c3)
- [Server Actions vs API Routes in Next.js 15](https://www.wisp.blog/blog/server-actions-vs-api-routes-in-nextjs-15-which-should-i-use)

### Validation & Type Safety
- [Zod Official Docs](https://zod.dev/)
- [Type-Safe Form Validation in Next.js 15: Zod, RHF, & Server Actions](https://www.abstractapi.com/guides/email-validation/type-safe-form-validation-in-next-js-15-with-zod-and-react-hook-form)

### Dashboard Templates
- [21+ Best Next.js Admin Dashboard Templates - 2026](https://nextjstemplates.com/blog/admin-dashboard-templates)
- [15+ Free Next.js Admin Dashboard Template for 2026](https://tailadmin.com/blog/free-nextjs-admin-dashboard)
- [Admin Dashboard With Next.js, TypeScript & Shadcn/ui](https://www.traversymedia.com/blog/nextjs-admin-dashboard-project)

### API Gateway
- [AWS HTTP APIs - Official Guide (Serverless)](https://www.serverless.com/guides/aws-http-apis)
- [Review: API Gateway HTTP APIs - Cheaper and Faster](https://cloudonaut.io/review-api-gateway-http-apis/)

### GitHub Integration
- [GitHub App vs. GitHub OAuth: When to Use Which?](https://www.nango.dev/blog/github-app-vs-github-oauth)
- [Differences between GitHub Apps and OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps)

## What NOT to Use

### Deprecated/Outdated Options

1. **serverless-next.js Component** - Uses Beta Serverless Components (not GA). Future uncertain. Uses Lambda@Edge. OpenNext is the modern replacement.

2. **Lambda@Edge for SSR** - 1MB response limit, 30s timeout, higher cost, harder debugging. Regional Lambda is better for Singapore-focused platform.

3. **Node.js 18/20 runtimes** - Node.js 18 EOL March 9, 2026. Node.js 20 EOL April 30, 2026. Use Node.js 22.

4. **CloudFormation directly** - Too low-level. SST Ion uses Pulumi/Terraform which is faster and more modern.

5. **API Gateway REST API** - 70% more expensive, 60% higher latency than HTTP API for same functionality. No advanced features needed for this use case.

6. **Always-on compute (ECS, EC2)** - Defeats serverless cost efficiency. Lambda scales to zero.

7. **Aurora Serverless for metadata** - Overkill and more expensive than DynamoDB for key-value deployment records.

## Notes on Confidence Levels

- **HIGH:** Verified via official docs, official GitHub repos, or multiple credible 2026-dated sources.
- **MEDIUM:** Verified via web search with reputable sources (Medium articles from 2025-2026, established blogs) or emerging/experimental but actively maintained libraries.
- **LOW:** None in this stack document - all critical technologies have HIGH confidence backing.

## Migration Path for Future Versions

- **Next.js 16+:** OpenNext aims to track latest Next.js versions. Monitor OpenNext GitHub for compatibility.
- **Node.js 24:** If ecosystem matures, migrate Lambda runtime. Check AWS announcement timing.
- **React 20+:** Will ship with Next.js updates automatically.
- **SST Ion updates:** Follow SST release notes. Breaking changes expected during Ion maturity.

---

**Last updated:** 2026-02-01
**Next review:** When Next.js 16 releases or Node.js 24 becomes LTS
