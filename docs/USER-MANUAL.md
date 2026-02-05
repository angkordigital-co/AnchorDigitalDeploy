# Anchor Deploy User Manual

A comprehensive guide to using Anchor Deploy, the self-hosted serverless deployment platform for Next.js applications.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation & Setup](#installation--setup)
3. [Configuration](#configuration)
4. [Getting Started](#getting-started)
5. [Authentication](#authentication)
6. [Settings](#settings)
7. [Managing Sites](#managing-sites)
8. [Deployments](#deployments)
9. [Environment Variables](#environment-variables)
10. [Custom Domains](#custom-domains)
11. [Logs](#logs)
12. [Metrics](#metrics)
13. [Costs](#costs)
14. [Troubleshooting](#troubleshooting)

---

## Overview

Anchor Deploy is a self-hosted deployment platform that automatically builds and deploys your Next.js applications to AWS. When you push code to your main branch, Anchor Deploy:

1. Receives the webhook from GitHub
2. Clones your repository
3. Runs `npm install` and `next build`
4. Packages the output using OpenNext for Lambda
5. Deploys to AWS Lambda with zero-downtime updates
6. Serves your site via CloudFront CDN

### Key Features

- **Automatic deployments**: Push to main, get deployed
- **Zero-downtime updates**: Lambda alias switching ensures no interruption
- **Instant rollback**: Revert to any previous deployment in under 1 second
- **Custom domains**: Add your own domains with automatic SSL
- **Environment variables**: Securely manage build and runtime configuration
- **Full observability**: View logs, performance metrics, and cost breakdown

### Architecture

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Build Pipeline | CodeBuild + SQS | Compiles and packages Next.js apps |
| Server-Side Rendering | Lambda | Handles dynamic pages and API routes |
| Static Assets | S3 + CloudFront | Serves images, CSS, JS at edge |
| Metadata | DynamoDB | Stores projects, deployments, domains |
| SSL Certificates | ACM | Automatic certificate provisioning |

---

## Installation & Setup

This section is for **administrators** setting up Anchor Deploy for the first time.

### Prerequisites

Before installing Anchor Deploy, ensure you have:

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | Runtime for SST and dashboard |
| npm | 10+ | Package management |
| AWS CLI | 2.x | AWS resource deployment |
| Git | 2.x | Repository management |

You also need:

- **AWS Account** with permissions for Lambda, S3, DynamoDB, CloudFront, ACM, CodeBuild, SQS, CloudWatch, Cost Explorer
- **AWS CLI configured** with valid credentials (`aws configure`)

### Automated Setup (Recommended)

The setup script automates the entire installation process:

```bash
# Clone the repository
git clone https://github.com/angkordigital-co/AnchorDigitalDeploy.git
cd AnchorDigitalDeploy

# Run the setup script
./setup.sh
```

#### What the Setup Script Does

| Step | Action | Output |
|------|--------|--------|
| 1 | Check prerequisites | Validates Node.js, npm, AWS CLI, credentials |
| 2 | Install dependencies | Runs `npm install` for all packages |
| 3 | Generate secrets | Creates `AUTH_SECRET` and `GITHUB_WEBHOOK_SECRET` |
| 4 | Deploy infrastructure | Runs `npx sst deploy` to create AWS resources |
| 5 | Configure dashboard | Creates `dashboard/.env.local` with secrets |
| 6 | Create helper scripts | Generates `create-admin-user.sh` |
| 7 | Generate documentation | Creates `SETUP-CONFIG.md` reference |

#### Setup Script Options

```bash
# Default: dev stage, Singapore region
./setup.sh

# Deploy to production
./setup.sh --stage prod

# Use a different AWS region
./setup.sh --region us-east-1

# Skip prerequisite checks (if you know they pass)
./setup.sh --skip-prereq

# Show all options
./setup.sh --help
```

#### Files Created by Setup

| File | Purpose |
|------|---------|
| `dashboard/.env.local` | Dashboard configuration with secrets |
| `create-admin-user.sh` | Script to create admin users |
| `SETUP-CONFIG.md` | Complete configuration reference |

### Post-Setup Steps

After the setup script completes:

#### 1. Create an Admin User

```bash
./create-admin-user.sh admin@yourcompany.com YourSecurePassword123
```

This creates a user in DynamoDB that can log into the dashboard.

#### 2. Get Deployment Outputs

```bash
npx sst output --stage dev
```

Note the following values:

| Output | Use |
|--------|-----|
| `WebhookApiUrl` | GitHub webhook endpoint |
| `ApiGatewayUrl` | Dashboard API endpoint |
| `CloudFrontUrl` | Where sites are served |

#### 3. Update Dashboard Configuration

Edit `dashboard/.env.local` and set `API_GATEWAY_URL` to the actual value from step 2.

#### 4. Start the Dashboard

```bash
cd dashboard
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

### Manual Setup

If you prefer to set up manually without the script:

#### 1. Install Dependencies

```bash
npm install
cd dashboard && npm install && cd ..
```

#### 2. Generate Secrets

```bash
# Generate AUTH_SECRET (for session encryption)
openssl rand -base64 32

# Generate GITHUB_WEBHOOK_SECRET (for webhook validation)
openssl rand -hex 32
```

#### 3. Deploy Infrastructure

```bash
export AWS_REGION=ap-southeast-1
npx sst deploy --stage dev
```

#### 4. Configure Dashboard

Create `dashboard/.env.local`:

```env
AUTH_SECRET=<your-generated-auth-secret>
API_GATEWAY_URL=<api-gateway-url-from-sst-output>
```

#### 5. Create Admin User

Use the AWS CLI to add a user to DynamoDB:

```bash
# Get the table name
TABLE_NAME=$(aws dynamodb list-tables --query "TableNames[?contains(@, 'UsersTable')]" --output text | head -1)

# Create user (hash password first with bcrypt)
aws dynamodb put-item \
    --table-name "$TABLE_NAME" \
    --item '{
        "userId": {"S": "user-001"},
        "email": {"S": "admin@example.com"},
        "passwordHash": {"S": "<bcrypt-hash>"},
        "createdAt": {"S": "2026-02-02T00:00:00Z"}
    }'
```

---

## Configuration

### Infrastructure Configuration

Anchor Deploy uses SST Ion v3 for infrastructure-as-code. Configuration is in `sst.config.ts`.

#### AWS Region

Default region is `ap-southeast-1` (Singapore). To change:

```bash
export AWS_REGION=us-east-1
npx sst deploy --stage prod
```

#### Deployment Stages

| Stage | Purpose | Command |
|-------|---------|---------|
| `dev` | Development/testing | `npx sst deploy --stage dev` |
| `staging` | Pre-production | `npx sst deploy --stage staging` |
| `prod` | Production | `npx sst deploy --stage prod` |

Each stage creates isolated resources with stage-prefixed names.

### Dashboard Configuration

Dashboard configuration is stored in `dashboard/.env.local`:

```env
# Required: Session encryption key (32+ characters)
AUTH_SECRET=your-random-secret-key-here

# Required: Backend API endpoint
API_GATEWAY_URL=https://abc123.execute-api.ap-southeast-1.amazonaws.com

# Optional: Enable debug logging
AUTH_DEBUG=true

# Optional: GitHub OAuth (for GitHub integration feature)
GITHUB_CLIENT_ID=your-github-oauth-app-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-client-secret
```

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | Encrypts JWT session tokens. Generate with `openssl rand -base64 32` |
| `API_GATEWAY_URL` | Yes | Backend API endpoint from SST outputs |
| `AUTH_DEBUG` | No | Enable verbose auth logging |
| `GITHUB_CLIENT_ID` | No | GitHub OAuth App client ID (enables GitHub integration) |
| `GITHUB_CLIENT_SECRET` | No | GitHub OAuth App client secret |

### GitHub OAuth Setup (Optional)

To enable GitHub integration (repository selection dropdown, automatic webhook creation):

1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Click **New OAuth App**
3. Fill in:
   - **Application name**: Anchor Deploy
   - **Homepage URL**: Your dashboard URL
   - **Authorization callback URL**: `https://your-dashboard-url/api/github/callback`
4. Click **Register application**
5. Copy the **Client ID** and generate a **Client secret**
6. Add both to your `dashboard/.env.local`

### GitHub Webhook Configuration

Each repository you deploy needs a webhook configured:

1. Go to your GitHub repository
2. Navigate to **Settings → Webhooks → Add webhook**
3. Configure:

| Field | Value |
|-------|-------|
| Payload URL | `<WebhookApiUrl from SST outputs>` |
| Content type | `application/json` |
| Secret | `<GITHUB_WEBHOOK_SECRET from setup>` |
| SSL verification | Enable |
| Events | Just the push event |

4. Click **Add webhook**

#### Testing the Webhook

After adding the webhook, GitHub sends a ping event. Check the webhook's **Recent Deliveries** tab to verify it was received successfully (200 response).

### AWS Resource Configuration

#### DynamoDB Tables

| Table | Purpose | Capacity |
|-------|---------|----------|
| UsersTable | User accounts | On-demand |
| ProjectsTable | Site configurations | On-demand |
| DeploymentsTable | Deployment history | On-demand |
| DomainsTable | Custom domains | On-demand |

#### S3 Buckets

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| ArtifactsBucket | Build outputs | 90-day retention |
| LogsBucket | Build logs | 14-day to Glacier |
| StaticAssetsBucket | Static files | No expiration |

#### Lambda Functions

| Function | Purpose | Memory | Timeout |
|----------|---------|--------|---------|
| WebhookHandler | Receives GitHub webhooks | 256 MB | 30s |
| BuildOrchestrator | Manages build queue | 256 MB | 60s |
| DeployHandler | Deploys to Lambda | 512 MB | 300s |
| SSR Functions | Renders pages | 1024 MB | 30s |

### Security Configuration

#### Secrets Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| `AUTH_SECRET` | `.env.local` | Manual (rotate periodically) |
| `GITHUB_WEBHOOK_SECRET` | SST config | Manual |
| User passwords | DynamoDB (bcrypt hashed) | User-initiated |
| Site env vars (secret) | DynamoDB | Manual |

**Security recommendations**:

1. Use strong, unique secrets (32+ characters)
2. Never commit `.env.local` to git
3. Rotate secrets periodically
4. Use IAM roles with least-privilege access

#### IAM Permissions

The deployment requires these AWS permissions:

- `lambda:*` — Function management
- `s3:*` — Bucket management
- `dynamodb:*` — Table management
- `cloudfront:*` — CDN management
- `acm:*` — Certificate management
- `codebuild:*` — Build project management
- `sqs:*` — Queue management
- `logs:*` — CloudWatch Logs
- `cloudwatch:*` — Metrics
- `ce:*` — Cost Explorer (read-only)

### Updating Configuration

#### Updating Infrastructure

```bash
# Make changes to infra/*.ts files, then:
npx sst deploy --stage dev
```

SST handles incremental updates—only changed resources are modified.

#### Updating Dashboard

```bash
cd dashboard
npm run build
# Deploy to your hosting platform
```

#### Adding More Admin Users

```bash
./create-admin-user.sh newadmin@example.com NewPassword123
```

---

## Getting Started

### Prerequisites

Before using Anchor Deploy, ensure you have:

1. **A GitHub repository** with a Next.js application
2. **Dashboard credentials** provided by your administrator
3. **DNS access** (if configuring custom domains)

### Quick Start

1. Log in to the Anchor Deploy dashboard
2. Click **Add Site** to connect a GitHub repository
3. Push code to your `main` branch
4. Watch the deployment in real-time
5. Access your site via the provided CloudFront URL

---

## Authentication

### Logging In

1. Navigate to the Anchor Deploy dashboard URL
2. Enter your **email** and **password**
3. Click **Sign In**

Your session persists across browser tabs and remains active until you log out or the session expires.

### Session Management

- Sessions use JWT tokens stored securely
- Tokens auto-refresh on activity
- Log out from any page using the navigation menu

### Password Reset

Contact your administrator to reset your password. Self-service password reset is planned for a future release.

---

## Settings

The **Settings** page lets you manage your account and integrations.

### Accessing Settings

Click **Settings** in the navigation menu to access your settings page.

### GitHub Integration

Connect your GitHub account to enable streamlined site creation:

#### Connecting GitHub

1. Go to **Settings**
2. In the **Integrations** section, click **Connect** next to GitHub
3. Authorize Anchor Deploy on GitHub
4. You'll be redirected back with a success message

#### Benefits of GitHub Connection

| Feature | Without GitHub | With GitHub |
|---------|----------------|-------------|
| Repository selection | Manual URL entry | Dropdown selector |
| Webhook creation | Manual configuration | Automatic |
| Branch detection | Manual entry | Auto-detected |

#### Disconnecting GitHub

1. Go to **Settings**
2. Click **Disconnect** next to your GitHub username
3. Confirm the disconnection

**Note**: Disconnecting GitHub does not remove webhooks from your repositories. You'll need to remove those manually from GitHub if desired.

### Account Information

The Account section displays:

- Your name
- Your email address

---

## Managing Sites

The **Sites** page is your central hub for all deployed applications.

### Viewing Sites

The sites list displays:

| Column | Description |
|--------|-------------|
| **Name** | Your site name (linked to details) |
| **Repository** | GitHub repository name (e.g., `org/repo`) |
| **Status** | Current deployment status |
| **Last Deployed** | When the most recent deployment completed |

Click any site row to view its details.

### Adding a New Site

There are two ways to add a site depending on whether you've connected your GitHub account.

#### With GitHub Connected (Recommended)

1. Click the **Add Site** button
2. Select a repository from the dropdown
3. The site name, URL, and default branch are auto-filled
4. Optionally uncheck "Automatically create webhook" if you prefer manual setup
5. Click **Create Site**

The webhook is automatically created on your GitHub repository, so deployments will trigger immediately when you push to main.

#### Without GitHub Connected

1. Click the **Add Site** button
2. Enter the GitHub repository URL (e.g., `https://github.com/org/repo`)
3. Enter a site name
4. Enter the default branch (usually `main`)
5. Click **Create Site**

After creation, you'll need to:

1. Add the webhook URL to your GitHub repository settings
2. Configure any required environment variables
3. Push to main to trigger your first deployment

#### Switching Between Modes

When adding a site with GitHub connected, you can:

- Click "Enter URL manually" to switch to manual mode
- Click "Select from GitHub" to switch back to the repository dropdown

### Site Navigation

Each site has dedicated pages accessible via the sidebar:

- **Deployments** - Build history and rollback
- **Environment** - Environment variables
- **Domains** - Custom domain configuration
- **Logs** - Runtime logs and errors
- **Metrics** - Performance data
- **Costs** - AWS cost breakdown

---

## Deployments

The **Deployments** page shows your complete deployment history.

### Deployment List

Each deployment displays:

| Field | Description |
|-------|-------------|
| **Version** | Unique deployment identifier |
| **Status** | `building`, `deploying`, `live`, `failed`, `rolled-back` |
| **Commit** | Git commit SHA and message |
| **Duration** | How long the build took |
| **Deployed At** | Timestamp of completion |

### Deployment Status Flow

```
GitHub Push → Building → Deploying → Live
                ↓
              Failed
```

### Viewing Build Logs

1. Click a deployment row to expand details
2. View the real-time build output
3. See any errors or warnings from the build process

### Rollback

To revert to a previous deployment:

1. Find the deployment you want to restore
2. Click the **Rollback** button
3. Confirm the rollback

Rollback is instant (under 1 second) because it switches the Lambda alias to point to a previous version. The old deployment remains available.

**Important**: Rollback only affects the server-side code. If your rollback target requires different environment variables, update them separately.

### Automatic Deployments

Every push to your `main` branch triggers an automatic deployment:

1. GitHub sends a webhook to Anchor Deploy
2. The build enters a queue (SQS)
3. CodeBuild clones your repo and runs the build
4. On success, the new version is deployed
5. The CloudFront cache is invalidated (via TTL)

---

## Environment Variables

The **Environment** page lets you manage build-time and runtime configuration.

### Adding Variables

1. Click **Add Variable**
2. Enter the **Key** (e.g., `DATABASE_URL`)
3. Enter the **Value**
4. Check **Secret** if the value should be hidden
5. Click **Save**

### Variable Types

| Type | Visible | Use Case |
|------|---------|----------|
| **Regular** | Yes | Public configuration, feature flags |
| **Secret** | No (masked) | API keys, database credentials |

Secret variables show `••••••••` in the dashboard and cannot be copied after creation.

### Using Variables

Environment variables are available:

- **During build**: All variables are injected into the build process
- **At runtime**: Variables prefixed with `NEXT_PUBLIC_` are embedded in client bundles; all others are available server-side

### Editing Variables

1. Find the variable in the list
2. Click the **Edit** button
3. Modify the value
4. Click **Save**

**Note**: Changes to environment variables do not automatically trigger a new deployment. After updating variables, push a new commit or use the dashboard to trigger a rebuild.

### Deleting Variables

1. Find the variable in the list
2. Click the **Delete** button
3. Confirm deletion

---

## Custom Domains

The **Domains** page lets you configure custom domains with automatic SSL.

### How It Works

1. You add a domain in the dashboard
2. Anchor Deploy provisions an SSL certificate via AWS ACM
3. You configure DNS to point to CloudFront
4. ACM validates domain ownership via DNS
5. Once validated, your site is live on the custom domain

### Adding a Domain

1. Click **Add Domain**
2. Enter your domain (e.g., `www.example.com`)
3. Click **Create**

### DNS Configuration

After adding a domain, you'll see required DNS records:

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| **CNAME** | `_acme-challenge.www.example.com` | `abc123.acm-validations.aws` | SSL validation |
| **CNAME** | `www.example.com` | `d1234567.cloudfront.net` | Traffic routing |

Add these records in your DNS provider (Route 53, Cloudflare, GoDaddy, etc.).

### Domain Status

| Status | Meaning |
|--------|---------|
| **Pending Validation** | Waiting for DNS validation records |
| **Issuing Certificate** | ACM is provisioning the SSL certificate |
| **Active** | Domain is live and serving traffic |
| **Failed** | Validation failed (check DNS records) |

### Validation Time

DNS propagation can take anywhere from a few minutes to 48 hours. ACM checks periodically and will complete validation automatically once records are detected.

### Root Domains vs Subdomains

- **Subdomains** (e.g., `www.example.com`): Use CNAME records
- **Root domains** (e.g., `example.com`): Require ALIAS or ANAME records (supported by Route 53, Cloudflare, and some other providers)

### Removing a Domain

1. Find the domain in the list
2. Click **Delete**
3. Confirm removal

**Note**: Removing a domain does not delete the SSL certificate immediately. ACM certificates expire after non-use.

---

## Logs

The **Logs** page provides access to runtime logs from your Lambda functions.

### Viewing Logs

Logs are streamed from CloudWatch and display:

- **Timestamp**: When the log entry was recorded
- **Level**: `INFO`, `WARN`, `ERROR`
- **Message**: The log content
- **Request ID**: AWS request identifier for tracing

### Time Range

Filter logs by time period:

- Last 15 minutes
- Last 1 hour
- Last 6 hours
- Last 24 hours
- Last 7 days
- Custom range

### Log Levels

| Level | Color | Meaning |
|-------|-------|---------|
| **INFO** | Gray | General information |
| **WARN** | Yellow | Warning conditions |
| **ERROR** | Red | Error conditions |

### Error Aggregation

The error aggregation panel groups similar errors:

| Error | Count | Last Seen |
|-------|-------|-----------|
| `TypeError: Cannot read property 'x'` | 23 | 5 min ago |
| `Network timeout` | 8 | 1 hour ago |

Click an error group to see individual occurrences.

### Searching Logs

Use the search box to filter logs by:

- Text content
- Request ID
- Error type

### Live Tail

Enable **Live Tail** to watch logs in real-time as requests hit your site. Useful for debugging during development.

### Log Retention

Logs are retained for 14 days and then archived to S3 Glacier for long-term storage.

---

## Metrics

The **Metrics** page displays Lambda performance data from CloudWatch.

### Available Metrics

| Metric | Description |
|--------|-------------|
| **Invocations** | Total function calls per period |
| **Errors** | Failed invocations |
| **Duration (p50)** | Median response time |
| **Duration (p95)** | 95th percentile response time |
| **Duration (p99)** | 99th percentile response time |
| **Cold Starts** | Invocations that required initialization |
| **Concurrent Executions** | Peak simultaneous invocations |

### Time Periods

View metrics for:

- Last 1 hour
- Last 6 hours
- Last 24 hours
- Last 7 days
- Last 30 days

### Understanding Latency Percentiles

| Percentile | Meaning |
|------------|---------|
| **p50** | Half your requests are faster than this |
| **p95** | 95% of requests are faster than this |
| **p99** | 99% of requests are faster than this |

Focus on p95 and p99 for user experience—these represent your slowest requests.

### Cold Starts

Cold starts occur when Lambda needs to initialize a new execution environment. Expect:

- **Cold start**: 500ms - 2s additional latency
- **Warm invocation**: Baseline latency only

Tips to reduce cold starts:

- Keep function bundle size small
- Use Lambda Provisioned Concurrency (configured separately)
- Optimize imports in your Next.js pages

### Metrics Refresh

Metrics update every 5 minutes. CloudWatch aggregates data with a slight delay.

---

## Costs

The **Costs** page shows your AWS spending breakdown from Cost Explorer.

### Cost Breakdown

Costs are displayed by service:

| Service | Description |
|---------|-------------|
| **Lambda** | Function execution time and requests |
| **S3** | Storage and data transfer |
| **CloudFront** | CDN requests and data transfer |
| **DynamoDB** | Read/write capacity and storage |
| **CodeBuild** | Build minutes consumed |
| **CloudWatch** | Log storage and metrics |

### Time Periods

View costs for:

- Last 7 days
- Last 30 days
- Month-to-date
- Previous month

### Cost Allocation

Costs are tagged to your site using AWS resource tags. The breakdown shows:

- **Direct costs**: Resources allocated to this site
- **Shared costs**: Platform infrastructure (distributed)

### Data Freshness

Cost data has a **24-hour lag** from AWS Cost Explorer. Today's costs won't appear until tomorrow.

### Cost Optimization Tips

1. **Reduce bundle size**: Smaller functions = faster cold starts = less compute time
2. **Optimize images**: Use Next.js Image component with proper sizing
3. **Cache aggressively**: Let CloudFront serve cached responses
4. **Review logs**: High error rates waste compute on failed requests

---

## Troubleshooting

### Build Failures

**Symptom**: Deployment shows status `failed`

**Common causes**:

| Issue | Solution |
|-------|----------|
| Missing dependencies | Check `package.json` has all required packages |
| TypeScript errors | Run `npm run build` locally to verify |
| Missing env variables | Ensure all required variables are configured |
| Out of memory | Optimize build or contact admin for larger build instances |

**Debugging steps**:

1. Click the failed deployment to view build logs
2. Look for the first error message
3. Fix the issue in your code
4. Push a new commit

### Deployment Successful but Site Broken

**Symptom**: Build succeeded but pages show errors

**Common causes**:

| Issue | Solution |
|-------|----------|
| Missing runtime env vars | Check Environment page for required variables |
| API endpoint misconfigured | Verify `API_GATEWAY_URL` environment variable |
| Database connection | Check database credentials and network access |

**Debugging steps**:

1. Check the **Logs** page for runtime errors
2. Look for error aggregation patterns
3. Verify environment variables match production requirements

### Custom Domain Not Working

**Symptom**: Domain shows SSL error or doesn't resolve

**Checklist**:

1. Verify DNS records match exactly (case-sensitive)
2. Wait for propagation (up to 48 hours)
3. Check domain status in dashboard
4. Ensure no conflicting DNS records

**Tools**:

```bash
# Check DNS propagation
dig www.example.com CNAME

# Check SSL certificate
openssl s_client -connect www.example.com:443 -servername www.example.com
```

### High Latency

**Symptom**: Pages load slowly

**Debugging steps**:

1. Check **Metrics** page for p95/p99 duration
2. Look at cold start frequency
3. Review **Logs** for slow database queries
4. Check bundle size in build logs

**Common fixes**:

- Enable caching headers for static content
- Reduce dependencies in pages
- Use incremental static regeneration where appropriate

### CloudFront Cache Issues

**Symptom**: Old content still showing after deployment

**Cause**: CloudFront caches content at edge locations

**Solutions**:

1. Wait for TTL expiration (default: 24 hours)
2. Append version query strings to assets
3. Contact admin to manually invalidate cache

---

## Support

For assistance:

1. Check this documentation first
2. Review deployment and runtime logs
3. Contact your Anchor Deploy administrator

---

*Last updated: 2026-02-05*
*Anchor Deploy v1.1*

---

## Appendix: Quick Reference

### Setup Commands

```bash
# Full automated setup
./setup.sh

# Production setup
./setup.sh --stage prod --region ap-southeast-1

# Create admin user
./create-admin-user.sh email@example.com password

# View SST outputs
npx sst output --stage dev

# Start dashboard locally
cd dashboard && npm run dev
```

### Important Files

| File | Purpose |
|------|---------|
| `sst.config.ts` | Infrastructure entry point |
| `infra/*.ts` | AWS resource definitions |
| `dashboard/.env.local` | Dashboard secrets |
| `SETUP-CONFIG.md` | Generated configuration reference |
| `create-admin-user.sh` | Admin user creation script |

### AWS Resources Naming

Resources are named with the pattern: `anchor-deploy-{stage}-{resource}-{random}`

Example: `anchor-deploy-dev-ProjectsTable-abc123`

### Useful AWS CLI Commands

```bash
# List DynamoDB tables
aws dynamodb list-tables

# Check Lambda functions
aws lambda list-functions --query "Functions[?contains(FunctionName, 'anchor')]"

# View CloudFront distributions
aws cloudfront list-distributions

# Check CodeBuild projects
aws codebuild list-projects
```
