#!/bin/bash

# Create Admin User for Anchor Deploy
# Usage: ./create-admin-user.sh <email> <password>

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: ./create-admin-user.sh <email> <password>"
    echo "Example: ./create-admin-user.sh admin@example.com MySecurePassword123"
    exit 1
fi

EMAIL="$1"
PASSWORD="$2"
STAGE="${STAGE:-dev}"

# Generate password hash using Node.js (bcrypt)
HASH=$(node -e "
const crypto = require('crypto');
const bcrypt = require('bcryptjs') || require('bcrypt');
const hash = bcrypt.hashSync('$PASSWORD', 10);
console.log(hash);
" 2>/dev/null || node -e "
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update('$PASSWORD').digest('hex');
console.log(hash);
")

# Generate user ID
USER_ID="user-$(openssl rand -hex 4)"

# Get table name (use Singapore region)
TABLE_NAME=$(aws dynamodb list-tables --region ap-southeast-1 --query "TableNames[?contains(@, 'UsersTable')]" --output text | head -1)

if [ -z "$TABLE_NAME" ]; then
    echo "Error: Could not find UsersTable in DynamoDB"
    exit 1
fi

echo "Creating user in table: $TABLE_NAME"

# Create user in DynamoDB
aws dynamodb put-item \
    --region ap-southeast-1 \
    --table-name "$TABLE_NAME" \
    --item "{
        \"userId\": {\"S\": \"$USER_ID\"},
        \"email\": {\"S\": \"$EMAIL\"},
        \"passwordHash\": {\"S\": \"$HASH\"},
        \"createdAt\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"},
        \"updatedAt\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}
    }"

echo ""
echo "Admin user created successfully!"
echo "  Email: $EMAIL"
echo "  User ID: $USER_ID"
echo ""
echo "You can now log in to the dashboard."
