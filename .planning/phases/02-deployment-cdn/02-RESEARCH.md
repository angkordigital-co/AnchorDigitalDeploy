# Phase 02: Deployment & CDN - Research

**Researched:** 2026-02-01
**Domain:** Next.js serverless deployment on AWS (Lambda, CloudFront, S3, ACM)
**Confidence:** HIGH

## Summary

Phase 2 deploys Next.js applications to AWS Lambda with CloudFront CDN and custom domain support. The established stack uses **OpenNext** as the build adapter and **SST** as the infrastructure orchestrator. OpenNext transforms Next.js standalone builds into Lambda-compatible packages, splitting the application into server functions (Lambda), static assets (S3), image optimization (Lambda), and revalidation handlers (SQS + Lambda). SST automates the infrastructure provisioning, including CloudFront distributions, ACM certificates, and Route53 DNS.

Zero-downtime deployments are achieved through **CloudFront origin updates** combined with **Lambda versioning**. Each deployment creates a new Lambda version with an immutable ARN, and CloudFront can switch origins instantly. Rollback is accomplished by reverting the CloudFront origin to the previous Lambda version ARN. ISR caching uses **S3 by default** with DynamoDB for tag-based revalidation, offering the best cost/complexity tradeoff for production-only deployments.

Custom domains require ACM certificates in **us-east-1** (CloudFront requirement), and AWS supports 2,500 certificates per account with up to 100 domain names per certificate (quota increase required beyond 10 domains).

**Primary recommendation:** Use SST's Nextjs component with OpenNext v3.x for automated infrastructure management. Configure S3-based ISR caching (default), implement file versioning for static assets to minimize invalidation costs, and use Lambda versions + CloudFront origin switching for instant rollbacks.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| OpenNext | 3.x | Next.js → Lambda adapter | Official AWS-recommended adapter, supports all Next.js 15 features, actively maintained by SST team |
| SST | 3.x | Infrastructure as Code | Built on Pulumi/Terraform, OpenNext integration, automatic CloudFront/Lambda/S3 provisioning |
| Next.js | 14.2+ / 15.x | Application framework | Standalone output mode, improved cold start performance in v14.2+ |
| Sharp | (included) | Image optimization | OpenNext bundles optimized Lambda version, do not add as separate dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AWS SDK v3 | 3.x | AWS service clients | S3 operations, DynamoDB queries (OpenNext handles internally) |
| aws4fetch | Latest | Lightweight S3 client | For S3-Lite incremental cache (reduces bundle size) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SST | AWS CDK | More control, more complexity; SST automates OpenNext integration |
| SST | Serverless Framework | Legacy approach; serverless-nextjs is archived (Jan 2025) |
| OpenNext | Manual Lambda packaging | Reinventing solved problems; OpenNext handles 20+ edge cases |
| Lambda | ECS/Fargate | Lower cold starts, higher baseline cost; overkill for Next.js SSR |

**Installation:**
```bash
npm install sst@latest
# OpenNext installed automatically by SST
```

**Next.js Configuration:**
```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Required for Lambda deployment
  compress: false,      // AWS handles compression
  // Optional: Reduce bundle size
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',
      '.git/**',
    ],
  },
  experimental: {
    bundlePagesExternals: true, // Reduces cold start by ~30%
  },
};
export default nextConfig;
```

## Architecture Patterns

### Recommended Project Structure
```
.
├── sst.config.ts           # SST infrastructure definition
├── .open-next/             # OpenNext build output (gitignored)
│   ├── server-function/    # Lambda handler + Next server
│   ├── assets/             # Hashed + unhashed static files
│   ├── image-optimization/ # Sharp-based image Lambda
│   ├── revalidation/       # ISR queue processor
│   └── cache/              # ISR/SSG cache data
├── next.config.js          # output: 'standalone' required
└── infrastructure/
    └── deployment.ts       # Deployment construct
```

### Pattern 1: SST Nextjs Component Deployment
**What:** Declarative Next.js infrastructure with automatic CloudFront, Lambda, and S3 setup
**When to use:** All Next.js deployments (SST handles OpenNext automatically)
**Example:**
```typescript
// sst.config.ts
export default {
  config() {
    return {
      name: "vercel-clone",
      region: "ap-southeast-1",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new sst.aws.Nextjs("Site", {
        path: "./user-project",
        environment: {
          DATABASE_URL: process.env.DATABASE_URL,
        },
        // Custom domain with automatic ACM certificate
        domain: {
          name: "example.com",
          redirects: ["www.example.com"],
        },
      });

      return {
        url: site.url,
      };
    });
  },
};
```

