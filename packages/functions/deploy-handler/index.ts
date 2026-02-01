import {
  LambdaClient,
  UpdateFunctionCodeCommand,
  PublishVersionCommand,
  UpdateAliasCommand,
  CreateAliasCommand,
  waitUntilFunctionUpdated,
} from "@aws-sdk/client-lambda";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Readable } from "stream";

/**
 * Deploy Handler Lambda
 *
 * Orchestrates deployment of OpenNext build artifacts to production:
 * 1. Downloads build artifacts from S3
 * 2. Uploads static assets to S3 with cache headers
 * 3. Updates Lambda function code
 * 4. Publishes immutable Lambda version
 * 5. Atomically updates Lambda alias for zero-downtime deployment
 * 6. Updates deployment record with version info
 *
 * Zero-Downtime Strategy (DEPLOY-04):
 * - CloudFront/Function URLs invoke Lambda via 'live' alias
 * - Updating alias is atomic - no requests hit $LATEST during upload
 * - Old version remains available for rollback
 */

const lambda = new LambdaClient({});
const s3 = new S3Client({});
const dynamodb = new DynamoDBClient({});

const LIVE_ALIAS = "live"; // CloudFront/Function URL targets this alias

/**
 * Deployment event from CodeBuild or direct invocation
 */
interface DeployEvent {
  deploymentId: string;
  projectId: string;
  artifactPath: string; // s3://bucket/artifacts/projectId/commitSha/
}

/**
 * Lambda event structure
 */
interface LambdaEvent {
  deploymentId: string;
  projectId: string;
  artifactPath: string;
}

/**
 * Update deployment status in DynamoDB
 */
