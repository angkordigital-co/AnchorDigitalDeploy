/**
 * Domains Handler for Anchor Deploy
 *
 * Provides custom domain management with ACM certificate provisioning and CloudFront integration.
 *
 * Endpoints:
 * - GET /projects/{projectId}/domains - List domains for project
 * - POST /projects/{projectId}/domains - Add custom domain with ACM certificate
 * - GET /projects/{projectId}/domains/{domainId} - Get domain details + check certificate status
 * - DELETE /projects/{projectId}/domains/{domainId} - Remove domain
 *
 * Flow:
 * 1. User adds domain → ACM certificate requested in us-east-1
 * 2. User receives DNS validation instructions
 * 3. User adds DNS CNAME record
 * 4. GET domain endpoint checks ACM status
 * 5. When certificate becomes ISSUED → CloudFront distribution updated automatically
 * 6. User receives CloudFront CNAME instructions
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  ACMClient,
  RequestCertificateCommand,
  DescribeCertificateCommand,
  DeleteCertificateCommand,
} from "@aws-sdk/client-acm";
import {
  CloudFrontClient,
  GetDistributionConfigCommand,
  UpdateDistributionCommand,
} from "@aws-sdk/client-cloudfront";
import {
  createDomain,
  getDomain,
  getDomainForUser,
  listProjectDomains,
  updateDomainCertificate,
  updateDomainCloudFrontStatus,
  deleteDomain,
} from "@core/db/domains.js";
import { getProject } from "@core/db/projects.js";

// IMPORTANT: ACM client must use us-east-1 for CloudFront
const acm = new ACMClient({ region: "us-east-1" });
const cloudfront = new CloudFrontClient({ region: "us-east-1" });

const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN!;
const CLOUDFRONT_DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID!;

/**
 * Add custom domain request body
 */
interface AddDomainRequest {
  domain: string;
}

/**
 * Add domain to CloudFront distribution
 *
 * Updates distribution configuration to include custom domain with ACM certificate.
 */
async function addDomainToCloudFront(
  domain: string,
  certificateArn: string
): Promise<void> {
  // Get current distribution config
  const getConfigResult = await cloudfront.send(
    new GetDistributionConfigCommand({
      Id: CLOUDFRONT_DISTRIBUTION_ID,
    })
  );

  const config = getConfigResult.DistributionConfig;
  const etag = getConfigResult.ETag;

  if (!config || !etag) {
    throw new Error("Failed to get CloudFront distribution config");
  }

  // Add the custom domain to Aliases
  const currentAliases = config.Aliases?.Items ?? [];
  if (!currentAliases.includes(domain)) {
    config.Aliases = {
      Quantity: currentAliases.length + 1,
      Items: [...currentAliases, domain],
    };
  }

  // Update ViewerCertificate to use ACM certificate
  config.ViewerCertificate = {
    ACMCertificateArn: certificateArn,
    SSLSupportMethod: "sni-only",
    MinimumProtocolVersion: "TLSv1.2_2021",
    CloudFrontDefaultCertificate: false,
  };

  // Update the distribution
  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: CLOUDFRONT_DISTRIBUTION_ID,
      IfMatch: etag,
      DistributionConfig: config,
    })
  );
}

/**
 * Remove domain from CloudFront distribution
 */
async function removeDomainFromCloudFront(domain: string): Promise<void> {
  // Get current distribution config
  const getConfigResult = await cloudfront.send(
    new GetDistributionConfigCommand({
      Id: CLOUDFRONT_DISTRIBUTION_ID,
    })
  );

  const config = getConfigResult.DistributionConfig;
  const etag = getConfigResult.ETag;

  if (!config || !etag) {
    throw new Error("Failed to get CloudFront distribution config");
  }

  // Remove the domain from Aliases
  const currentAliases = config.Aliases?.Items ?? [];
  const newAliases = currentAliases.filter((alias: string) => alias !== domain);

  config.Aliases = {
    Quantity: newAliases.length,
    Items: newAliases,
  };

  // If no more custom domains, revert to default CloudFront certificate
  if (newAliases.length === 0) {
    config.ViewerCertificate = {
      CloudFrontDefaultCertificate: true,
    };
  }

  // Update the distribution
  await cloudfront.send(
    new UpdateDistributionCommand({
      Id: CLOUDFRONT_DISTRIBUTION_ID,
      IfMatch: etag,
      DistributionConfig: config,
    })
  );
}

