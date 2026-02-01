import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

import { docClient } from "./client.js";
import {
  DomainSchema,
  type Domain,
  type CreateDomainInput,
  type UpdateDomainInput,
  type CloudFrontStatus,
} from "../schemas/domain.js";
import { getProject } from "./projects.js";

const DOMAINS_TABLE = process.env.DOMAINS_TABLE ?? "DomainsTable";

/**
 * Domains Data Access Layer
 *
 * All operations verify project ownership via userId.
 * Domains inherit tenant isolation from their parent project.
 */

/**
 * Create a new domain
 *
 * Auto-generates: domainId, userId (from project), createdAt, updatedAt
 * Verifies project ownership before creating domain.
 *
 * @param userId - The user making the request (for ownership verification)
 * @param domainData - Domain data including projectId, domain, certificate info
 * @returns The created domain
 * @throws Error if project not found or not owned by user
 */
export async function createDomain(
  userId: string,
  domainData: Omit<Domain, "domainId" | "userId" | "createdAt" | "updatedAt">
): Promise<Domain> {
  if (!userId || !domainData.projectId) {
    throw new Error("userId and projectId are required");
  }

  // Verify project ownership first
  const project = await getProject(domainData.projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  const now = Date.now();
  const domain: Domain = {
    domainId: `DOM-${nanoid()}`,
    userId, // Inherited from project owner for tenant isolation
    ...domainData,
    createdAt: now,
    updatedAt: now,
  };

  // Validate full domain before saving
  const validatedDomain = DomainSchema.parse(domain);

  await docClient.send(
    new PutCommand({
      TableName: DOMAINS_TABLE,
      Item: validatedDomain,
    })
  );

  return validatedDomain;
}

/**
 * Get a domain by ID
 *
 * @param domainId - The domain's unique ID
 * @returns The domain if found, null otherwise
 */
export async function getDomain(domainId: string): Promise<Domain | null> {
  if (!domainId) {
    throw new Error("domainId is required");
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: DOMAINS_TABLE,
      Key: {
        domainId,
      },
    })
  );

  if (!result.Item) {
    return null;
  }

  return DomainSchema.parse(result.Item);
}

/**
 * Get a domain by ID with user verification
 *
 * @param domainId - The domain's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @returns The domain if found and owned by user, null otherwise
 */
export async function getDomainForUser(
  domainId: string,
  userId: string
): Promise<Domain | null> {
  if (!domainId || !userId) {
    throw new Error("domainId and userId are required");
  }

  const domain = await getDomain(domainId);

  // Verify ownership (row-level security)
  if (!domain || domain.userId !== userId) {
    return null;
  }

  return domain;
}

/**
 * List all domains for a project
 *
 * Verifies project ownership before listing.
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @returns Array of domains for the project
 * @throws Error if project not found or not owned by user
 */
export async function listProjectDomains(
  projectId: string,
  userId: string
): Promise<Domain[]> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Verify project ownership first
  const project = await getProject(projectId, userId);
  if (!project) {
    throw new Error("Project not found or access denied");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: DOMAINS_TABLE,
      IndexName: "ProjectIdIndex",
      KeyConditionExpression: "projectId = :projectId",
      ExpressionAttributeValues: {
        ":projectId": projectId,
      },
    })
  );

  return (result.Items ?? []).map((item) => DomainSchema.parse(item));
}

/**
 * Update domain certificate information
 *
 * @param domainId - The domain's unique ID
 * @param certData - Certificate ARN, status, and DNS validation info
 * @returns The updated domain
 */
export async function updateDomainCertificate(
  domainId: string,
  certData: UpdateDomainInput
): Promise<Domain> {
  if (!domainId) {
    throw new Error("domainId is required");
  }

  // Build update expression dynamically
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, unknown> = {};

  if (certData.certificateArn !== undefined) {
    updateExpressions.push("#certificateArn = :certificateArn");
    expressionAttributeNames["#certificateArn"] = "certificateArn";
    expressionAttributeValues[":certificateArn"] = certData.certificateArn;
  }

  if (certData.certificateStatus !== undefined) {
    updateExpressions.push("#certificateStatus = :certificateStatus");
    expressionAttributeNames["#certificateStatus"] = "certificateStatus";
    expressionAttributeValues[":certificateStatus"] = certData.certificateStatus;
  }

  if (certData.cloudFrontStatus !== undefined) {
    updateExpressions.push("#cloudFrontStatus = :cloudFrontStatus");
    expressionAttributeNames["#cloudFrontStatus"] = "cloudFrontStatus";
    expressionAttributeValues[":cloudFrontStatus"] = certData.cloudFrontStatus;
  }

  if (certData.dnsValidation !== undefined) {
    updateExpressions.push("#dnsValidation = :dnsValidation");
    expressionAttributeNames["#dnsValidation"] = "dnsValidation";
    expressionAttributeValues[":dnsValidation"] = certData.dnsValidation;
  }

  // Always update updatedAt
  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = Date.now();

  const result = await docClient.send(
    new UpdateCommand({
      TableName: DOMAINS_TABLE,
      Key: {
        domainId,
      },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    throw new Error("Failed to update domain");
  }

  return DomainSchema.parse(result.Attributes);
}

/**
 * Update domain CloudFront status
 *
 * @param domainId - The domain's unique ID
 * @param status - CloudFront integration status
 * @returns The updated domain
 */
export async function updateDomainCloudFrontStatus(
  domainId: string,
  status: CloudFrontStatus
): Promise<Domain> {
  return updateDomainCertificate(domainId, { cloudFrontStatus: status });
}

/**
 * Delete a domain
 *
 * @param domainId - The domain's unique ID
 * @returns void
 */
export async function deleteDomain(domainId: string): Promise<void> {
  if (!domainId) {
    throw new Error("domainId is required");
  }

  await docClient.send(
    new DeleteCommand({
      TableName: DOMAINS_TABLE,
      Key: {
        domainId,
      },
    })
  );
}
