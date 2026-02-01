#!/bin/bash
#
# Test GitHub Webhook Signature Validation
#
# Usage: ./test-webhook.sh
#
# Prerequisites:
# - WEBHOOK_URL environment variable set (from sst deploy output)
# - WEBHOOK_SECRET environment variable set (same value used in SST secret)
#
# This script tests:
# 1. Valid signature returns 202 (or 404 if project not found)
# 2. Invalid signature returns 401
# 3. Missing signature returns 401

set -e

# Check required environment variables
if [ -z "$WEBHOOK_URL" ]; then
    echo "Error: WEBHOOK_URL environment variable not set"
    echo "Run: export WEBHOOK_URL=\$(npx sst output --stage dev webhookUrl)"
    exit 1
fi

if [ -z "$WEBHOOK_SECRET" ]; then
    echo "Error: WEBHOOK_SECRET environment variable not set"
    exit 1
fi

# Test project ID (may or may not exist)
PROJECT_ID="${PROJECT_ID:-test-project-123}"

# GitHub push webhook payload
PAYLOAD=$(cat <<EOF
{
  "ref": "refs/heads/main",
  "repository": {
    "full_name": "test/repo",
    "clone_url": "https://github.com/test/repo.git"
  },
  "after": "abc123def456abc123def456abc123def456abc1",
  "head_commit": {
    "id": "abc123def456abc123def456abc123def456abc1",
    "message": "test: verify webhook integration",
    "timestamp": "2026-02-01T00:00:00Z",
    "author": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }
}
EOF
)

# Compute HMAC-SHA256 signature
compute_signature() {
    local payload="$1"
    local secret="$2"
    echo -n "$payload" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}'
}

SIGNATURE=$(compute_signature "$PAYLOAD" "$WEBHOOK_SECRET")

echo "=================================="
echo "GitHub Webhook Integration Tests"
echo "=================================="
echo "URL: $WEBHOOK_URL/webhook/$PROJECT_ID"
echo ""

# Test 1: Valid signature
echo "Test 1: Valid signature"
echo "Expected: 202 (deployment queued) or 404 (project not found)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/$PROJECT_ID" \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "Result: PASS"
else
    echo "Result: FAIL"
fi
echo ""

# Test 2: Invalid signature
echo "Test 2: Invalid signature"
echo "Expected: 401"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/$PROJECT_ID" \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: sha256=invalid_signature_here" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "401" ]; then
    echo "Result: PASS"
else
    echo "Result: FAIL"
fi
echo ""

# Test 3: Missing signature
echo "Test 3: Missing signature header"
echo "Expected: 401"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/$PROJECT_ID" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "401" ]; then
    echo "Result: PASS"
else
    echo "Result: FAIL"
fi
echo ""

# Test 4: Non-main branch (should return 200, not processed)
echo "Test 4: Non-main branch push"
echo "Expected: 200"

FEATURE_PAYLOAD=$(cat <<EOF
{
  "ref": "refs/heads/feature/test",
  "repository": {
    "full_name": "test/repo",
    "clone_url": "https://github.com/test/repo.git"
  },
  "after": "abc123def456abc123def456abc123def456abc1",
  "head_commit": {
    "id": "abc123def456abc123def456abc123def456abc1",
    "message": "test: feature branch",
    "timestamp": "2026-02-01T00:00:00Z",
    "author": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }
}
EOF
)

FEATURE_SIGNATURE=$(compute_signature "$FEATURE_PAYLOAD" "$WEBHOOK_SECRET")

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WEBHOOK_URL/webhook/$PROJECT_ID" \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: sha256=$FEATURE_SIGNATURE" \
    -d "$FEATURE_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status: $HTTP_CODE"
echo "Body: $BODY"

if [ "$HTTP_CODE" = "200" ]; then
    echo "Result: PASS"
else
    echo "Result: FAIL"
fi
echo ""

echo "=================================="
echo "Tests complete"
echo "=================================="