/**
 * Domains Handler
 *
 * Routes requests to appropriate handler based on HTTP method and path.
 */
export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const projectId = event.pathParameters?.projectId;
    const domainId = event.pathParameters?.domainId;

    // Extract userId from header (Phase 1 auth)
    const userId = event.headers["x-user-id"];
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Missing x-user-id header" }),
      };
    }

    // Route based on method and path
    if (method === "GET" && projectId && !domainId) {
      return listDomainsHandler(projectId, userId);
    }

    if (method === "POST" && projectId && !domainId) {
      const body = event.body ? JSON.parse(event.body) : {};
      return addDomainHandler(projectId, userId, body);
    }

    if (method === "GET" && projectId && domainId) {
      return getDomainHandler(projectId, userId, domainId);
    }

    if (method === "DELETE" && projectId && domainId) {
      return deleteDomainHandler(projectId, userId, domainId);
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Route not found" }),
    };
  } catch (error) {
    console.error("Domains handler error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Internal server error",
        detail: error instanceof Error ? error.message : "Unknown error",
      }),
    };
  }
}

/**
 * List domains for a project
 */
async function listDomainsHandler(
  projectId: string,
  userId: string
): Promise<APIGatewayProxyResultV2> {
  const domains = await listProjectDomains(projectId, userId);

  return {
    statusCode: 200,
    body: JSON.stringify({ domains }),
  };
}

/**
 * Add custom domain with ACM certificate provisioning
 */
async function addDomainHandler(
  projectId: string,
  userId: string,
  body: AddDomainRequest
): Promise<APIGatewayProxyResultV2> {
  const { domain } = body;

  if (!domain) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing domain in request body" }),
    };
  }

  // Validate domain format
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
  if (!domainRegex.test(domain)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid domain format" }),
    };
  }

  // Verify project ownership
  const project = await getProject(projectId, userId);
  if (!project) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Project not found or access denied" }),
    };
  }

  // Request ACM certificate in us-east-1 (CloudFront requirement)
  const certResult = await acm.send(
    new RequestCertificateCommand({
      DomainName: domain,
      ValidationMethod: "DNS",
      Tags: [
        { Key: "Project", Value: projectId },
        { Key: "ManagedBy", Value: "anchor-deploy" },
      ],
    })
  );

  if (!certResult.CertificateArn) {
    throw new Error("Failed to request ACM certificate");
  }

  // Wait a moment for ACM to generate validation records
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Get DNS validation records
  const certDetails = await acm.send(
    new DescribeCertificateCommand({
      CertificateArn: certResult.CertificateArn,
    })
  );

  const dnsValidation =
    certDetails.Certificate?.DomainValidationOptions?.[0]?.ResourceRecord;

  // Create domain record in DynamoDB
  const domainRecord = await createDomain(userId, {
    projectId,
    domain,
    certificateArn: certResult.CertificateArn,
    certificateStatus: "pending_validation",
    cloudFrontStatus: "pending",
    dnsValidation: dnsValidation
      ? {
          name: dnsValidation.Name!,
          value: dnsValidation.Value!,
          type: "CNAME" as const,
        }
      : undefined,
  });

  // Return DNS instructions
  return {
    statusCode: 201,
    body: JSON.stringify({
      domainId: domainRecord.domainId,
      domain,
      status: "pending_validation",
      dnsInstructions: {
        message: "Add the following DNS record to validate your domain:",
        recordType: "CNAME",
        recordName: dnsValidation?.Name,
        recordValue: dnsValidation?.Value,
        note: "After adding the DNS record, certificate validation typically completes within 30 minutes.",
      },
      cloudfrontCname: {
        message:
          "After certificate is issued, add this CNAME to point your domain to CloudFront:",
        recordType: "CNAME",
        recordName: domain,
        recordValue: CLOUDFRONT_DOMAIN,
      },
    }),
  };
}