async function updateDeploymentStatus(
  projectId: string,
  deploymentId: string,
  status: "deploying" | "success" | "failed",
  error?: string
): Promise<void> {
  const updateExpression =
    status === "failed"
      ? "SET #status = :status, endedAt = :endedAt, #error = :error"
      : status === "success"
        ? "SET #status = :status, endedAt = :endedAt"
        : "SET #status = :status";

  const expressionValues: Record<string, any> = {
    ":status": { S: status },
  };

  const expressionNames: Record<string, string> = {
    "#status": "status",
  };

  if (status === "success" || status === "failed") {
    expressionValues[":endedAt"] = { S: new Date().toISOString() };
  }

  if (status === "failed" && error) {
    expressionValues[":error"] = { S: error };
    expressionNames["#error"] = "error";
  }

  await dynamodb.send(
    new UpdateItemCommand({
      TableName: process.env.DEPLOYMENTS_TABLE!,
      Key: {
        projectId: { S: projectId },
        deploymentId: { S: deploymentId },
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
    })
  );

  console.log(`[STATUS] Deployment ${deploymentId} updated to ${status}`);
}

/**
 * Update deployment record with Lambda version info
 */
async function setDeploymentVersion(
  projectId: string,
  deploymentId: string,
  data: {
    lambdaServerVersionArn: string;
    lambdaImageVersionArn: string;
    lambdaServerAliasArn: string;
    staticAssetsPath: string;
    deployedAt: number;
    version: string;
    status: string;
  }
): Promise<void> {
  await dynamodb.send(
    new UpdateItemCommand({
      TableName: process.env.DEPLOYMENTS_TABLE!,
      Key: {
        projectId: { S: projectId },
        deploymentId: { S: deploymentId },
      },
      UpdateExpression:
        "SET lambdaServerVersionArn = :serverVersionArn, " +
        "lambdaImageVersionArn = :imageVersionArn, " +
        "lambdaServerAliasArn = :serverAliasArn, " +
        "staticAssetsPath = :staticPath, " +
        "deployedAt = :deployedAt, " +
        "#version = :version, " +
        "#status = :status",
      ExpressionAttributeNames: {
        "#version": "version",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":serverVersionArn": { S: data.lambdaServerVersionArn },
        ":imageVersionArn": { S: data.lambdaImageVersionArn },
        ":serverAliasArn": { S: data.lambdaServerAliasArn },
        ":staticPath": { S: data.staticAssetsPath },
        ":deployedAt": { N: data.deployedAt.toString() },
        ":version": { S: data.version },
        ":status": { S: data.status },
      },
    })
  );

  console.log(`[VERSION] Deployment ${deploymentId} version info saved`, data);
}

/**
 * Upload static assets to S3 with cache headers
 *
 * Cache strategy:
 * - /_next/static/*: immutable, 1 year cache
 * - Other assets: no cache (revalidate)
 */
async function uploadStaticAssets(
  artifactsBucket: string,
  artifactPath: string,
  staticAssetsBucket: string,
  deploymentId: string
): Promise<string> {
  console.log(`[S3] Uploading static assets from ${artifactPath}`);

  // Parse artifact path: artifacts/projectId/commitSha/
  const pathParts = artifactPath.split("/");
  const projectId = pathParts[1];
  const commitSha = pathParts[2];

  // List all objects in the static assets directory
  const listResult = await s3.send(
    new ListObjectsV2Command({
      Bucket: artifactsBucket,
      Prefix: `static/${projectId}/${commitSha}/`,
    })
  );

  if (!listResult.Contents || listResult.Contents.length === 0) {
    console.log(`[S3] No static assets found at static/${projectId}/${commitSha}/`);
    return `s3://${staticAssetsBucket}/deployments/${deploymentId}/`;
  }

  // Upload each asset to destination bucket with appropriate cache headers
  for (const object of listResult.Contents) {
    if (!object.Key) continue;

    // Download from artifacts bucket
    const getResult = await s3.send(
      new GetObjectCommand({
        Bucket: artifactsBucket,
        Key: object.Key,
      })
    );

    // Determine cache headers based on path
    const isImmutable = object.Key.includes("/_next/static/");
    const cacheControl = isImmutable
      ? "public,max-age=31536000,immutable"
      : "public,max-age=0,must-revalidate";

    // Extract relative path (remove static/projectId/commitSha/ prefix)
    const relativePath = object.Key.replace(
      `static/${projectId}/${commitSha}/`,
      ""
    );
    const destinationKey = `deployments/${deploymentId}/${relativePath}`;

    // Upload to static assets bucket
    await s3.send(
      new PutObjectCommand({
        Bucket: staticAssetsBucket,
        Key: destinationKey,
        Body: getResult.Body as Readable,
        ContentType: getResult.ContentType,
        CacheControl: cacheControl,
      })
    );

    console.log(`[S3] Uploaded ${relativePath} with cache: ${cacheControl}`);
  }

  const staticAssetsPath = `s3://${staticAssetsBucket}/deployments/${deploymentId}/`;
  console.log(`[S3] Static assets uploaded to ${staticAssetsPath}`);
  return staticAssetsPath;
}

/**
 * Update Lambda function code and publish version with alias
 *
 * Zero-downtime deployment:
 * 1. Update function code
 * 2. Wait for update to complete
 * 3. Publish immutable version
 * 4. Atomically update 'live' alias to new version
 */
async function deployLambdaFunction(
  functionName: string,
  artifactsBucket: string,
  artifactKey: string,
  deploymentId: string
): Promise<{ versionArn: string; aliasArn: string; version: string }> {
  console.log(`[LAMBDA] Deploying ${functionName} from s3://${artifactsBucket}/${artifactKey}`);

  // Step 1: Update function code
  const updateResult = await lambda.send(
    new UpdateFunctionCodeCommand({
      FunctionName: functionName,
      S3Bucket: artifactsBucket,
      S3Key: artifactKey,
    })
  );

  console.log(`[LAMBDA] Function code updated, waiting for completion...`);

  // Step 2: Wait for update to complete (required before publishing version)
  await waitUntilFunctionUpdated(
    {
      client: lambda,
      maxWaitTime: 300, // 5 minutes max
    },
    {
      FunctionName: functionName,
    }
  );

  console.log(`[LAMBDA] Function update complete, publishing version...`);

  // Step 3: Publish immutable version
  const versionResult = await lambda.send(
    new PublishVersionCommand({
      FunctionName: functionName,
      Description: `Deployment ${deploymentId} - ${new Date().toISOString()}`,
    })
  );

  const version = versionResult.Version!;
  const versionArn = versionResult.FunctionArn!;

  console.log(`[LAMBDA] Published version ${version}: ${versionArn}`);

  // Step 4: Update 'live' alias for zero-downtime deployment
  let aliasArn: string;
  try {
    const updateAliasResult = await lambda.send(
      new UpdateAliasCommand({
        FunctionName: functionName,
        Name: LIVE_ALIAS,
        FunctionVersion: version,
        Description: `Deployment ${deploymentId} - ${new Date().toISOString()}`,
      })
    );
    aliasArn = updateAliasResult.AliasArn!;
    console.log(`[LAMBDA] Updated alias '${LIVE_ALIAS}' to version ${version}`);
  } catch (error: any) {
    if (error.name === "ResourceNotFoundException") {
      // Create alias if it doesn't exist (first deployment)
      console.log(`[LAMBDA] Creating alias '${LIVE_ALIAS}' for first deployment`);
      const createAliasResult = await lambda.send(
        new CreateAliasCommand({
          FunctionName: functionName,
          Name: LIVE_ALIAS,
          FunctionVersion: version,
          Description: `Deployment ${deploymentId} - ${new Date().toISOString()}`,
        })
      );
      aliasArn = createAliasResult.AliasArn!;
      console.log(`[LAMBDA] Created alias '${LIVE_ALIAS}': ${aliasArn}`);
    } else {
      throw error;
    }
  }

  return { versionArn, aliasArn, version };
}

/**
 * Main deployment handler
 */
export async function handler(event: LambdaEvent): Promise<void> {
  console.log(`[DEPLOY] Starting deployment`, {
    deploymentId: event.deploymentId,
    projectId: event.projectId,
    artifactPath: event.artifactPath,
  });

  try {
    // Update status to deploying
    await updateDeploymentStatus(event.projectId, event.deploymentId, "deploying");

    // Parse artifact path
    const artifactsBucket = process.env.ARTIFACTS_BUCKET!;
    const staticAssetsBucket = process.env.STATIC_ASSETS_BUCKET!;

    // Step 1: Upload static assets to S3
    const staticAssetsPath = await uploadStaticAssets(
      artifactsBucket,
      event.artifactPath,
      staticAssetsBucket,
      event.deploymentId
    );

    // Step 2: Deploy server Lambda
    const serverLambdaKey = `${event.artifactPath}lambda.zip`;
    const serverDeployment = await deployLambdaFunction(
      process.env.SERVER_FUNCTION_NAME!,
      artifactsBucket,
      serverLambdaKey,
      event.deploymentId
    );

    // Step 3: Deploy image Lambda (using same package for now)
    // TODO: In production, use separate image-optimization-function package
    const imageDeployment = await deployLambdaFunction(
      process.env.IMAGE_FUNCTION_NAME!,
      artifactsBucket,
      serverLambdaKey,
      event.deploymentId
    );

    // Step 4: Update deployment record with version info
    await setDeploymentVersion(event.projectId, event.deploymentId, {
      lambdaServerVersionArn: serverDeployment.versionArn,
      lambdaImageVersionArn: imageDeployment.versionArn,
      lambdaServerAliasArn: serverDeployment.aliasArn,
      staticAssetsPath,
      deployedAt: Date.now(),
      version: `v${Date.now()}`,
      status: "success",
    });

    // Step 5: Update deployment status to success
    await updateDeploymentStatus(event.projectId, event.deploymentId, "success");

    console.log(`[DEPLOY] Deployment complete`, {
      deploymentId: event.deploymentId,
      serverVersion: serverDeployment.version,
      imageVersion: imageDeployment.version,
    });
  } catch (error) {
    console.error(`[DEPLOY] Deployment failed`, {
      deploymentId: event.deploymentId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    await updateDeploymentStatus(
      event.projectId,
      event.deploymentId,
      "failed",
      error instanceof Error ? error.message : String(error)
    );

    throw error;
  }
}
