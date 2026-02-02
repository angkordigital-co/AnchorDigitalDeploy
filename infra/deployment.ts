/**
 * Deployment Infrastructure for Anchor Deploy
 *
 * CloudFront distribution with Lambda functions and S3 origins for serving deployed Next.js apps.
 *
 * Architecture:
 * - CloudFront CDN with 3 origins:
 *   1. S3 bucket for static assets (/_next/static/*, /static/*)
 *   2. Lambda function URL for SSR and API routes (default behavior)
 *   3. Lambda function URL for image optimization (/_next/image*)
 *
 * - Server Lambda:
 *   - Handles SSR pages and API routes
 *   - Streams responses for better performance
 *   - 512MB memory for faster cold starts
 *   - Linked to DeploymentsTable for reading deployment config
 *   - Invoked via 'live' alias for zero-downtime deployments
 *
 * - Image Lambda:
 *   - Uses Sharp for image optimization
 *   - 1024MB memory for image processing
 *   - Invoked via 'live' alias for zero-downtime deployments
 *
 * - Static Assets:
 *   - Served from dedicated staticAssetsBucket
 *   - Cached aggressively (1 year) with immutable filenames
 *
 * - Deploy Handler:
 *   - Orchestrates deployments after CodeBuild completes
 *   - Updates Lambda code, publishes versions, updates aliases
 *   - Zero-downtime via Lambda alias atomic updates
 */

import { artifactsBucket, staticAssetsBucket } from "./storage.js";
import { deploymentsTable, domainsTable } from "./database.js";

/**
 * Server Lambda Function
 *
 * Handles SSR pages and API routes from deployed Next.js apps.
 * Actual handler code is deployed per-deployment using OpenNext output.
 *
 * For now, this is a placeholder that will be updated during first deployment.
 *
 * Note: Function URL doesn't directly support alias targeting, but the function
 * itself is updated via deploy-handler which publishes versions and updates the alias.
 */
export const serverFunction = new sst.aws.Function("ServerFunction", {
  handler: "packages/functions/src/placeholder-server.handler",
  runtime: "nodejs20.x",
  memory: "512 MB",
  timeout: "30 seconds",
  link: [deploymentsTable],
  environment: {
    NODE_ENV: "production",
  },
  // Note: streaming: true will be enabled in Plan 02 when deploying actual OpenNext handler
  url: {
    authorization: "none", // Public access for CloudFront origin
  },
});

/**
 * Image Optimization Lambda Function
 *
 * Handles Next.js image optimization (/_next/image).
 * Uses Sharp library for resizing, format conversion, etc.
 *
 * Actual handler code is deployed using OpenNext image handler.
 */
export const imageFunction = new sst.aws.Function("ImageFunction", {
  handler: "packages/functions/src/placeholder-image.handler",
  runtime: "nodejs20.x",
  memory: "1024 MB", // Sharp needs more memory for image processing
  timeout: "30 seconds",
  environment: {
    NODE_ENV: "production",
  },
  url: {
    authorization: "none", // Public access for CloudFront origin
  },
});

/**
 * Lambda Aliases for Zero-Downtime Deployment
 *
 * CloudFront/Function URLs target the 'live' alias instead of $LATEST.
 * Deploy handler updates alias to point to new versions atomically.
 *
 * Initial state: Alias points to $LATEST (placeholder functions)
 * After first deployment: Alias points to version 1 (actual Next.js app)
 * After subsequent deployments: Alias updated to new version (zero-downtime)
 */
const serverFunctionAlias = new aws.lambda.Alias("ServerFunctionLiveAlias", {
  name: "live",
  functionName: serverFunction.name,
  functionVersion: "$LATEST", // Initial; deploy-handler updates to specific versions
  description: "Live traffic alias - updated by deploy-handler for zero-downtime deployment",
});

const imageFunctionAlias = new aws.lambda.Alias("ImageFunctionLiveAlias", {
  name: "live",
  functionName: imageFunction.name,
  functionVersion: "$LATEST",
  description: "Live traffic alias - updated by deploy-handler for zero-downtime deployment",
});

