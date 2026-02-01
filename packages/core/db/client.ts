import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * DynamoDB Client Configuration
 *
 * Configured for AWS Singapore region (ap-southeast-1).
 * Uses DynamoDB DocumentClient for simplified JSON document operations.
 */
const client = new DynamoDBClient({
  region: "ap-southeast-1",
});

/**
 * DynamoDB Document Client
 *
 * Provides simpler interface for:
 * - Automatic marshalling/unmarshalling of JavaScript objects
 * - Native JavaScript types instead of DynamoDB attribute types
 */
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    // Remove undefined values from objects
    removeUndefinedValues: true,
    // Convert empty strings to null (DynamoDB doesn't support empty strings)
    convertEmptyValues: true,
  },
  unmarshallOptions: {
    // Return numbers as native JavaScript numbers (not strings)
    wrapNumbers: false,
  },
});

/**
 * Table names (set at runtime from SST outputs)
 *
 * In Lambda functions, these are injected via environment variables.
 * For local development, they can be mocked or set via .env.
 */
export const PROJECTS_TABLE = process.env.PROJECTS_TABLE ?? "Projects";
export const DEPLOYMENTS_TABLE = process.env.DEPLOYMENTS_TABLE ?? "Deployments";
