/**
 * DynamoDB Query Functions for Dashboard
 *
 * Server-side functions to query projects and deployments.
 * Uses GSIs for efficient multi-tenant queries.
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import { Project, Deployment } from "./types";

// DynamoDB client setup
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});
const dynamodb = DynamoDBDocumentClient.from(client);

// Table names from environment
const PROJECTS_TABLE_NAME = process.env.PROJECTS_TABLE_NAME || "";
const DEPLOYMENTS_TABLE_NAME = process.env.DEPLOYMENTS_TABLE_NAME || "";

/**
 * Get all projects for a user
 *
 * Uses UserIdIndex GSI on ProjectsTable for efficient lookup.
 * Returns projects sorted by createdAt descending.
 */
export async function getUserProjects(userId: string): Promise<Project[]> {
  const command = new QueryCommand({
    TableName: PROJECTS_TABLE_NAME,
    IndexName: "UserIdIndex",
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
    ScanIndexForward: false, // Most recent first
  });

  const result = await dynamodb.send(command);
  return (result.Items || []) as Project[];
}

/**
 * Get a single project by ID
 *
 * Returns null if project doesn't exist.
 */
export async function getProject(projectId: string): Promise<Project | null> {
  const command = new GetCommand({
    TableName: PROJECTS_TABLE_NAME,
    Key: { projectId },
  });

  const result = await dynamodb.send(command);
  return (result.Item as Project) || null;
}

/**
 * Get deployments for a project
 *
 * Uses ProjectIdIndex GSI on DeploymentsTable.
 * Returns up to 50 most recent deployments.
 */
export async function getProjectDeployments(
  projectId: string,
  limit: number = 50
): Promise<Deployment[]> {
  const command = new QueryCommand({
    TableName: DEPLOYMENTS_TABLE_NAME,
    IndexName: "ProjectIdIndex",
    KeyConditionExpression: "projectId = :projectId",
    ExpressionAttributeValues: {
      ":projectId": projectId,
    },
    ScanIndexForward: false, // Most recent first
    Limit: limit,
  });

  const result = await dynamodb.send(command);
  return (result.Items || []) as Deployment[];
}

/**
 * Get a single deployment by ID
 *
 * Returns null if deployment doesn't exist.
 */
export async function getDeployment(
  deploymentId: string
): Promise<Deployment | null> {
  const command = new GetCommand({
    TableName: DEPLOYMENTS_TABLE_NAME,
    Key: { deploymentId },
  });

  const result = await dynamodb.send(command);
  return (result.Item as Deployment) || null;
}

/**
 * Get the latest successful deployment for a project
 *
 * Used for rollback to find previous successful versions.
 */
export async function getLatestSuccessfulDeployment(
  projectId: string
): Promise<Deployment | null> {
  const command = new QueryCommand({
    TableName: DEPLOYMENTS_TABLE_NAME,
    IndexName: "ProjectIdIndex",
    KeyConditionExpression: "projectId = :projectId",
    FilterExpression: "#status = :status",
    ExpressionAttributeNames: {
      "#status": "status",
    },
    ExpressionAttributeValues: {
      ":projectId": projectId,
      ":status": "success",
    },
    ScanIndexForward: false, // Most recent first
    Limit: 1,
  });

  const result = await dynamodb.send(command);
  return (result.Items?.[0] as Deployment) || null;
}