### Pattern 2: OpenNext Incremental Cache Configuration
**What:** Configure ISR caching strategy (S3, DynamoDB, multi-tier)
**When to use:** When default S3 cache doesn't meet performance/cost requirements
**Example:**
```typescript
// open-next.config.ts (optional, defaults work for most cases)
import type { OpenNextConfig } from '@opennextjs/aws';

const config: OpenNextConfig = {
  default: {
    override: {
      incrementalCache: 's3', // Default: S3 only
      // Alternatives:
      // 's3-lite' - Lighter S3 client using aws4fetch
      // 'multi-tier-ddb-s3' - DynamoDB + S3 + in-memory LRU
      //   (only eventually consistent, higher cost/complexity)
    },
  },
};
export default config;
```

### Pattern 3: Lambda Versioning for Rollback
**What:** Publish immutable Lambda versions with CloudFront origin switching
**When to use:** Every deployment (enables instant rollback)
**Example:**
```typescript
// SST handles this automatically, but the pattern is:
// 1. Deploy new Lambda version (immutable)
const newVersion = await lambda.publishVersion({
  FunctionName: 'server-function',
  Description: `Deployment ${deploymentId}`,
});

// 2. Update CloudFront origin to new version ARN
await cloudfront.updateDistribution({
  Id: distributionId,
  DistributionConfig: {
    Origins: {
      Items: [{
        Id: 'lambda-origin',
        DomainName: newVersion.FunctionArn,
      }],
    },
  },
});

// 3. Store version ARN in DeploymentsTable for rollback
await dynamodb.putItem({
  TableName: 'DeploymentsTable',
  Item: {
    deploymentId,
    lambdaVersionArn: newVersion.FunctionArn,
    timestamp: Date.now(),
  },
});

// Rollback = CloudFront update to previous ARN (instant)
```

### Pattern 4: File Versioning Over Cache Invalidation
**What:** Use versioned filenames to avoid CloudFront invalidation costs
**When to use:** Static assets that change frequently
**Example:**
```typescript
// OpenNext automatically hashes static assets:
// /static/image.png → /static/image.a3f2b1c.png

// Cache-Control headers (SST sets automatically):
// Hashed files: public,max-age=31536000,immutable
// Unhashed files (HTML): public,max-age=0,must-revalidate
//   OR s-maxage=2,stale-while-revalidate=2592000

// Cost savings:
// - First 1,000 invalidations/month: FREE
// - Additional invalidations: $0.005/path
// - Versioned files: $0 (no invalidation needed)
```

### Anti-Patterns to Avoid
- **Bundling Sharp manually:** OpenNext includes optimized Sharp for Lambda; adding it as dependency increases bundle size and causes conflicts
- **Using $LATEST Lambda ARN:** CloudFront requires versioned ARNs; $LATEST causes InvalidLambdaFunctionAssociation errors
- **Frequent cache invalidations:** Costs add up fast; use file versioning instead (first 1,000 paths free, then $0.005/path)
- **Running middleware and server in separate Lambdas:** Doubles latency; OpenNext bundles middleware into server function
- **ElastiCache for ISR:** Adds $50+/month baseline cost; S3 is pennies for low-medium traffic
- **Certificates outside us-east-1:** CloudFront requires ACM certificates in us-east-1 for viewer HTTPS
- **Hand-rolling OpenNext infrastructure:** SST automates 20+ configuration steps; manual setup error-prone

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Next.js → Lambda packaging | Custom build scripts | OpenNext | Handles standalone mode, middleware, ISR, image optimization, 20+ edge cases documented in Common Issues |
| CloudFront + Lambda wiring | Manual CDK/CloudFormation | SST Nextjs component | Automates origin configuration, cache behaviors, Lambda associations, ACM certificates |
| ISR cache storage | Custom S3 abstraction | OpenNext IncrementalCache | Handles fetch cache, route cache, tag-based revalidation, DynamoDB indexing |
| Image optimization | Custom Sharp Lambda | OpenNext image-optimization function | Pre-configured Sharp for Lambda, proper cache headers, memory optimization |
| SSL certificate provisioning | Manual ACM requests | SST domain config | Automatic DNS validation, certificate attachment, Route53/Cloudflare integration |
| Cache invalidation | Manual invalidation calls | File versioning + OpenNext cache headers | Saves money (first 1,000 free, $0.005/path after), faster deployments |
| Deployment rollback | Custom version management | Lambda versions + CloudFront origin switching | Immutable versions, instant origin updates, no redeployment needed |
| Cold start optimization | Custom warmer functions | OpenNext warmer + bundlePagesExternals | Reduces cold starts by 30%, keeps functions warm automatically |