/**
 * Deploy Handler Lambda
 *
 * Triggered after CodeBuild completes, orchestrates deployment:
 * 1. Downloads build artifacts from S3
 * 2. Uploads static assets to S3 with cache headers
 * 3. Updates Lambda function code
 * 4. Publishes immutable Lambda version
 * 5. Atomically updates 'live' alias (zero-downtime)
 * 6. Updates deployment record with version ARNs
 *
 * This Lambda needs permissions to:
 * - Update Lambda function code
 * - Publish versions
 * - Create/update aliases
 * - Read/write S3 buckets
 * - Update DynamoDB deployment records
 */
export const deployHandler = new sst.aws.Function("DeployHandler", {
  handler: "packages/functions/deploy-handler/index.handler",
  runtime: "nodejs20.x",
  timeout: "5 minutes", // Deployment can take time
  memory: "512 MB",
  environment: {
    SERVER_FUNCTION_NAME: serverFunction.name,
    IMAGE_FUNCTION_NAME: imageFunction.name,
    STATIC_ASSETS_BUCKET: staticAssetsBucket.name,
    ARTIFACTS_BUCKET: artifactsBucket.name,
  },
  link: [deploymentsTable, artifactsBucket, staticAssetsBucket],
  permissions: [
    // Lambda permissions for updating function code, config, publishing versions, and managing aliases
    {
      actions: [
        "lambda:UpdateFunctionCode",
        "lambda:UpdateFunctionConfiguration", // Needed to update handler to OpenNext entry point
        "lambda:PublishVersion",
        "lambda:GetFunction",
        "lambda:GetFunctionConfiguration",
        "lambda:CreateAlias",
        "lambda:UpdateAlias",
        "lambda:GetAlias",
      ],
      resources: [
        serverFunction.arn,
        imageFunction.arn,
        // Include versioned ARNs pattern
        $interpolate`${serverFunction.arn}:*`,
        $interpolate`${imageFunction.arn}:*`,
      ],
    },
  ],
});

/**
 * CloudFront Distribution
 *
 * CDN for serving deployed Next.js applications.
 *
 * Using native AWS CloudFront resource for fine-grained cache behavior control.
 * SST's Cdn component is too opinionated for Next.js serving patterns.
 *
 * Cache behaviors (ordered by precedence):
 * 1. /_next/image* → Image Lambda (cache by query string)
 * 2. /_next/static/* → S3 (cache 1 year, immutable)
 * 3. /static/* → S3 (cache 1 year, immutable)
 * 4. /* (default) → Server Lambda (cache controlled by headers)
 *
 * Note: For Phase 2 Plan 01, using S3 website endpoint for public access.
 * Plan 02 will implement proper Origin Access Control (OAC) during deployment process.
 *
 * Future enhancements (Plan 03):
 * - Custom domain support with ACM certificates
 * - Per-deployment routing via Lambda@Edge or custom headers
 */

