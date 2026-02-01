import { createHmac, timingSafeEqual } from "crypto";
import { Resource } from "sst";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { nanoid } from "nanoid";

import {
  GitHubPushPayloadSchema,
  extractBranchName,
  type GitHubPushPayload,
} from "../../core/schemas/webhook.js";

/**
 * GitHub Webhook Handler
 *
 * Receives push events from GitHub, validates HMAC signature,
 * creates deployment record, returns 202 immediately.
 *
 * Security:
 * - HMAC-SHA256 signature validation with timing-safe comparison
 * - Validates signature BEFORE processing payload
 * - Logs signature failures for monitoring
 *
 * Async pattern:
 * - Returns 202 Accepted immediately (< 1 second)
 * - Actual build processing happens via SQS queue (Plan 03)
 */

const dynamodb = new DynamoDBClient({});

interface APIGatewayProxyEventV2 {
  headers: Record<string, string | undefined>;
  pathParameters?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
}

interface APIGatewayProxyResultV2 {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Validate GitHub webhook signature using HMAC-SHA256
 *
 * SECURITY CRITICAL:
 * - Uses crypto.timingSafeEqual to prevent timing attacks
 * - Never use === for signature comparison
 *
 * @param payload - Raw request body
 * @param signature - x-hub-signature-256 header value
 * @param secret - Webhook secret
 * @returns true if signature is valid
 */
function validateSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = signature.slice("sha256=".length);

  const computedHmac = createHmac("sha256", secret)
    .update(payload, "utf8")
    .digest("hex");

  // CRITICAL: Use timingSafeEqual to prevent timing attacks
  try {
    return timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(computedHmac, "hex")
    );
  } catch {
    // If buffers have different lengths, timingSafeEqual throws
    return false;
  }
}

/**
 * Lambda handler for GitHub webhook events
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const projectId = event.pathParameters?.projectId;

  if (!projectId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing projectId parameter" }),
    };
  }

  // Get raw body for signature validation
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? "", "base64").toString("utf8")
    : event.body ?? "";

  // Step 1: Validate signature (SECURITY CRITICAL)
  const signature = event.headers["x-hub-signature-256"];
  const webhookSecret = Resource.WEBHOOK_SECRET.value;

  if (!signature) {
    console.error("[SECURITY] Missing signature header", { projectId });
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing signature header" }),
    };
  }

  if (!validateSignature(body, signature, webhookSecret)) {
    console.error("[SECURITY] Invalid webhook signature", { projectId });
    return {
      statusCode: 401,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid signature" }),
    };
  }

  // Step 2: Parse and validate payload
  let payload: GitHubPushPayload;
  try {
    const rawPayload = JSON.parse(body);
    payload = GitHubPushPayloadSchema.parse(rawPayload);
  } catch (error) {
    console.error("[VALIDATION] Invalid payload", { error, projectId });
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid payload format" }),
    };
  }

  // Step 3: Filter branch - only process main branch
  const branch = extractBranchName(payload.ref);
  if (branch !== "main") {
    console.log("[IGNORED] Non-main branch push", { branch, projectId });
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Push acknowledged but not processed (non-main branch)",
        branch,
      }),
    };
  }

  // Step 4: Verify project exists
  const projectResult = await dynamodb.send(
    new GetItemCommand({
      TableName: Resource.Projects.name,
      Key: marshall({ projectId }),
    })
  );

  if (!projectResult.Item) {
    console.error("[NOT_FOUND] Project not found", { projectId });
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Project not found" }),
    };
  }

  const project = unmarshall(projectResult.Item);
  const userId = project.userId;

  // Step 5: Create deployment record
  const deploymentId = nanoid();
  const now = new Date().toISOString();

  // Use full commit SHA (40 chars) from after field
  const commitSha = payload.after;

  const deployment = {
    deploymentId,
    projectId,
    userId,
    status: "queued",
    commitSha,
    commitMessage: payload.head_commit?.message?.slice(0, 1000), // Truncate if needed
    commitAuthor: payload.head_commit
      ? {
          name: payload.head_commit.author.name,
          email: payload.head_commit.author.email,
        }
      : undefined,
    createdAt: now,
  };

  await dynamodb.send(
    new PutItemCommand({
      TableName: Resource.Deployments.name,
      Item: marshall(deployment, { removeUndefinedValues: true }),
    })
  );

  console.log("[CREATED] Deployment queued", {
    deploymentId,
    projectId,
    commitSha: commitSha.slice(0, 7),
  });

  // Step 6: Return 202 Accepted immediately
  return {
    statusCode: 202,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Deployment queued",
      deploymentId,
      commitSha: commitSha.slice(0, 7), // Short SHA for display
    }),
  };
}