**Key insight:** Next.js on AWS has 50+ gotchas (NODE_ENV, streaming, ISR revalidation timing, middleware at edge, monorepo tracing). OpenNext solves them all; SST automates the infrastructure. Custom solutions rediscover these problems the hard way.

## Common Pitfalls

### Pitfall 1: Cold Start Latency Exceeding 5 Seconds
**What goes wrong:** Users experience 7+ second page loads on first request, far beyond 200ms threshold
**Why it happens:**
- Large bundle size (Next.js can exceed 250MB Lambda limit)
- Bundling Sharp manually instead of using OpenNext's version
- Not enabling `bundlePagesExternals: true` for Pages Router
- Low Lambda memory allocation (256MB = slow CPU)
**How to avoid:**
- Use Next.js 14.2+ (includes startup performance improvements)
- Set `bundlePagesExternals: true` in experimental flags (reduces cold start ~30%)
- Use `outputFileTracingExcludes` to remove unused dependencies (source maps, unused packages)
- Allocate 512MB+ memory (more memory = more CPU = faster startup)
- Enable OpenNext warmer function
**Warning signs:** CloudWatch logs show >3s INIT duration, large deployment packages, Sentry/monitoring packages in bundle

### Pitfall 2: ACM Certificate in Wrong Region
**What goes wrong:** CloudFront rejects certificate with InvalidViewerCertificate error
**Why it happens:** Created ACM certificate in ap-southeast-1 (application region) instead of us-east-1 (CloudFront requirement)
**How to avoid:**
- **Always request ACM certificates for CloudFront in us-east-1**
- Use SST domain config (handles region automatically)
- If manual: `aws acm request-certificate --region us-east-1`
**Warning signs:** CloudFront distribution creation fails, certificate not appearing in CloudFront certificate dropdown

### Pitfall 3: Static Assets Not Loading (404s for CSS/JS)
**What goes wrong:** HTML loads but CSS, JS, images return 404
**Why it happens:**
- Uploaded Lambda function only, not static assets to S3
- CloudFront cache behavior not configured for `/static/*` and `/_next/*`
- Misunderstanding OpenNext architecture (assets separate from Lambda)
**How to avoid:**
- Understand: OpenNext splits app into `.open-next/assets/` (S3) and `.open-next/server-function/` (Lambda)
- Use SST (handles asset upload + cache behaviors automatically)
- If manual: Upload `.open-next/assets/` to S3, configure CloudFront behaviors for static paths
**Warning signs:** Browser network tab shows 404s for `/_next/static/`, Lambda logs show requests for static files

### Pitfall 4: ISR Stale Content Served for Days
**What goes wrong:** Revalidated page in Next.js but CloudFront serves stale version for up to 2 days
**Why it happens:**
- Manually revalidating Next.js cache (S3 ISR files updated) but not invalidating CloudFront cache
- Next.js Cache-Control header doesn't match CloudFront behavior
- ISR revalidation race condition (lowest revalidate value wins across all fetch calls)
**How to avoid:**
- Use OpenNext's automatic cache handling (corrects stale-while-revalidate headers)
- For on-demand revalidation: invalidate CloudFront after updating S3 ISR cache
- Be aware: First 1,000 invalidation paths/month free, $0.005/path after
- Consider: For high-traffic ISR routes, `stale-while-revalidate >= 5× s-maxage`
**Warning signs:** S3 shows new ISR files but users report old content, CloudFront X-Cache: Hit but content outdated

