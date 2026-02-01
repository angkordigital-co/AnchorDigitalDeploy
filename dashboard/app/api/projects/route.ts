/**
 * Projects API Route
 *
 * POST /api/projects - Create a new project
 */
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-southeast-1",
});
const dynamodb = DynamoDBDocumentClient.from(client);

const PROJECTS_TABLE_NAME = process.env.PROJECTS_TABLE_NAME || "";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, repoUrl } = body;

    if (!name || !repoUrl) {
      return NextResponse.json(
        { error: "Name and repository URL are required" },
        { status: 400 }
      );
    }

    // Parse GitHub URL to extract owner and repo
    const githubMatch = repoUrl.match(
      /github\.com[/:]([^/]+)\/([^/.]+)/
    );

    if (!githubMatch) {
      return NextResponse.json(
        { error: "Invalid GitHub repository URL" },
        { status: 400 }
      );
    }

    const repoOwner = githubMatch[1];
    const repoName = githubMatch[2].replace(/\.git$/, "");

    // Generate project ID and webhook secret
    const projectId = `proj-${crypto.randomBytes(8).toString("hex")}`;
    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const now = new Date().toISOString();

    const project = {
      projectId,
      userId: session.user.id,
      name,
      repoUrl,
      repoOwner,
      repoName,
      defaultBranch: body.defaultBranch || "main",
      webhookSecret,
      envVars: {},
      createdAt: now,
      updatedAt: now,
    };

    await dynamodb.send(
      new PutCommand({
        TableName: PROJECTS_TABLE_NAME,
        Item: project,
      })
    );

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
