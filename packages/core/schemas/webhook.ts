import { z } from "zod";

/**
 * GitHub Push Webhook Payload Schema
 *
 * Validates the payload sent by GitHub when a push event occurs.
 * Reference: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
 *
 * Only includes fields needed by our webhook handler:
 * - ref: For branch filtering (only process main branch)
 * - repository: For cloning during build
 * - after: Commit SHA for deployment record
 * - head_commit: Commit metadata (message, author) for deployment history
 */

/**
 * GitHub commit author schema
 */
const GitHubAuthorSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});

export type GitHubAuthor = z.infer<typeof GitHubAuthorSchema>;

/**
 * GitHub repository schema (minimal fields needed)
 */
const GitHubRepositorySchema = z.object({
  full_name: z.string(), // e.g., "owner/repo"
  clone_url: z.string().url(), // e.g., "https://github.com/owner/repo.git"
});

export type GitHubRepository = z.infer<typeof GitHubRepositorySchema>;

/**
 * GitHub head commit schema
 *
 * Note: Can be null for deleted branches or force-push with no commits
 */
const GitHubHeadCommitSchema = z.object({
  id: z.string(), // Full SHA
  message: z.string(), // Commit message
  timestamp: z.string(), // ISO 8601 timestamp
  author: GitHubAuthorSchema,
});

export type GitHubHeadCommit = z.infer<typeof GitHubHeadCommitSchema>;

/**
 * Full GitHub push webhook payload schema
 *
 * Validates the minimum fields required for deployment creation:
 * - ref: Branch reference (refs/heads/main)
 * - repository: Repo info for cloning
 * - after: New HEAD commit SHA after push
 * - head_commit: Commit metadata (nullable for edge cases)
 */
export const GitHubPushPayloadSchema = z.object({
  ref: z.string(), // e.g., "refs/heads/main"
  repository: GitHubRepositorySchema,
  after: z.string(), // New HEAD commit SHA
  head_commit: GitHubHeadCommitSchema.nullable(), // Can be null for deleted branches
});

export type GitHubPushPayload = z.infer<typeof GitHubPushPayloadSchema>;

/**
 * Extract branch name from ref
 *
 * @param ref - Git ref (e.g., "refs/heads/main")
 * @returns Branch name (e.g., "main")
 */
export function extractBranchName(ref: string): string {
  const prefix = "refs/heads/";
  if (ref.startsWith(prefix)) {
    return ref.slice(prefix.length);
  }
  return ref;
}