### Pitfall 5: Hitting ACM Certificate Quota with Custom Domains
**What goes wrong:** Cannot provision SSL for new custom domain, ACM quota exceeded
**Why it happens:**
- Default quota: 10 domain names per certificate, 2,500 certificates per account
- Creating 1 certificate per site instead of using wildcards or multi-domain certificates
- Not requesting quota increase proactively
**How to avoid:**
- **Strategy for 50+ domains:** Use wildcard certificates (`*.sites.example.com`) with subdomain routing
- Alternative: Multi-domain certificates (request quota increase to 100 domains/cert)
- Request quota increases via Service Quotas console **before** hitting limits
- Plan domain architecture early (subdomains vs apex domains)
**Warning signs:** ACM request fails with quota error, approaching 2,500 certificate limit

### Pitfall 6: Deployment Downtime During CloudFront Updates
**What goes wrong:** Site returns 503 errors for 3+ minutes during deployment
**Why it happens:**
- CloudFront distribution update propagates slowly (can take 15-30 minutes)
- Lambda@Edge version deletion before CloudFront updated
- Not using blue/green deployment pattern
**How to avoid:**
- Use Lambda versions (never delete old versions immediately)
- CloudFront continuous deployment feature for canary/blue-green
- Set Lambda version deletion policy to RETAIN
- SST handles this automatically with versioned deployments
**Warning signs:** 503 errors during deployments, Lambda@Edge not found errors, CloudFront shows "In Progress" status

### Pitfall 7: Recursive Lambda Calls Leading to Massive Bills
**What goes wrong:** $4,500+ AWS bill from Lambda calling itself recursively
**Why it happens:**
- Lambda making request to CloudFront URL that routes back to same Lambda
- Image optimization Lambda fetching from origin that triggers itself
- No timeout protection or circuit breaker
**How to avoid:**
- Never make HTTP requests from Lambda to CloudFront URLs that might route back to same Lambda
- Use environment variables to detect Lambda execution context
- Set reasonable Lambda timeouts (10-30s, not 5+ minutes)
- Monitor Lambda concurrent executions in CloudWatch
**Warning signs:** Extremely high Lambda invocation counts, Lambda at max concurrency, escalating costs in billing alerts

### Pitfall 8: NODE_ENV Not Set to Production
**What goes wrong:** Lambda crashes looking for development files that don't exist
**Why it happens:**
- Lambda runtime doesn't set NODE_ENV=production by default
- React tries loading development builds
- Next.js expects dev-only files
**How to avoid:**
- Set `NODE_ENV=production` as Lambda environment variable
- SST sets this automatically
- Verify in Lambda configuration: Environment variables → NODE_ENV=production
**Warning signs:** Lambda errors about missing files, React development warnings in logs, larger bundle size

## Code Examples

Verified patterns from official sources:

### SST Next.js Deployment with Custom Domain
```typescript
// sst.config.ts
// Source: https://sst.dev/docs/component/aws/nextjs/
import { Nextjs } from "sst/aws";

export default {
  config() {
    return {
      name: "vercel-clone",
      region: "ap-southeast-1", // Application region
    };
  },
  stacks(app) {
    app.stack(function Deployment({ stack }) {
      // Nextjs component handles:
      // - OpenNext build
      // - S3 bucket for assets
      // - CloudFront distribution
      // - Lambda functions (server, image optimization, revalidation)
      // - ACM certificate in us-east-1 (automatic)
      // - Route53 alias records (if using Route53)

      const site = new Nextjs("UserSite", {
        path: "./user-next-app",

        // Environment variables for Lambda
        environment: {
          DATABASE_URL: process.env.DATABASE_URL,
          NODE_ENV: "production", // SST sets automatically
        },

        // Custom domain with automatic SSL
        domain: {
          name: "mysite.example.com",
          // Redirects www to apex
          redirects: ["www.mysite.example.com"],

          // For external DNS (not Route53):
          // 1. Create ACM cert in us-east-1 manually
          // 2. Validate via DNS
          // 3. Reference cert ARN here
          // cert: "arn:aws:acm:us-east-1:...",
        },

        // Server function configuration
        server: {
          memory: "512 MB",        // More memory = more CPU = faster cold start
          timeout: "30 seconds",   // CloudFront max is 60s
          runtime: "nodejs20.x",
        },

        // Link to other AWS resources
        link: [database, bucket], // Grants permissions + injects env vars
      });

      return {
        url: site.url,              // CloudFront URL
        customDomain: site.domain,  // Custom domain if configured
      };
    });
  },
};
```

