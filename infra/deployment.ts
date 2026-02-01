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
 *
 * - Image Lambda:
 *   - Uses Sharp for image optimization
 *   - 1024MB memory for image processing
 *
 * - Static Assets:
 *   - Served from existing artifactsBucket
 *   - Cached aggressively (1 year) with immutable filenames
 *
 * Per-deployment routing will be added in Plan 02 (deployment process)
 */

import { artifactsBucket } from "./storage.js";
import { deploymentsTable } from "./database.js";

/**
 * Server Lambda Function
 *
 * Handles SSR pages and API routes from deployed Next.js apps.
 * Actual handler code is deployed per-deployment using OpenNext output.
 *
 * For now, this is a placeholder that will be updated during first deployment.
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
  streaming: true, // Enable response streaming for SSR
  url: true, // Create function URL for CloudFront origin
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
  url: true, // Create function URL for CloudFront origin
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
 * Future enhancements (Plan 03):
 * - Custom domain support with ACM certificates
 * - Per-deployment routing via Lambda@Edge or custom headers
 */

// CloudFront Origin Access Control for S3
const oac = new aws.cloudfront.OriginAccessControl("StaticAssetsOAC", {
  name: $interpolate`anchor-deploy-${$app.stage}-static-oac`,
  originAccessControlOriginType: "s3",
  signingBehavior: "always",
  signingProtocol: "sigv4",
});

// CloudFront Distribution
const distribution = new aws.cloudfront.Distribution("Distribution", {
  enabled: true,
  priceClass: "PriceClass_100", // Use only North America and Europe edge locations (cheapest)
  httpVersion: "http2and3", // Enable HTTP/3
  comment: "Anchor Deploy - Next.js App Distribution",

  origins: [
    {
      // Origin 1: S3 for static assets
      originId: "s3-static",
      domainName: artifactsBucket.domain,
      originPath: "/static", // Will serve from s3://bucket/static/{projectId}/{deploymentId}/
      originAccessControlId: oac.id,
    },
    {
      // Origin 2: Server Lambda for SSR/API
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
      // Origin 3: Image Lambda for /_next/image
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

// Allow CloudFront to access S3 bucket
// Must be created AFTER distribution to avoid circular dependency
new aws.s3.BucketPolicy("StaticAssetsBucketPolicy", {
  bucket: artifactsBucket.name,
  policy: aws.iam.getPolicyDocumentOutput({
    statements: [
      {
        sid: "AllowCloudFrontOAC",
        effect: "Allow",
        principals: [
          {
            type: "Service",
            identifiers: ["cloudfront.amazonaws.com"],
          },
        ],
        actions: ["s3:GetObject"],
        resources: [$interpolate`${artifactsBucket.arn}/*`],
        conditions: [
          {
            test: "StringEquals",
            variable: "AWS:SourceArn",
            values: [$interpolate`arn:aws:cloudfront::${aws.getCallerIdentityOutput({}).accountId}:distribution/${distribution.id}`],
          },
        ],
      },
    ],
  }).json,
});

// Export distribution with SST-style interface
export { distribution };