/**
 * Get domain details and check certificate status
 *
 * If certificate just became ISSUED, automatically updates CloudFront distribution.
 */
async function getDomainHandler(
  projectId: string,
  userId: string,
  domainId: string
): Promise<APIGatewayProxyResultV2> {
  const domainRecord = await getDomainForUser(domainId, userId);

  if (!domainRecord) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Domain not found or access denied" }),
    };
  }

  // Verify domain belongs to this project
  if (domainRecord.projectId !== projectId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Domain does not belong to this project" }),
    };
  }

  // Check current certificate status from ACM
  if (domainRecord.certificateArn) {
    try {
      const certDetails = await acm.send(
        new DescribeCertificateCommand({
          CertificateArn: domainRecord.certificateArn,
        })
      );

      const certStatus = certDetails.Certificate?.Status;

      // If certificate just became ISSUED and CloudFront not yet updated
      if (certStatus === "ISSUED" && domainRecord.cloudFrontStatus === "pending") {
        // UPDATE CLOUDFRONT DISTRIBUTION WITH CUSTOM DOMAIN
        try {
          await addDomainToCloudFront(
            domainRecord.domain,
            domainRecord.certificateArn
          );
          await updateDomainCloudFrontStatus(domainId, "active");
          domainRecord.cloudFrontStatus = "active";
          domainRecord.certificateStatus = "issued";
        } catch (error) {
          console.error("Failed to add domain to CloudFront:", error);
          await updateDomainCloudFrontStatus(domainId, "failed");
          domainRecord.cloudFrontStatus = "failed";
        }
      } else if (certStatus === "ISSUED" && domainRecord.certificateStatus !== "issued") {
        // Update certificate status if changed
        await updateDomainCertificate(domainId, {
          certificateStatus: "issued",
        });
        domainRecord.certificateStatus = "issued";
      } else if (certStatus === "FAILED" && domainRecord.certificateStatus !== "failed") {
        await updateDomainCertificate(domainId, {
          certificateStatus: "failed",
        });
        domainRecord.certificateStatus = "failed";
      }
    } catch (error) {
      console.error("Failed to check certificate status:", error);
      // Continue with existing status
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      ...domainRecord,
      isActive: domainRecord.cloudFrontStatus === "active",
    }),
  };
}

/**
 * Delete domain and clean up CloudFront + ACM
 */
async function deleteDomainHandler(
  projectId: string,
  userId: string,
  domainId: string
): Promise<APIGatewayProxyResultV2> {
  const domainRecord = await getDomainForUser(domainId, userId);

  if (!domainRecord) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: "Domain not found or access denied" }),
    };
  }

  // Verify domain belongs to this project
  if (domainRecord.projectId !== projectId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Domain does not belong to this project" }),
    };
  }

  // Remove from CloudFront if it was added
  if (domainRecord.cloudFrontStatus === "active") {
    try {
      await removeDomainFromCloudFront(domainRecord.domain);
    } catch (error) {
      console.error("Failed to remove domain from CloudFront:", error);
      // Continue with deletion even if CloudFront update fails
    }
  }

  // Delete ACM certificate
  if (domainRecord.certificateArn) {
    try {
      await acm.send(
        new DeleteCertificateCommand({
          CertificateArn: domainRecord.certificateArn,
        })
      );
    } catch (error) {
      console.error("Failed to delete ACM certificate:", error);
      // Continue with deletion even if ACM deletion fails
      // Certificate may be in use or already deleted
    }
  }

  // Delete from database
  await deleteDomain(domainId);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Domain deleted successfully" }),
  };
}
