/**
 * S3 Storage Buckets for Anchor Deploy
 *
 * Two buckets:
 * 1. Artifacts Bucket: Build outputs (Lambda zips, static assets)
 * 2. Logs Bucket: Build logs for debugging and audit
 *
 * Lifecycle policies prevent cost balloon:
 * - Artifacts: Delete after 90 days
 * - Logs: Transition to Glacier after 30 days, Deep Archive after 365 days
 *
 * Storage structure:
 * - artifacts/{projectId}/{deploymentId}/lambda.zip
 * - artifacts/{projectId}/{deploymentId}/static/
 * - logs/{projectId}/{deploymentId}/build.log
 */

/**
 * Artifacts Bucket
 *
 * Stores build outputs from OpenNext:
 * - Lambda function packages
 * - Static assets
 *
 * Lifecycle: Delete after 90 days
 * - Sufficient for rollback needs (rarely need builds older than 90 days)
 * - Prevents silent cost balloon (50 sites x 10 deploys/day = 100GB/day growth)
 *
 * Cost estimate with lifecycle:
 * - 90 days retention: ~9TB max at $0.023/GB = ~$207/year
 * - Without lifecycle: ~36TB/year = $840/year (4x cost)
 */
export const artifactsBucket = new sst.aws.Bucket("Artifacts", {
  transform: {
    bucket: {
      forceDestroy: true, // Allow bucket deletion even with objects (non-prod)
    },
  },
});

/**
 * Configure lifecycle rules for artifacts bucket
 *
 * Using aws.s3.BucketLifecycleConfigurationV2 for lifecycle rules
 * since SST's Bucket component doesn't expose lifecycle directly.
 */
new aws.s3.BucketLifecycleConfigurationV2("ArtifactsLifecycle", {
  bucket: artifactsBucket.name,
  rules: [
    {
      id: "DeleteOldArtifacts",
      status: "Enabled",
      filter: {
        prefix: "", // Apply to all objects
      },
      expiration: {
        days: 90,
      },
    },
    {
      id: "AbortIncompleteMultipartUploads",
      status: "Enabled",
      filter: {
        prefix: "",
      },
      abortIncompleteMultipartUpload: {
        daysAfterInitiation: 7,
      },
    },
  ],
});

/**
 * Static Assets Bucket
 *
 * Stores deployed static assets served via CloudFront:
 * - /_next/static/* (immutable, hashed filenames)
 * - /static/* (public assets)
 *
 * Separate from artifacts bucket for:
 * - CloudFront Origin Access Control (OAC)
 * - No lifecycle policy (deployed assets stay until manually removed)
 * - Public read access via CloudFront only
 *
 * Structure: deployments/{deploymentId}/_next/static/...
 */
export const staticAssetsBucket = new sst.aws.Bucket("StaticAssets", {
  transform: {
    bucket: {
      forceDestroy: true, // Allow bucket deletion in non-prod
    },
  },
});

/**
 * Logs Bucket
 *
 * Stores build logs for debugging and compliance:
 * - CodeBuild output logs
 * - Error logs for failed deployments
 *
 * Lifecycle: Glacier after 30 days, Deep Archive after 365 days
 * - Logs rarely accessed after 30 days (debugging window)
 * - Keep for 1+ years for compliance/audit
 * - Glacier: 80% cost reduction vs Standard
 * - Deep Archive: 95% cost reduction vs Standard
 *
 * Cost estimate with lifecycle:
 * - First 30 days in Standard: ~$2/month
 * - 30-365 days in Glacier: ~$1/month
 * - 365+ days in Deep Archive: ~$0.1/month
 */
export const logsBucket = new sst.aws.Bucket("Logs", {
  transform: {
    bucket: {
      forceDestroy: true,
    },
  },
});

/**
 * Configure lifecycle rules for logs bucket
 */
new aws.s3.BucketLifecycleConfigurationV2("LogsLifecycle", {
  bucket: logsBucket.name,
  rules: [
    {
      id: "ArchiveLogs",
      status: "Enabled",
      filter: {
        prefix: "",
      },
      transitions: [
        {
          days: 30,
          storageClass: "GLACIER",
        },
        {
          days: 365,
          storageClass: "DEEP_ARCHIVE",
        },
      ],
    },
    {
      id: "AbortIncompleteMultipartUploads",
      status: "Enabled",
      filter: {
        prefix: "",
      },
      abortIncompleteMultipartUpload: {
        daysAfterInitiation: 7,
      },
    },
  ],
});
