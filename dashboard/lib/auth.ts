/**
 * Auth.js v5 Configuration for Anchor Deploy Dashboard
 *
 * Uses Credentials provider with DynamoDB-backed user storage.
 * Passwords are verified using bcrypt.compare.
 *
 * Session strategy: JWT (serverless-friendly)
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";

// DynamoDB client for user queries
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Users table name from environment
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME || "";

/**
 * User type stored in DynamoDB UsersTable
 */
interface DbUser {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  githubUserId?: string;
  githubUsername?: string;
  githubAccessToken?: string;
  githubTokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get user by userId for checking GitHub connection status
 */
async function getUserById(userId: string): Promise<DbUser | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { userId },
    })
  );
  return result.Item as DbUser | null;
}

/**
 * Look up user by email using EmailIndex GSI
 */
async function getUserByEmail(email: string): Promise<DbUser | null> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: USERS_TABLE_NAME,
      IndexName: "EmailIndex",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: {
        ":email": email.toLowerCase(),
      },
      Limit: 1,
    })
  );

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  return result.Items[0] as DbUser;
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Look up user by email
        const user = await getUserByEmail(email);
        if (!user) {
          return null;
        }

        // Verify password with bcrypt
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        if (!isValidPassword) {
          return null;
        }

        // Return user object for session
        return {
          id: user.userId,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // On sign in, add userId to token
      if (user) {
        token.userId = user.id;
      }
      // Refresh GitHub connection status on sign in or update
      if ((user || trigger === "update") && token.userId && typeof token.userId === "string") {
        const dbUser = await getUserById(token.userId);
        if (dbUser) {
          token.hasGitHubConnection = !!dbUser.githubAccessToken;
          token.githubUsername = dbUser.githubUsername;
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Expose userId and GitHub status in session
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        session.user.hasGitHubConnection = (token.hasGitHubConnection as boolean | undefined) ?? false;
        session.user.githubUsername = token.githubUsername as string | undefined;
      }
      return session;
    },
  },
});