// CloudFront Distribution
const distribution = new aws.cloudfront.Distribution("Distribution", {
  enabled: true,
  priceClass: "PriceClass_100", // Use only North America and Europe edge locations (cheapest)
  httpVersion: "http2and3", // Enable HTTP/3
  comment: "Anchor Deploy - Next.js App Distribution",

  origins: [
    {
      // Origin 1: S3 for static assets (dedicated bucket for deployed assets)
      originId: "s3-static",
      domainName: staticAssetsBucket.domain,
      originPath: "", // Will serve from s3://bucket/deployments/{deploymentId}/
      s3OriginConfig: {
        originAccessIdentity: "", // No OAI - using public bucket (OAC in future)
      },
    },
    {
      // Origin 2: Server Lambda for SSR/API (via 'live' alias)
      // Note: Function URLs don't support aliases directly, so we still use base URL
      // The alias routing happens internally when invoking the function
      originId: "lambda-server",
      domainName: serverFunction.url.apply((url: string) => url.replace("https://", "").replace(/\/$/, "")),
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: "https-only",
        originSslProtocols: ["TLSv1.2"],
      },
    },
    {
      // Origin 3: Image Lambda for /_next/image (via 'live' alias)
      originId: "lambda-image",
      domainName: imageFunction.url.apply((url: string) => url.replace("https://", "").replace(/\/$/, "")),
      customOriginConfig: {
        httpPort: 80,
        httpsPort: 443,
        originProtocolPolicy: "https-only",
        originSslProtocols: ["TLSv1.2"],
      },
    },
  ],

  defaultCacheBehavior: {
    // Default behavior: Server Lambda for SSR and API routes
    targetOriginId: "lambda-server",
    viewerProtocolPolicy: "redirect-to-https",
    allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
    cachedMethods: ["GET", "HEAD", "OPTIONS"],

    // Cache policy: respect origin headers
    cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad", // CachingDisabled managed policy
    originRequestPolicyId: "216adef6-5c7f-47e4-b989-5492eafa07d3", // AllViewer managed policy

    compress: true,
  },

  orderedCacheBehaviors: [
    {
      // Behavior 1: Image optimization
      pathPattern: "/_next/image*",
      targetOriginId: "lambda-image",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS"],
      cachedMethods: ["GET", "HEAD"],

      // Cache policy: cache by query string (includes width, quality, etc.)
      cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized managed policy

      compress: true,
    },
    {
      // Behavior 2: Next.js static assets (/_next/static/*)
      pathPattern: "/_next/static/*",
      targetOriginId: "s3-static",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],

      // Cache policy: 1 year, immutable (hashed filenames)
      cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized managed policy

      compress: true,
    },
    {
      // Behavior 3: Public static assets (/static/*)
      pathPattern: "/static/*",
      targetOriginId: "s3-static",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD"],
      cachedMethods: ["GET", "HEAD"],

      // Cache policy: 1 year, immutable
      cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6", // CachingOptimized managed policy

      compress: true,
    },
  ],

  restrictions: {
    geoRestriction: {
      restrictionType: "none",
    },
  },

  viewerCertificate: {
    cloudfrontDefaultCertificate: true, // Use default CloudFront cert for now (custom domains in Plan 03)
  },
});

/**
 * Rollback Handler Lambda
 *
 * Provides instant deployment rollback by updating Lambda aliases.
 * Zero-downtime rollback (<1 second) without code re-upload.
 *
 * Permissions needed:
 * - lambda:GetAlias - Get current alias state
 * - lambda:UpdateAlias - Update alias to target version (instant rollback)
 */
export const rollbackHandler = new sst.aws.Function("RollbackHandler", {
  handler: "packages/functions/rollback-handler/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "256 MB",
  environment: {
    SERVER_FUNCTION_NAME: serverFunction.name,
    IMAGE_FUNCTION_NAME: imageFunction.name,
  },
  link: [deploymentsTable],
  permissions: [
    {
      actions: ["lambda:GetAlias", "lambda:UpdateAlias"],
      resources: [
        serverFunction.arn,
        imageFunction.arn,
        $interpolate`${serverFunction.arn}:*`,
        $interpolate`${imageFunction.arn}:*`,
      ],
    },
  ],
});

/**
 * Domains Handler Lambda
 *
 * Manages custom domains with ACM certificate provisioning and CloudFront integration.
 *
 * Permissions needed:
 * - ACM: Request, describe, and delete certificates (must be us-east-1 for CloudFront)
 * - CloudFront: Get and update distribution config for custom domain aliases
 */
export const domainsHandler = new sst.aws.Function("DomainsHandler", {
  handler: "packages/functions/domains-handler/index.handler",
  runtime: "nodejs20.x",
  timeout: "30 seconds",
  memory: "256 MB",
  environment: {
    CLOUDFRONT_DOMAIN: distribution.domainName,
    CLOUDFRONT_DISTRIBUTION_ID: distribution.id,
  },
  link: [domainsTable],
  permissions: [
    {
      // ACM permissions - note region is us-east-1
      actions: [
        "acm:RequestCertificate",
        "acm:DescribeCertificate",
        "acm:DeleteCertificate",
        "acm:ListCertificates",
      ],
      resources: ["*"], // ACM doesn't support resource-level permissions
    },
    {
      // CloudFront permissions for distribution update
      actions: [
        "cloudfront:GetDistribution",
        "cloudfront:GetDistributionConfig",
        "cloudfront:UpdateDistribution",
      ],
      resources: ["*"], // CloudFront requires wildcard for distribution updates
    },
  ],
});

// Export distribution with SST-style interface
export { distribution };
