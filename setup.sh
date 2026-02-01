#!/bin/bash

# Anchor Deploy Setup Script
# This script configures and deploys the Anchor Deploy platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Banner
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         ANCHOR DEPLOY SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Default values
STAGE="${STAGE:-dev}"
REGION="${AWS_REGION:-ap-southeast-1}"
SKIP_PREREQ_CHECK="${SKIP_PREREQ_CHECK:-false}"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stage)
            STAGE="$2"
            shift 2
            ;;
        --region)
            REGION="$2"
            shift 2
            ;;
        --skip-prereq)
            SKIP_PREREQ_CHECK=true
            shift
            ;;
        --help)
            echo "Usage: ./setup.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --stage STAGE    Deployment stage (default: dev)"
            echo "  --region REGION  AWS region (default: ap-southeast-1)"
            echo "  --skip-prereq    Skip prerequisite checks"
            echo "  --help           Show this help message"
            echo ""
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_info "Stage: $STAGE"
log_info "Region: $REGION"
echo ""

# ============================================================
# Step 1: Check Prerequisites
# ============================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    local has_error=false

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 20 ]; then
            log_success "Node.js $(node -v) found"
        else
            log_error "Node.js 20+ required, found $(node -v)"
            has_error=true
        fi
    else
        log_error "Node.js not found. Install from https://nodejs.org/"
        has_error=true
    fi

    # Check npm
    if command -v npm &> /dev/null; then
        log_success "npm $(npm -v) found"
    else
        log_error "npm not found"
        has_error=true
    fi

    # Check AWS CLI
    if command -v aws &> /dev/null; then
        log_success "AWS CLI $(aws --version | cut -d' ' -f1 | cut -d'/' -f2) found"
    else
        log_error "AWS CLI not found. Install from https://aws.amazon.com/cli/"
        has_error=true
    fi

    # Check AWS credentials
    if aws sts get-caller-identity &> /dev/null; then
        AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
        log_success "AWS credentials configured (Account: $AWS_ACCOUNT)"
    else
        log_error "AWS credentials not configured. Run 'aws configure'"
        has_error=true
    fi

    # Check Git
    if command -v git &> /dev/null; then
        log_success "Git $(git --version | cut -d' ' -f3) found"
    else
        log_error "Git not found"
        has_error=true
    fi

    echo ""

    if [ "$has_error" = true ]; then
        log_error "Prerequisites check failed. Please install missing dependencies."
        exit 1
    fi

    log_success "All prerequisites satisfied"
    echo ""
}

if [ "$SKIP_PREREQ_CHECK" = false ]; then
    check_prerequisites
else
    log_warn "Skipping prerequisite checks"
    echo ""
fi

# ============================================================
# Step 2: Install Dependencies
# ============================================================

log_info "Installing root dependencies..."
npm install
log_success "Root dependencies installed"
echo ""

log_info "Installing dashboard dependencies..."
cd dashboard
npm install
cd ..
log_success "Dashboard dependencies installed"
echo ""

# ============================================================
# Step 3: Generate Secrets
# ============================================================

log_info "Generating secrets..."

# Generate AUTH_SECRET (32 random bytes, base64 encoded)
AUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')
log_success "Generated AUTH_SECRET"

# Generate GITHUB_WEBHOOK_SECRET (32 random bytes, hex encoded)
GITHUB_WEBHOOK_SECRET=$(openssl rand -hex 32)
log_success "Generated GITHUB_WEBHOOK_SECRET"

echo ""

# ============================================================
# Step 4: Deploy Infrastructure
# ============================================================

log_info "Deploying infrastructure to AWS..."
echo ""

# Set environment variables for SST
export AWS_REGION=$REGION
export GITHUB_WEBHOOK_SECRET=$GITHUB_WEBHOOK_SECRET

# Deploy with SST
npx sst deploy --stage $STAGE 2>&1 | tee /tmp/sst-deploy-output.txt

echo ""
log_success "Infrastructure deployed"
echo ""

# ============================================================
# Step 5: Extract Outputs
# ============================================================

log_info "Extracting deployment outputs..."

# Get outputs from SST
OUTPUTS=$(npx sst output --stage $STAGE 2>/dev/null || echo "{}")

