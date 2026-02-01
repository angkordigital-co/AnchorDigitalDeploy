import { z } from "zod";

/**
 * Domain Schema
 *
 * Represents a custom domain configured for a project.
 * Handles ACM certificate provisioning and DNS validation.
 *
 * Phase 2, Plan 03: Custom Domain Support
 */

/**
 * Certificate status enum
 *
 * Flow: pending_validation -> issued | failed
 */
export const CertificateStatus = z.enum([
  "pending_validation", // ACM certificate requested, waiting for DNS validation
  "issued", // Certificate validated and issued by ACM
  "failed", // Certificate validation failed (DNS not configured, timeout, etc.)
]);

export type CertificateStatus = z.infer<typeof CertificateStatus>;

/**
 * CloudFront integration status
 *
 * Flow: pending -> active | failed
 */
export const CloudFrontStatus = z.enum([
  "pending", // Waiting for certificate validation before adding to CloudFront
  "active", // Domain added to CloudFront distribution with ACM certificate
  "failed", // Failed to add domain to CloudFront
]);

export type CloudFrontStatus = z.infer<typeof CloudFrontStatus>;

/**
 * DNS validation record for ACM certificate
 */
export const DnsValidationSchema = z.object({
  /**
   * DNS record name (CNAME)
   * Example: _abc123.example.com
   */
  name: z.string(),
  /**
   * DNS record value (CNAME target)
   * Example: _xyz789.acm-validations.aws.
   */
  value: z.string(),
  /**
   * DNS record type (always CNAME for ACM validation)
   */
  type: z.literal("CNAME"),
});

export type DnsValidation = z.infer<typeof DnsValidationSchema>;

/**
 * Full Domain schema
 */
export const DomainSchema = z.object({
  /**
   * Unique domain identifier (nanoid)
   */
  domainId: z.string().min(1, "Domain ID is required"),
  /**
   * Project this domain belongs to
   */
  projectId: z.string().min(1, "Project ID is required"),
  /**
   * User who owns this domain (inherited from project for tenant isolation)
   */
  userId: z.string().min(1, "User ID is required"),
  /**
   * Custom domain name
   * Example: mysite.example.com
   */
  domain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/,
      "Invalid domain format"
    ),
  /**
   * ACM certificate ARN (issued for this domain)
   */
  certificateArn: z.string().optional(),
  /**
   * Certificate status
   */
  certificateStatus: CertificateStatus.optional(),
  /**
   * CloudFront distribution integration status
   */
  cloudFrontStatus: CloudFrontStatus.optional(),
  /**
   * DNS validation record (for user to add to their DNS)
   */
  dnsValidation: DnsValidationSchema.optional(),
  /**
   * When domain was created
   */
  createdAt: z.number(),
  /**
   * When domain was last updated
   */
  updatedAt: z.number(),
});

export type Domain = z.infer<typeof DomainSchema>;

/**
 * Schema for creating a new domain
 * Auto-generates: domainId, createdAt, updatedAt
 */
export const CreateDomainSchema = z.object({
  projectId: DomainSchema.shape.projectId,
  domain: DomainSchema.shape.domain,
});

export type CreateDomainInput = z.infer<typeof CreateDomainSchema>;

/**
 * Schema for updating a domain
 * Used to update certificate status, CloudFront status, and DNS validation info
 */
export const UpdateDomainSchema = z.object({
  certificateArn: DomainSchema.shape.certificateArn,
  certificateStatus: DomainSchema.shape.certificateStatus,
  cloudFrontStatus: DomainSchema.shape.cloudFrontStatus,
  dnsValidation: DomainSchema.shape.dnsValidation,
});

export type UpdateDomainInput = z.infer<typeof UpdateDomainSchema>;