### OpenNext Cache Configuration (Advanced)
```typescript
// open-next.config.ts (optional - defaults work for most cases)
// Source: https://opennext.js.org/aws/config/overrides/incremental_cache
import type { OpenNextConfig } from '@opennextjs/aws';

const config: OpenNextConfig = {
  default: {
    override: {
      // S3 (default): Simplest, lowest cost for low-medium traffic
      // Cost: ~$0.003/route/month GET + ~$0.043/route/month PUT
      incrementalCache: 's3',

      // S3-Lite: Lighter bundle, uses aws4fetch instead of AWS SDK
      // Use when: Bundle size critical
      // incrementalCache: 's3-lite',

      // Multi-tier: DynamoDB + S3 + in-memory LRU
      // Use when: High traffic, need cross-Lambda cache consistency
      // Cost: DynamoDB table + S3 costs
      // Warning: "only eventually consistent", can be slower for low traffic
      // incrementalCache: 'multi-tier-ddb-s3',

      // Automatic CDN invalidation
      // Cost: First 1,000 paths/month free, $0.005/path after
      automaticCdnInvalidation: {
        enabled: true,
        // Wildcard path invalidation (e.g., /blog/*)
        // More efficient than individual paths
      },
    },
  },
};

export default config;
```

### Deployment Version Tracking (DynamoDB)
```typescript
// infrastructure/deployment.ts
// Store Lambda version ARNs for instant rollback
import { DynamoDB } from '@aws-sdk/client-dynamodb';

interface Deployment {
  deploymentId: string;           // DEPLOY-{timestamp}
  projectId: string;
  lambdaServerArn: string;        // arn:aws:lambda:...:function:name:42
  lambdaImageArn: string;
  s3AssetsBucket: string;
  s3AssetsPrefix: string;         // deployments/DEPLOY-123/
  cloudfrontDistributionId: string;
  timestamp: number;
  status: 'active' | 'rolled-back' | 'archived';
}

// On deployment success:
await dynamodb.putItem({
  TableName: 'DeploymentsTable',
  Item: {
    deploymentId: { S: `DEPLOY-${Date.now()}` },
    projectId: { S: projectId },
    lambdaServerArn: { S: newVersionArn },      // Key for rollback
    cloudfrontDistributionId: { S: distId },
    timestamp: { N: Date.now().toString() },
    status: { S: 'active' },
  },
});

// Instant rollback:
async function rollback(projectId: string, targetDeploymentId: string) {
  // 1. Fetch target deployment
  const deployment = await getDeployment(targetDeploymentId);

  // 2. Update CloudFront origin to previous Lambda ARN
  await cloudfront.updateDistribution({
    Id: deployment.cloudfrontDistributionId,
    IfMatch: etag, // From GetDistribution
    DistributionConfig: {
      Origins: {
        Items: [{
          Id: 'lambda-server',
          DomainName: deployment.lambdaServerArn,
        }],
      },
    },
  });

  // 3. Update deployment statuses
  // No Lambda redeployment needed - instant origin switch

  // CloudFront propagation: 5-15 minutes (not instant, but no downtime)
}
```

### Next.js Config for Lambda Optimization
```javascript
// next.config.js
// Source: Multiple (OpenNext docs, Vercel recommendations)
/** @type {import('next').NextConfig} */
const nextConfig = {
  // REQUIRED: Standalone mode for Lambda deployment
  output: 'standalone',

  // AWS handles compression at CloudFront level
  compress: false,

  // Reduce bundle size (exclude unnecessary files from tracing)
  outputFileTracingExcludes: {
    '*': [
      // Source maps (Sentry only removes client maps, not server)
      '**/*.js.map',
      '**/*.mjs.map',
      '**/*.cjs.map',

      // Unused SWC binaries
      'node_modules/@swc/core-linux-x64-gnu',
      'node_modules/@swc/core-linux-x64-musl',

      // Version control
      '.git/**',

      // Other large dependencies not needed at runtime
      'node_modules/@types/**',
    ],
  },

  // Include files not auto-detected by Next.js tracing
  outputFileTracingIncludes: {
    // Example: Include Sentry config
    '/api/**': ['./sentry.server.config.ts'],
  },

  // Experimental: Reduces cold start by ~30% for Pages Router
  experimental: {
    bundlePagesExternals: true,
  },

  // Images: Use Next.js Image Optimization (OpenNext provides Lambda)
  images: {
    domains: ['example.com', 'cdn.example.com'],
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
```

