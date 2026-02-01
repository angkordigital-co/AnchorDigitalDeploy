#!/bin/bash

# Test script for environment variables and logs API
# Plan 01-04: Environment Variables & Log Streaming

set -e

API_URL="https://ksha1s4pnc.execute-api.ap-southeast-1.amazonaws.com"
PROJECTS_TABLE="anchor-deploy-dev-ProjectsTable-cwdhxuwt"
DEPLOYMENTS_TABLE="anchor-deploy-dev-DeploymentsTable-sdhkosws"
TEST_USER="test-user"
TEST_PROJECT="test-project-$(date +%s)"

echo "=== Environment Variables & Logs API Test ==="
echo "API URL: $API_URL"
echo "Test Project: $TEST_PROJECT"
echo ""

# Step 1: Create a test project in DynamoDB
echo "1. Creating test project..."
aws dynamodb put-item \
  --table-name "$PROJECTS_TABLE" \
  --item '{
    "projectId": {"S": "'$TEST_PROJECT'"},
    "userId": {"S": "'$TEST_USER'"},
    "name": {"S": "test-project"},
    "repoUrl": {"S": "https://github.com/test/test.git"},
    "branch": {"S": "main"},
    "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
    "updatedAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"},
    "envVars": {"L": []}
  }' \
  --region ap-southeast-1

echo "   Project created: $TEST_PROJECT"
echo ""

# Step 2: Test PUT /projects/{projectId}/env
echo "2. Setting environment variables..."
curl -s -X PUT "$API_URL/projects/$TEST_PROJECT/env" \
  -H "Content-Type: application/json" \
  -H "x-user-id: $TEST_USER" \
  -d '{
    "envVars": [
      {"key": "NEXT_PUBLIC_API_URL", "value": "https://api.example.com", "isSecret": false},
      {"key": "NEXT_PUBLIC_SITE_NAME", "value": "Test Site", "isSecret": false},
      {"key": "API_KEY", "value": "secret-key-123", "isSecret": true}
    ]
  }' | jq .
echo ""

# Step 3: Test GET /projects/{projectId}/env
echo "3. Getting environment variables..."
curl -s "$API_URL/projects/$TEST_PROJECT/env" \
  -H "x-user-id: $TEST_USER" | jq .
echo ""

# Step 4: Verify env vars in DynamoDB
echo "4. Verifying in DynamoDB..."
aws dynamodb get-item \
  --table-name "$PROJECTS_TABLE" \
  --key '{"projectId": {"S": "'$TEST_PROJECT'"}}' \
  --projection-expression "envVars" \
  --region ap-southeast-1 | jq .
echo ""

# Step 5: Create a test deployment for logs testing
echo "5. Creating test deployment..."
TEST_DEPLOYMENT="test-deploy-$(date +%s)"
aws dynamodb put-item \
  --table-name "$DEPLOYMENTS_TABLE" \
  --item '{
    "projectId": {"S": "'$TEST_PROJECT'"},
    "deploymentId": {"S": "'$TEST_DEPLOYMENT'"},
    "userId": {"S": "'$TEST_USER'"},
    "status": {"S": "queued"},
    "commitSha": {"S": "abc123def456"},
    "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
  }' \
  --region ap-southeast-1

echo "   Deployment created: $TEST_DEPLOYMENT"
echo ""

# Step 6: Test GET /deployments/{deploymentId}/logs (no build yet)
echo "6. Getting logs (before build starts)..."
curl -s "$API_URL/deployments/$TEST_DEPLOYMENT/logs" | jq .
echo ""

# Step 7: Test with access denied (wrong user)
echo "7. Testing access control..."
curl -s "$API_URL/projects/$TEST_PROJECT/env" \
  -H "x-user-id: wrong-user" | jq .
echo ""

# Cleanup
echo "8. Cleaning up test data..."
aws dynamodb delete-item \
  --table-name "$PROJECTS_TABLE" \
  --key '{"projectId": {"S": "'$TEST_PROJECT'"}}' \
  --region ap-southeast-1

aws dynamodb delete-item \
  --table-name "$DEPLOYMENTS_TABLE" \
  --key '{"projectId": {"S": "'$TEST_PROJECT'"}, "deploymentId": {"S": "'$TEST_DEPLOYMENT'"}}' \
  --region ap-southeast-1

echo "   Cleanup complete"
echo ""
echo "=== Test Complete ==="
