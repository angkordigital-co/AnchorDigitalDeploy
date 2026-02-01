# Anchor Deploy

A self-hosted serverless deployment platform for Next.js applications on AWS. Push to main, get deployed automatically with zero-downtime updates and instant rollback.

## Features

- **Automatic Deployments** — Push to main branch triggers build and deploy
- **Zero-Downtime Updates** — Lambda alias switching ensures no interruption
- **Instant Rollback** — Revert to any previous deployment in under 1 second
- **Custom Domains** — Add your own domains with automatic SSL via ACM
- **Environment Variables** — Securely manage build-time and runtime config
- **Full Observability** — View logs, performance metrics, and AWS cost breakdown
- **Web Dashboard** — Manage all sites from a single interface

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   GitHub    │────▶│  API Gateway │────▶│     SQS     │────▶│  CodeBuild  │
│   Webhook   │     │   Webhook    │     │    Queue    │     │   Builder   │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  CloudFront │◀────│   Lambda    │◀────│  S3 Bucket  │◀────│  OpenNext   │
│     CDN     │     │    SSR      │     │  Artifacts  │     │  Packaging  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### AWS Services Used

| Service | Purpose |
|---------|---------|
| **Lambda** | Server-side rendering and API routes |
| **S3** | Build artifacts and static assets |
| **CloudFront** | CDN with global edge caching |
| **DynamoDB** | Projects, deployments, domains metadata |
| **CodeBuild** | Build pipeline execution |
| **SQS** | Build queue management |
| **ACM** | SSL certificate provisioning |
| **CloudWatch** | Logs and performance metrics |
| **Cost Explorer** | Per-site cost breakdown |

## Tech Stack

- **Infrastructure**: SST Ion v3 (TypeScript IaC)
- **Runtime**: Node.js 20 on AWS Lambda
- **Packaging**: OpenNext (Next.js to Lambda adapter)
- **Dashboard**: Next.js 16 + Auth.js v5 + shadcn/ui
- **Database**: DynamoDB (serverless, no connection pooling)
- **Region**: ap-southeast-1 (Singapore)

## Project Structure

```
.
├── infra/                  # SST infrastructure definitions
│   ├── database.ts         # DynamoDB tables
│   ├── storage.ts          # S3 buckets
│   ├── webhooks.ts         # API Gateway + webhook handler
│   ├── build-pipeline.ts   # SQS + CodeBuild
│   └── deployment.ts       # Lambda + CloudFront
├── packages/
│   ├── core/               # Shared types and utilities
│   └── functions/          # Lambda function handlers
│       ├── webhook.ts      # GitHub webhook receiver
│       ├── build-orchestrator.ts
│       ├── deploy-handler.ts
│       ├── rollback-handler.ts
│       ├── domains-handler.ts
│       ├── logs-handler.ts
│       ├── metrics-handler.ts
│       └── costs-handler.ts
├── dashboard/              # Next.js management dashboard
│   ├── app/                # App Router pages
│   ├── components/         # React components (shadcn/ui)
│   └── lib/                # Auth, API clients, utilities
├── buildspecs/             # CodeBuild build specifications
├── docs/                   # Documentation
│   └── USER-MANUAL.md      # End-user documentation
└── sst.config.ts           # SST configuration entry point
```

## Prerequisites

- Node.js 20+
- AWS CLI configured with appropriate credentials
- AWS account with permissions for Lambda, S3, DynamoDB, CloudFront, ACM, CodeBuild, SQS
- GitHub repository with Next.js application

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/angkordigital-co/AnchorDigitalDeploy.git
cd AnchorDigitalDeploy
npm install
```

### 2. Configure AWS

Ensure your AWS CLI is configured:

```bash
aws configure
# Set region to ap-southeast-1
```

### 3. Deploy Infrastructure

```bash
npx sst dev      # Development mode with live reload
# or
npx sst deploy   # Production deployment
```

### 4. Set Up Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### 5. Configure GitHub Webhook

Add a webhook to your GitHub repository:

- **URL**: Your API Gateway webhook endpoint
- **Content type**: `application/json`
- **Secret**: Your configured webhook secret
- **Events**: Push events

## Environment Variables

### Infrastructure

| Variable | Description |
|----------|-------------|
| `AWS_REGION` | AWS region (default: ap-southeast-1) |
| `GITHUB_WEBHOOK_SECRET` | Secret for validating GitHub webhooks |

### Dashboard

| Variable | Description |
|----------|-------------|
| `AUTH_SECRET` | Auth.js session encryption key |
| `API_GATEWAY_URL` | Backend API endpoint |

## Deployment

### Development

```bash
npx sst dev
```

Live development mode with hot reload for Lambda functions.

### Production

```bash
npx sst deploy --stage prod
```

## Documentation

- [User Manual](docs/USER-MANUAL.md) — End-user guide for the dashboard

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Serverless over containers | Pay-per-use pricing, no idle costs |
| Lambda aliases for deployments | Instant rollback via alias switch (<1s) |
| DynamoDB over PostgreSQL | No connection pooling, scales naturally |
| OpenNext for packaging | Standard Next.js to Lambda adapter |
| ACM in us-east-1 | CloudFront requires certificates in us-east-1 |

## Known Limitations

- **GitHub only** — GitLab/Bitbucket not supported in v1
- **Single app per repo** — No monorepo support
- **Production only** — Preview deployments planned for v2
- **Singapore region** — Single-region deployment

## License

Private — Anchor Digital Co., Ltd.

---

*Built for Anchor Digital, Cambodia*
