/**
 * GitHub API Client
 *
 * Wrapper around Octokit for GitHub API operations.
 * Handles token management and common operations like listing repos and creating webhooks.
 */
import { Octokit } from "@octokit/rest";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || "";

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  owner: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
}

/**
 * Get user's GitHub access token from DynamoDB
 */
export async function getGitHubToken(userId: string): Promise<string | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { userId },
      ProjectionExpression: "githubAccessToken",
    })
  );

  return result.Item?.githubAccessToken || null;
}

/**
 * Store GitHub OAuth tokens for a user
 */
export async function storeGitHubConnection(
  userId: string,
  data: {
    accessToken: string;
    githubUserId: string;
    githubUsername: string;
  }
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { userId },
      UpdateExpression:
        "SET githubAccessToken = :token, githubUserId = :ghId, githubUsername = :username, updatedAt = :now",
      ExpressionAttributeValues: {
        ":token": data.accessToken,
        ":ghId": data.githubUserId,
        ":username": data.githubUsername,
        ":now": new Date().toISOString(),
      },
    })
  );
}

/**
 * Remove GitHub connection from user
 */
export async function removeGitHubConnection(userId: string): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { userId },
      UpdateExpression:
        "REMOVE githubAccessToken, githubUserId, githubUsername, githubTokenExpiresAt SET updatedAt = :now",
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
      },
    })
  );
}

/**
 * Create an authenticated Octokit client for a user
 */
export async function createOctokitClient(userId: string): Promise<Octokit | null> {
  const token = await getGitHubToken(userId);
  if (!token) return null;

  return new Octokit({ auth: token });
}

/**
 * List repositories accessible to the user
 */
export async function listUserRepos(userId: string): Promise<GitHubRepo[]> {
  const octokit = await createOctokitClient(userId);
  if (!octokit) {
    throw new Error("GitHub not connected");
  }

  const repos: GitHubRepo[] = [];
  let page = 1;

  // Fetch all repos (paginated)
  while (true) {
    const response = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
      sort: "updated",
      direction: "desc",
    });

    if (response.data.length === 0) break;

    repos.push(
      ...response.data.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        name: repo.name,
        owner: repo.owner.login,
        default_branch: repo.default_branch || "main",
        private: repo.private,
        html_url: repo.html_url,
      }))
    );

    if (response.data.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Get the authenticated GitHub user
 */
export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.users.getAuthenticated();

  return {
    id: data.id,
    login: data.login,
    name: data.name,
    avatar_url: data.avatar_url,
  };
}

/**
 * Create a webhook for a repository
 */
export async function createWebhook(
  userId: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  webhookSecret: string
): Promise<{ id: number; success: boolean; error?: string }> {
  const octokit = await createOctokitClient(userId);
  if (!octokit) {
    return { id: 0, success: false, error: "GitHub not connected" };
  }

  try {
    const response = await octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url: webhookUrl,
        content_type: "json",
        secret: webhookSecret,
      },
      events: ["push"],
      active: true,
    });

    return { id: response.data.id, success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to create webhook for ${owner}/${repo}:`, message);
    return { id: 0, success: false, error: message };
  }
}

/**
 * Delete a webhook from a repository
 */
export async function deleteWebhook(
  userId: string,
  owner: string,
  repo: string,
  webhookId: number
): Promise<boolean> {
  const octokit = await createOctokitClient(userId);
  if (!octokit) return false;

  try {
    await octokit.repos.deleteWebhook({
      owner,
      repo,
      hook_id: webhookId,
    });
    return true;
  } catch (error) {
    console.error(`Failed to delete webhook ${webhookId}:`, error);
    return false;
  }
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
} | null> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!response.ok) {
    console.error("GitHub token exchange failed:", response.status);
    return null;
  }

  const data = await response.json();

  if (data.error) {
    console.error("GitHub OAuth error:", data.error_description);
    return null;
  }

  return data;
}

/**
 * Generate the GitHub OAuth authorization URL
 */
export function getGitHubAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || "",
    redirect_uri: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/github/callback`,
    scope: "repo",
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}