# Try to extract values (this depends on SST output format)
# Fallback to parsing the deploy output
WEBHOOK_URL=$(echo "$OUTPUTS" | grep -i "webhook" | head -1 | awk '{print $NF}' || echo "")
API_URL=$(echo "$OUTPUTS" | grep -i "api" | head -1 | awk '{print $NF}' || echo "")
CLOUDFRONT_URL=$(echo "$OUTPUTS" | grep -i "cloudfront\|distribution" | head -1 | awk '{print $NF}' || echo "")

# If outputs are empty, provide instructions
if [ -z "$API_URL" ]; then
    log_warn "Could not automatically extract API URL"
    log_info "Run 'npx sst output --stage $STAGE' to see all outputs"
fi

echo ""

# ============================================================
# Step 6: Configure Dashboard
# ============================================================

log_info "Configuring dashboard..."

# Create .env.local for dashboard
cat > dashboard/.env.local << EOF
# Anchor Deploy Dashboard Configuration
# Generated by setup.sh on $(date)

# Auth.js secret for session encryption (required)
AUTH_SECRET=$AUTH_SECRET

# API Gateway URL for backend calls
# Update this with the actual API Gateway URL from SST outputs
API_GATEWAY_URL=${API_URL:-https://your-api-gateway-url.execute-api.$REGION.amazonaws.com}

# Optional: Enable debug mode
# AUTH_DEBUG=true
EOF

log_success "Created dashboard/.env.local"
echo ""

# ============================================================
# Step 7: Create Admin User Script
# ============================================================

log_info "Creating admin user setup script..."

cat > create-admin-user.sh << 'SCRIPT'
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

# Get table name
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'UsersTable')]" --output text | head -1)

if [ -z "$TABLE_NAME" ]; then
    echo "Error: Could not find UsersTable in DynamoDB"
    exit 1
fi

echo "Creating user in table: $TABLE_NAME"

# Create user in DynamoDB
aws dynamodb put-item \
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
SCRIPT

chmod +x create-admin-user.sh
log_success "Created create-admin-user.sh"
echo ""

# ============================================================
# Step 8: Create Configuration Summary
# ============================================================

log_info "Creating configuration summary..."

cat > SETUP-CONFIG.md << EOF
# Anchor Deploy Configuration

Generated: $(date)
Stage: $STAGE
Region: $REGION
AWS Account: $AWS_ACCOUNT

## Secrets (Keep These Safe!)

\`\`\`
AUTH_SECRET=$AUTH_SECRET
GITHUB_WEBHOOK_SECRET=$GITHUB_WEBHOOK_SECRET
\`\`\`

## AWS Resources

After deployment, run \`npx sst output --stage $STAGE\` to see:
- Webhook URL (for GitHub)
- API Gateway URL (for dashboard)
- CloudFront URL (for deployed sites)

## Dashboard Configuration

File: \`dashboard/.env.local\`

Update \`API_GATEWAY_URL\` with the actual value from SST outputs.

## GitHub Webhook Configuration

1. Go to your GitHub repository → Settings → Webhooks
2. Add webhook:
   - Payload URL: \`<Webhook URL from SST outputs>\`
   - Content type: \`application/json\`
   - Secret: \`$GITHUB_WEBHOOK_SECRET\`
   - Events: Just the push event

## Next Steps

1. Create admin user:
   \`\`\`bash
   ./create-admin-user.sh admin@example.com YourSecurePassword
   \`\`\`

2. Start the dashboard:
   \`\`\`bash
   cd dashboard
   npm run dev
   \`\`\`

3. Log in and add your first site

4. Configure GitHub webhook on your repository

5. Push to main branch to trigger first deployment
EOF

log_success "Created SETUP-CONFIG.md"
echo ""

# ============================================================
# Complete!
# ============================================================

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "         SETUP COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log_success "Anchor Deploy has been configured!"
echo ""
echo "Important files created:"
echo "  • dashboard/.env.local     - Dashboard configuration"
echo "  • create-admin-user.sh     - Script to create admin user"
echo "  • SETUP-CONFIG.md          - Full configuration reference"
echo ""
echo "Next steps:"
echo ""
echo "  1. Get deployment outputs:"
echo "     ${BLUE}npx sst output --stage $STAGE${NC}"
echo ""
echo "  2. Update dashboard/.env.local with API_GATEWAY_URL"
echo ""
echo "  3. Create an admin user:"
echo "     ${BLUE}./create-admin-user.sh admin@example.com YourPassword${NC}"
echo ""
echo "  4. Start the dashboard:"
echo "     ${BLUE}cd dashboard && npm run dev${NC}"
echo ""
echo "  5. Configure GitHub webhook (see SETUP-CONFIG.md)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
