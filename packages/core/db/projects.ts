import {
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { nanoid } from "nanoid";

import { docClient, PROJECTS_TABLE } from "./client.js";
import {
  ProjectSchema,
  CreateProjectSchema,
  UpdateProjectSchema,
  type Project,
  type CreateProjectInput,
  type UpdateProjectInput,
} from "../schemas/project.js";

/**
 * Projects Data Access Layer
 *
 * All operations enforce userId filtering for multi-tenant isolation.
 * Never use scan() without userId filter.
 */

/**
 * Get a project by ID with ownership verification
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @returns The project if found and owned by user, null otherwise
 * @throws Error if projectId or userId is missing
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<Project | null> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: PROJECTS_TABLE,
      Key: { projectId },
    })
  );

  if (!result.Item) {
    return null;
  }

  // Verify ownership (row-level security)
  if (result.Item["userId"] !== userId) {
    // Return null instead of throwing to prevent information leakage
    // (don't reveal that project exists but belongs to another user)
    return null;
  }

  return ProjectSchema.parse(result.Item);
}

/**
 * List all projects for a user
 *
 * Uses UserIdIndex GSI for efficient querying.
 *
 * @param userId - The user's unique ID
 * @returns Array of projects owned by the user
 */
export async function listUserProjects(userId: string): Promise<Project[]> {
  if (!userId) {
    throw new Error("userId is required");
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: PROJECTS_TABLE,
      IndexName: "UserIdIndex",
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    })
  );

  // Parse and validate each item
  return (result.Items ?? []).map((item) => ProjectSchema.parse(item));
}

/**
 * Create a new project
 *
 * Auto-generates: projectId, createdAt, updatedAt
 *
 * @param userId - The owner's user ID
 * @param input - Project creation data (name, repoUrl, branch, etc.)
 * @returns The created project
 */
export async function createProject(
  userId: string,
  input: CreateProjectInput
): Promise<Project> {
  if (!userId) {
    throw new Error("userId is required");
  }

  // Validate input
  const validatedInput = CreateProjectSchema.parse(input);

  const now = new Date().toISOString();
  const project: Project = {
    projectId: nanoid(),
    userId,
    ...validatedInput,
    createdAt: now,
    updatedAt: now,
  };

  // Validate full project before saving
  const validatedProject = ProjectSchema.parse(project);

  await docClient.send(
    new PutCommand({
      TableName: PROJECTS_TABLE,
      Item: validatedProject,
      // Prevent overwriting existing project
      ConditionExpression: "attribute_not_exists(projectId)",
    })
  );

  return validatedProject;
}

/**
 * Update a project with ownership verification
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @param input - Fields to update
 * @returns The updated project
 * @throws Error if project not found or not owned by user
 */
export async function updateProject(
  projectId: string,
  userId: string,
  input: UpdateProjectInput
): Promise<Project> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  // Validate input
  const validatedInput = UpdateProjectSchema.parse(input);

  // Build update expression dynamically
  const updateExpressions: string[] = ["#updatedAt = :updatedAt"];
  const expressionAttributeNames: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#userId": "userId",
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
    ":userId": userId,
  };

  // Add each field to update
  for (const [key, value] of Object.entries(validatedInput)) {
    if (value !== undefined) {
      const attrName = `#${key}`;
      const attrValue = `:${key}`;
      updateExpressions.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    }
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: PROJECTS_TABLE,
      Key: { projectId },
      UpdateExpression: `SET ${updateExpressions.join(", ")}`,
      // Verify ownership (row-level security)
      ConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    throw new Error("Project not found or access denied");
  }

  return ProjectSchema.parse(result.Attributes);
}

/**
 * Delete a project with ownership verification
 *
 * @param projectId - The project's unique ID
 * @param userId - The user making the request (for ownership verification)
 * @throws Error if project not found or not owned by user
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<void> {
  if (!projectId || !userId) {
    throw new Error("projectId and userId are required");
  }

  await docClient.send(
    new DeleteCommand({
      TableName: PROJECTS_TABLE,
      Key: { projectId },
      // Verify ownership before deletion
      ConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    })
  );
}