### CloudFront Cache Behavior Configuration
```typescript
// CloudFront cache behaviors for Next.js
// Source: https://opennext.js.org/aws/inner_workings/architecture
// SST handles this automatically, but for reference:

const cacheBehaviors = [
  {
    // Static assets - long-term caching
    PathPattern: '_next/static/*',
    TargetOriginId: 's3-assets',
    ViewerProtocolPolicy: 'redirect-to-https',
    CachePolicyId: 'Managed-CachingOptimized',
    Compress: true,
    // Cache-Control: public,max-age=31536000,immutable
  },
  {
    // Public folder - long-term caching for hashed files
    PathPattern: 'static/*',
    TargetOriginId: 's3-assets',
    ViewerProtocolPolicy: 'redirect-to-https',
    CachePolicyId: 'Managed-CachingOptimized',
  },
  {
    // Image optimization - Lambda function
    PathPattern: '_next/image*',
    TargetOriginId: 'lambda-image-optimization',
    ViewerProtocolPolicy: 'redirect-to-https',
    AllowedMethods: ['GET', 'HEAD', 'OPTIONS'],
    CachePolicyId: 'Managed-CachingOptimized',
  },
  {
    // Default - Server function for SSR/ISR/API routes
    PathPattern: '*',
    TargetOriginId: 'lambda-server',
    ViewerProtocolPolicy: 'redirect-to-https',
    AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'POST', 'PATCH', 'DELETE'],
    // Cache-Control headers from Lambda determine caching
    // ISR: s-maxage=X, stale-while-revalidate=Y
    // SSR: public,max-age=0,must-revalidate
  },
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `target: 'serverless'` in Next.js config | `output: 'standalone'` | Next.js 12+ | Standalone mode creates optimized server bundle with minimal dependencies |
| serverless-nextjs/serverless-next.js | OpenNext + SST | Jan 2025 (archived) | serverless-next.js no longer maintained; OpenNext is official successor |
| Lambda@Edge for SSR | Regional Lambda + CloudFront | 2023+ | Regional Lambda has no 1MB code limit, easier debugging, lower cold starts |
| Manual Lambda packaging | OpenNext adapter | 2022+ | OpenNext handles 50+ edge cases automatically |
| AWS CDK raw constructs | SST Nextjs component | SST v2/v3 | Declarative syntax, automatic OpenNext integration, less boilerplate |
| ElastiCache for ISR | S3 + DynamoDB | 2023+ | S3 costs pennies vs $50+/month ElastiCache baseline; DynamoDB only for tags |
| CloudFront invalidation on every deploy | File versioning | Best practice | First 1,000 invalidations free, but versioning is $0 and faster |
| Single Lambda for all routes | Split server/image/revalidation | OpenNext v2+ | Better performance, separate scaling, smaller bundles |

**Deprecated/outdated:**
- **serverless-nextjs Component**: Archived January 28, 2025; migrate to OpenNext + SST
- **Next.js `target: 'serverless'`**: Deprecated in Next.js 12; use `output: 'standalone'`
- **Lambda@Edge for Next.js SSR**: Still works but regional Lambda preferred (no size limits, easier debugging)
- **Yarn Plug'n'Play with OpenNext**: Causes manifest errors; use npm or yarn classic
- **Manual Sharp installation**: OpenNext includes optimized version; manual install causes conflicts

## Open Questions

Things that couldn't be fully resolved:

1. **ISR cache eviction strategy at scale**
   - What we know: S3 stores ISR files indefinitely; costs ~$0.023/GB/month
   - What's unclear: How to implement TTL-based eviction for old ISR routes (e.g., delete cache files >30 days old)
   - Recommendation: Monitor S3 costs; if >1000 ISR routes, implement S3 Lifecycle Policy to delete files in `.open-next/cache/` older than X days

2. **CloudFront continuous deployment for staging environments**
   - What we know: CloudFront supports blue/green + canary with continuous deployment policies
   - What's unclear: How to integrate with "production-only" v1 scope (preview deployments deferred to v2)
   - Recommendation: Use blue/green for production deployments in v1; evaluate continuous deployment for v2 preview environments

3. **Multi-region Lambda deployment for global latency**
   - What we know: SST supports multi-region via `edge: true` (Lambda@Edge), but adds complexity
   - What's unclear: Whether Cambodia-focused deployment needs multi-region (ap-southeast-1 → Phnom Penh latency acceptable?)
   - Recommendation: Start single-region ap-southeast-1; measure latency from Cambodia; add regions if P95 latency >500ms

4. **ACM certificate quota management at 50+ domains**
   - What we know: 2,500 certs/account, 10 domains/cert default (100 max with quota increase)
   - What's unclear: Best domain architecture (wildcards `*.sites.example.com` vs multi-domain certs vs separate accounts)
   - Recommendation: Plan domain strategy before Phase 2 implementation:
     - Option A: Wildcard cert + subdomain routing (unlimited sites, 1 cert)
     - Option B: Multi-domain certs (request quota increase to 100 domains/cert, max 2,500 certs)
     - Option C: AWS Organizations + multiple accounts (if >2,500 sites planned)

## Sources

### Primary (HIGH confidence)
- OpenNext Official Docs - https://opennext.js.org/aws
  - Architecture: https://opennext.js.org/aws/inner_workings/architecture
  - Caching: https://opennext.js.org/aws/inner_workings/caching
  - ISR: https://opennext.js.org/aws/v2/inner_workings/isr
  - Incremental Cache Config: https://opennext.js.org/aws/config/overrides/incremental_cache
  - Common Issues: https://opennext.js.org/aws/common_issues
- SST Documentation - https://sst.dev/docs/component/aws/nextjs/
- AWS CloudFront Documentation:
  - Alternate Domain Names (CNAMEs): https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/CNAMEs.html
  - SSL/TLS Requirements: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cnames-and-https-requirements.html
  - Cache Invalidation Pricing: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/PayingForInvalidation.html
- AWS ACM Documentation:
  - Certificate Quotas: https://docs.aws.amazon.com/acm/latest/userguide/acm-limits.html

### Secondary (MEDIUM confidence)
- AWS Blog: Zero-downtime deployments with CloudFront blue/green - https://aws.amazon.com/blogs/networking-and-content-delivery/achieving-zero-downtime-deployments-with-amazon-cloudfront-using-blue-green-continuous-deployments/
- AWS Blog: Canary deployments with Lambda alias traffic shifting - https://aws.amazon.com/blogs/compute/implementing-canary-deployments-of-aws-lambda-functions-with-alias-traffic-shifting/
- LogRocket: Using OpenNext to deploy Next.js to AWS Lambda - https://blog.logrocket.com/using-opennext-deploy-next-js-app-aws-lambda/
- Dev.to: Deploying Next.js to AWS Lambda guide (2026) - https://dev-end.com/blog/deploying-nextjs-to-aws-lambda-the-complete-journey
- FreeCodeCamp: Deploy Next.js with custom domain on AWS using SST - https://www.freecodecamp.org/news/how-to-deploy-a-next-js-app-with-custom-domain-on-aws-using-sst/

### Tertiary (LOW confidence - requires validation)
- WebSearch: Next.js cold start optimization strategies (2026) - Wisp CMS blog, GitHub issues
- WebSearch: ISR cache storage comparisons - Community discussions
- WebSearch: CloudFront deployment tagging best practices - nOps, CloudQuery blogs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - OpenNext and SST are officially recommended by AWS and Vercel ecosystem
- Architecture: HIGH - Patterns verified in official OpenNext and SST documentation
- Pitfalls: MEDIUM - Mix of official docs (HIGH) and community reports (MEDIUM); ACM quotas and cold start specifics verified with AWS docs
- ISR caching: MEDIUM - S3 default verified (HIGH), but cost analysis based on OpenNext community discussions (MEDIUM)
- Rollback strategy: MEDIUM - Lambda versioning verified (HIGH), but CloudFront origin switching for instant rollback needs validation in Phase 2 implementation

**Research date:** 2026-02-01
**Valid until:** 2026-04-01 (60 days - OpenNext and SST evolve quickly; Next.js 15.x support ongoing)
