# Phase 3: Dashboard & Observability - Research

**Researched:** 2026-02-01
**Domain:** Next.js web dashboard, AWS CloudWatch observability, multi-tenant authentication
**Confidence:** HIGH

## Summary

Phase 3 requires building a production-ready dashboard for managing deployed sites, viewing observability data, and configuring deployments. The research reveals a clear modern stack: Next.js 15 with App Router for the dashboard, Auth.js (NextAuth v5) for authentication, shadcn/ui for components, and native AWS services for observability (CloudWatch Metrics, Logs Insights, Cost Explorer API).

The standard approach leverages Next.js Server Components to securely fetch AWS data server-side, minimizing client-side JavaScript and protecting credentials. CloudWatch provides comprehensive Lambda observability through automatic metrics (Duration, Errors, Invocations, Throttles) and structured log querying via Logs Insights. Real-time log streaming uses CloudWatch Live Tail API rather than WebSockets, avoiding stateful infrastructure complexity.

**Primary recommendation:** Build dashboard as Next.js App Router app with Auth.js v5 for authentication, shadcn/ui + TanStack Table for UI, server-side AWS SDK v3 calls in Server Components/Actions, and polling-based updates (upgrade to Live Tail API for real-time logs later if needed).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.x | Dashboard framework | Official React framework with Server Components, excellent DX, Vercel-optimized |
| Auth.js (NextAuth) | v5 (beta) | Authentication | Free, open-source, 80+ providers, Next.js native, no vendor lock-in |
| shadcn/ui | Latest | UI components | Copy-paste components, full control, Tailwind-based, no runtime bundle bloat |
| TanStack Table | v8 | Data tables | Headless table library, 100% customization, performant, TypeScript-first |
| Tailwind CSS | v3/v4 | Styling | Industry standard utility-first CSS, shadcn/ui dependency |
| AWS SDK v3 | Latest | AWS integration | Modular imports, smaller bundles, official AWS client |
| Recharts | 2.x | Charts/metrics visualization | Built for React, 9.5M weekly downloads, simple API, good for dashboards |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | v5 | Client-side data fetching | If adding real-time polling from client components |
| zod | Latest | Schema validation | Form validation, env variable parsing, API response validation |
| react-hook-form | Latest | Form handling | Environment variable editing, domain configuration forms |
| date-fns | Latest | Date formatting | Timestamp display for logs, deployment history |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth.js | AWS Cognito | Cognito locks you in (cannot export password hashes), more complex setup, but native AWS integration |
| Auth.js | Auth0 | Better enterprise features, excellent DX, but expensive at scale ($$$) |
| shadcn/ui | MUI (Material UI) | More components out-of-box, but heavier bundle, less customization, opinionated design |
| shadcn/ui | Chakra UI | Good accessibility, simpler API, but less modern, smaller ecosystem |
| Recharts | Chart.js | More flexible, larger ecosystem, but requires more configuration for React |
| Next.js | React SPA (Vite) | Would need separate backend, more complex deployment, no Server Components |

**Installation:**
```bash
# Create Next.js 15 app
npx create-next-app@latest dashboard --typescript --tailwind --app

# Install Auth.js v5
npm install next-auth@beta

# Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add table button card input form

# Install data/form libraries
npm install @tanstack/react-table @tanstack/react-query zod react-hook-form @hookform/resolvers date-fns recharts

# Install AWS SDK v3 (modular)
npm install @aws-sdk/client-dynamodb @aws-sdk/client-cloudwatch @aws-sdk/client-cloudwatch-logs @aws-sdk/client-cost-explorer
```

## Architecture Patterns

### Recommended Project Structure
```
dashboard/
├── app/
│   ├── (auth)/              # Auth routes (login, register)
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/         # Protected dashboard routes
│   │   ├── layout.tsx       # Dashboard layout with nav
│   │   ├── page.tsx         # Sites list
│   │   ├── sites/
│   │   │   └── [siteId]/
│   │   │       ├── page.tsx           # Site overview
│   │   │       ├── deployments/       # Deployment history
│   │   │       ├── logs/              # Logs viewer
│   │   │       ├── metrics/           # Metrics dashboard
│   │   │       ├── env/               # Environment variables
│   │   │       └── domains/           # Custom domains
│   │   └── settings/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Auth.js API route
│   │   └── aws/                          # AWS data API routes (if needed)
│   └── middleware.ts        # Auth middleware
├── components/
│   ├── ui/                  # shadcn/ui components
│   ├── charts/              # Recharts wrappers
│   ├── tables/              # TanStack Table components
│   └── dashboard/           # Dashboard-specific components
├── lib/
│   ├── auth.ts              # Auth.js configuration
│   ├── aws/                 # AWS SDK clients
│   │   ├── cloudwatch.ts
│   │   ├── dynamodb.ts
│   │   └── cost-explorer.ts
│   └── utils.ts
└── middleware.ts            # Route protection
```

### Pattern 1: Server Components for AWS Data Fetching
**What:** Fetch AWS data directly in Server Components using AWS SDK v3
**When to use:** Any time you need CloudWatch metrics, DynamoDB data, or Cost Explorer data
**Example:**
```typescript
// app/(dashboard)/sites/[siteId]/metrics/page.tsx
import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'ap-southeast-1' });

async function getMetrics(functionName: string) {
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 3600000); // Last hour

  const command = new GetMetricDataCommand({
    MetricDataQueries: [
      {
        Id: 'invocations',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Invocations',
            Dimensions: [{ Name: 'FunctionName', Value: functionName }],
          },
          Period: 300,
          Stat: 'Sum',
        },
      },
      {
        Id: 'errors',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Errors',
            Dimensions: [{ Name: 'FunctionName', Value: functionName }],
          },
          Period: 300,
          Stat: 'Sum',
        },
      },
      {
        Id: 'duration_p95',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Lambda',
            MetricName: 'Duration',
            Dimensions: [{ Name: 'FunctionName', Value: functionName }],
          },
          Period: 300,
          Stat: 'p95',
        },
      },
    ],
    StartTime: startTime,
    EndTime: endTime,
  });

  const response = await cloudwatch.send(command);
  return response.MetricDataResults;
}

export default async function MetricsPage({ params }: { params: { siteId: string } }) {
  const metrics = await getMetrics(`site-${params.siteId}-server`);

  return <MetricsChart data={metrics} />;
}
```

### Pattern 2: Auth.js v5 with Middleware Protection
**What:** Use Auth.js v5 for authentication with Next.js middleware for route protection
**When to use:** All dashboard routes need authentication
**Example:**
```typescript
// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { QueryCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-southeast-1' }));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: async (credentials) => {
        // Query DynamoDB for user
        const command = new QueryCommand({
          TableName: 'UsersTable',
          IndexName: 'EmailIndex',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: { ':email': credentials.email },
        });

        const result = await dynamodb.send(command);
        const user = result.Items?.[0];

        if (!user) return null;

        // Verify password (bcrypt comparison)
        const isValid = await verifyPassword(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.userId, email: user.email, name: user.name };
      }
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.userId as string;
      return session;
    }
  },
  pages: {
    signIn: '/login',
  }
});

// middleware.ts
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  if (!req.auth && req.nextUrl.pathname.startsWith('/sites')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### Pattern 3: DynamoDB Multi-Tenant Queries with GSI
**What:** Query DynamoDB with userId GSI for row-level security
**When to use:** Fetching user's sites, deployments, domains
**Example:**
```typescript
// lib/aws/dynamodb.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: 'ap-southeast-1' });
const dynamodb = DynamoDBDocumentClient.from(client);

export async function getUserProjects(userId: string) {
  const command = new QueryCommand({
    TableName: 'ProjectsTable',
    IndexName: 'UserIdIndex', // GSI with userId as partition key
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  });

  const result = await dynamodb.send(command);
  return result.Items || [];
}

// app/(dashboard)/page.tsx
import { auth } from '@/lib/auth';
import { getUserProjects } from '@/lib/aws/dynamodb';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const projects = await getUserProjects(session.user.id);

  return <ProjectsTable projects={projects} />;
}
```

### Pattern 4: CloudWatch Logs Insights for Error Aggregation
**What:** Use CloudWatch Logs Insights to query and aggregate errors by type
**When to use:** Error tracking dashboard, displaying error counts/types
**Example:**
```typescript
// lib/aws/cloudwatch-logs.ts
import { CloudWatchLogsClient, StartQueryCommand, GetQueryResultsCommand } from '@aws-sdk/client-cloudwatch-logs';

const logs = new CloudWatchLogsClient({ region: 'ap-southeast-1' });

export async function getErrorAggregation(logGroupName: string, hours: number = 24) {
  const endTime = Date.now();
  const startTime = endTime - (hours * 60 * 60 * 1000);

  // Query to aggregate errors by error type
  const query = `
    fields @timestamp, @message
    | filter @message like /ERROR/
    | parse @message /ERROR.*(?<errorType>[A-Za-z]+Error)/
    | stats count(*) as errorCount by errorType
    | sort errorCount desc
  `;

  const startCommand = new StartQueryCommand({
    logGroupName,
    startTime: Math.floor(startTime / 1000),
    endTime: Math.floor(endTime / 1000),
    queryString: query,
  });

  const { queryId } = await logs.send(startCommand);

  // Poll for results
  let status = 'Running';
  let results;
  while (status === 'Running' || status === 'Scheduled') {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const getCommand = new GetQueryResultsCommand({ queryId });
    const response = await logs.send(getCommand);
    status = response.status!;
    results = response.results;
  }

  return results;
}
```

### Pattern 5: Server Actions for Mutations
**What:** Use Server Actions for updating environment variables, triggering rollbacks
**When to use:** Any mutation operation from the dashboard
**Example:**
```typescript
// app/(dashboard)/sites/[siteId]/env/actions.ts
'use server';

import { auth } from '@/lib/auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { revalidatePath } from 'next/cache';

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-southeast-1' }));

export async function updateEnvVars(projectId: string, envVars: Record<string, string>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  // Verify ownership
  const project = await getProject(projectId);
  if (project.userId !== session.user.id) throw new Error('Forbidden');

  const command = new UpdateCommand({
    TableName: 'ProjectsTable',
    Key: { projectId },
    UpdateExpression: 'SET envVars = :envVars, updatedAt = :now',
    ExpressionAttributeValues: {
      ':envVars': envVars,
      ':now': new Date().toISOString(),
    },
  });

  await dynamodb.send(command);
  revalidatePath(`/sites/${projectId}/env`);

  return { success: true };
}

// app/(dashboard)/sites/[siteId]/env/page.tsx
import { updateEnvVars } from './actions';

export default function EnvVarsPage() {
  return (
    <form action={updateEnvVars}>
      {/* form fields */}
    </form>
  );
}
```

### Anti-Patterns to Avoid
- **Don't fetch AWS data in Client Components:** Exposes AWS credentials to browser, increases bundle size
- **Don't use NEXT_PUBLIC_ for AWS credentials:** These are embedded in client bundle at build time
- **Don't poll CloudWatch metrics every second:** Costs add up ($0.01 per 1000 API requests), use reasonable intervals (30s-5min)
- **Don't use WebSocket for logs in v1:** Adds infrastructure complexity (API Gateway WebSocket + DynamoDB for connections), use polling or Live Tail API instead
- **Don't create separate tables per user:** Use shared tables with userId GSI for multi-tenancy
- **Don't hand-roll JWT validation:** Use Auth.js built-in session management or AWS Cognito JWT authorizers

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Authentication system | Custom JWT + bcrypt + session management | Auth.js v5 | Handles session management, CSRF protection, provider integrations, secure cookies, token rotation - huge security surface area |
| Data tables with sorting/filtering | Custom table state management | TanStack Table | Column visibility, sorting, filtering, pagination, row selection all built-in with accessibility |
| UI components | Custom buttons, inputs, cards | shadcn/ui | Accessible, tested, TypeScript-first, customizable without runtime overhead |
| CloudWatch metrics queries | Custom metric aggregation logic | GetMetricData API with MetricDataQueries | Handles math expressions (error rate = Errors/Invocations), multiple metrics in single call, automatic pagination |
| Log streaming | Custom WebSocket server + CloudWatch polling | CloudWatch Live Tail API | Native AWS streaming API, no infrastructure, handles filtering, up to 3-hour sessions |
| Form validation | Manual regex + error state | zod + react-hook-form | Schema validation with TypeScript inference, async validation, deeply nested objects |
| Cost tracking | Manual CloudWatch billing metrics | Cost Explorer API | Provides cost breakdown by service, resource tags, usage type, forecasting, granular filters |
| Multi-tenant data isolation | Manual WHERE clauses in queries | DynamoDB fine-grained access control + GSI | IAM-enforced row-level security, dynamodb:LeadingKeys condition, prevents SQL injection equivalent |

**Key insight:** Dashboard observability involves complex AWS integrations with subtle edge cases (pagination limits, rate limiting, metric aggregation, multi-tenant isolation). Use AWS-provided APIs and battle-tested libraries rather than custom implementations.

## Common Pitfalls

### Pitfall 1: CloudWatch Metrics Pagination Confusion
**What goes wrong:** Using GetMetricStatistics and hitting 1,440 data point limit without pagination
**Why it happens:** GetMetricStatistics doesn't support native pagination - it errors if you request >1,440 points
**How to avoid:** Use GetMetricData instead, which supports pagination via NextToken and handles up to 100,800 data points per request
**Warning signs:** "Maximum number of data points exceeded" errors when querying longer time ranges

### Pitfall 2: Cost Explorer API Pricing Surprise
**What goes wrong:** Frequent polling of Cost Explorer API racks up unexpected charges ($0.01 per request)
**Why it happens:** Cost Explorer is metered per API call, unlike free CloudWatch web console
**How to avoid:** Cache Cost Explorer responses for 24 hours (cost data has 24-hour lag anyway), only refresh on user action
**Warning signs:** AWS bill shows hundreds of Cost Explorer API requests per day

### Pitfall 3: Environment Variables in Client Components
**What goes wrong:** AWS credentials or secrets exposed in browser bundle
**Why it happens:** NEXT_PUBLIC_ env vars are inlined at build time and visible in client JavaScript
**How to avoid:** Only use AWS SDK in Server Components or Server Actions, never prefix AWS credentials with NEXT_PUBLIC_
**Warning signs:** Seeing AWS_ACCESS_KEY_ID in browser DevTools > Sources tab

### Pitfall 4: Missing userId GSI for Multi-Tenancy
**What goes wrong:** Scanning entire DynamoDB table to filter by userId, high costs and slow queries
**Why it happens:** ProjectsTable uses projectId as partition key, userId not indexed
**How to avoid:** Create GSI with userId as partition key during Phase 1/2, query GSI instead of scanning
**Warning signs:** DynamoDB queries consuming >100 RCU for simple "get my projects" operations

### Pitfall 5: CloudWatch Logs Insights Query Timeout
**What goes wrong:** Log queries timing out or returning incomplete results
**Why it happens:** Large log volumes take >60 seconds to query, default API timeout is 60s
**How to avoid:** Use narrower time ranges, add specific filters early in query (filter before stats), implement query result polling pattern
**Warning signs:** "Query timed out" errors or status: 'Failed' in GetQueryResults

### Pitfall 6: DynamoDB Eventually Consistent GSI Reads
**What goes wrong:** User creates project but it doesn't immediately appear in dashboard "my sites" list
**Why it happens:** GSIs are eventually consistent - changes propagate in milliseconds to seconds
**How to avoid:** After mutations, optimistically update UI or use setTimeout + revalidation, document this behavior to users
**Warning signs:** User reports "I just deployed but don't see it in the list"

### Pitfall 7: Lambda Cold Start Inflating p95 Duration
**What goes wrong:** Duration metrics show high p95 (e.g., 3000ms) when actual runtime is 200ms
**Why it happens:** CloudWatch Duration metric includes cold start time for Lambda
**How to avoid:** Monitor ConcurrentExecutions alongside Duration to identify cold starts, use Lambda provisioned concurrency for critical functions if needed
**Warning signs:** Large gap between p50 and p95 Duration metrics

### Pitfall 8: Auth.js Session in Middleware Edge Runtime
**What goes wrong:** Cannot access DynamoDB or full session data in middleware
**Why it happens:** Next.js middleware runs on Edge runtime with limited Node.js APIs
**How to avoid:** Only check session existence in middleware (cookies), do full authorization checks in Server Components with database access
**Warning signs:** "Module not found" errors for AWS SDK in middleware.ts

### Pitfall 9: shadcn/ui Components Not Found After Install
**What goes wrong:** Import errors for shadcn/ui components despite running installation command
**Why it happens:** Components are copied to components/ui, not installed as npm package
**How to avoid:** Import from @/components/ui/button not shadcn/ui, ensure tsconfig paths configured correctly
**Warning signs:** "Cannot find module '@/components/ui/button'" TypeScript error

### Pitfall 10: Real-Time Updates Overengineering
**What goes wrong:** Building WebSocket infrastructure for log streaming when polling would suffice
**Why it happens:** "Real-time" sounds better, but adds complexity (API Gateway WebSocket, connection state in DynamoDB)
**How to avoid:** Start with 30-second polling for metrics, 5-second polling for logs - measure if latency is actually a problem
**Warning signs:** Architecture includes "WebSocket server", "connection state management", "heartbeat handling"

## Code Examples

Verified patterns from official sources:

### CloudWatch Live Tail API (Real-Time Logs)
```typescript
// lib/aws/logs-live-tail.ts
// Source: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogs_LiveTail.html
import { CloudWatchLogsClient, StartLiveTailCommand } from '@aws-sdk/client-cloudwatch-logs';

const logs = new CloudWatchLogsClient({ region: 'ap-southeast-1' });

export async function streamLiveLogs(logGroupArn: string, onLog: (log: any) => void) {
  const command = new StartLiveTailCommand({
    logGroupIdentifiers: [logGroupArn],
    logStreamNames: [], // Empty = all streams
  });

  const response = await logs.send(command);

  // Live Tail returns async iterable
  if (response.responseStream) {
    for await (const event of response.responseStream) {
      if (event.sessionUpdate?.sessionResults) {
        for (const log of event.sessionUpdate.sessionResults) {
          onLog(log);
        }
      }
    }
  }
}

// Note: Live Tail sessions last up to 3 hours, charged per minute
// Better for debugging than continuous monitoring (use polling instead)
```

### Cost Explorer API - Cost Breakdown by Service
```typescript
// lib/aws/cost-explorer.ts
// Source: https://docs.aws.amazon.com/cost-management/latest/userguide/ce-api.html
import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';

const ce = new CostExplorerClient({ region: 'us-east-1' }); // Cost Explorer is always us-east-1

export async function getCostByService(startDate: string, endDate: string) {
  const command = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: startDate, // Format: YYYY-MM-DD
      End: endDate,
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [
      {
        Type: 'DIMENSION',
        Key: 'SERVICE',
      },
    ],
    Filter: {
      Tags: {
        Key: 'Project',
        Values: ['vercel-clone'], // Filter by tag
      },
    },
  });

  const response = await ce.send(command);
  return response.ResultsByTime;
}

// Important: Cost Explorer has 24-hour lag, cache results for 24 hours
// Pricing: $0.01 per request
```

### shadcn/ui + TanStack Table for Deployments
```typescript
// components/tables/deployments-table.tsx
// Source: https://ui.shadcn.com/docs/components/data-table
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';

type Deployment = {
  deploymentId: string;
  status: 'success' | 'failed' | 'building';
  commitHash: string;
  createdAt: string;
};

const columns: ColumnDef<Deployment>[] = [
  {
    accessorKey: 'deploymentId',
    header: 'Deployment ID',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status');
      return (
        <Badge variant={status === 'success' ? 'success' : 'destructive'}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'commitHash',
    header: 'Commit',
    cell: ({ row }) => {
      const hash = row.getValue('commitHash') as string;
      return <code>{hash.substring(0, 7)}</code>;
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Deployed At',
    cell: ({ row }) => {
      return formatDistanceToNow(new Date(row.getValue('createdAt')));
    },
  },
];

export function DeploymentsTable({ data }: { data: Deployment[] }) {
  return <DataTable columns={columns} data={data} />;
}
```

### Recharts for Metrics Visualization
```typescript
// components/charts/invocations-chart.tsx
// Source: https://recharts.org/en-US/examples
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function InvocationsChart({ data }: { data: MetricDataResult[] }) {
  const chartData = data[0].Timestamps?.map((timestamp, i) => ({
    time: new Date(timestamp).toLocaleTimeString(),
    invocations: data[0].Values?.[i] || 0,
    errors: data[1].Values?.[i] || 0,
  })) || [];

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="time" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="invocations" stroke="#8884d8" />
        <Line type="monotone" dataKey="errors" stroke="#ff4444" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| NextAuth.js v4 | Auth.js v5 (NextAuth v5) | 2024-2025 | New API with auth() function, App Router native, better middleware support, auto env var inference |
| Pages Router | App Router with Server Components | Next.js 13+ (2023) | Server-side data fetching without API routes, better performance, streaming |
| GetMetricStatistics | GetMetricData | Always available but GetMetricData preferred | Better pagination (100,800 vs 1,440 points), math expressions, multiple metrics |
| CloudWatch polling | CloudWatch Live Tail API | Announced 2023, GA 2024 | Native real-time streaming, no WebSocket infrastructure needed |
| Tailwind v3 | Tailwind v4 | Released 2024 | Faster build times, simplified config, shadcn/ui supports both |
| MUI/Chakra dominance | shadcn/ui rise | 2023-2026 | Copy-paste components, no runtime bundle, full customization control |
| TanStack Table v7 | TanStack Table v8 | 2022 | TypeScript-first rewrite, better tree-shaking, improved API |
| AWS SDK v2 | AWS SDK v3 | 2020+ | Modular imports, smaller bundles, middleware architecture |
| REST polling only | Server-Sent Events (SSE) viable | Always available | Simpler than WebSocket for server-to-client, auto-reconnect, HTTP-based |

**Deprecated/outdated:**
- **NextAuth.js v4:** Migrate to v5 for App Router compatibility
- **AWS SDK v2:** Node.js 18 support ended Jan 2026, use v3
- **next-runtime-env:** Not needed if using Server Components for env vars
- **Custom WebSocket servers for logs:** CloudWatch Live Tail API now available
- **Client-side AWS SDK calls:** Security risk, use Server Components

## Open Questions

Things that couldn't be fully resolved:

1. **CloudWatch Live Tail Pricing Model**
   - What we know: Charged per session minute, not documented in search results
   - What's unclear: Exact pricing ($X per minute), whether it's more expensive than GetLogEvents polling
   - Recommendation: Start with polling (proven cost model), add Live Tail as premium feature if users request it

2. **Cost Explorer API Granularity for Per-Site Costs**
   - What we know: Can filter by resource tags, requires resources tagged with projectId
   - What's unclear: Whether existing Lambda/S3/CloudFront resources from Phase 1/2 are tagged properly
   - Recommendation: Verify all resources have Project and ProjectId tags, may need to add tagging in Phase 1/2 retroactively

3. **Auth.js v5 Production Readiness**
   - What we know: v5 is in beta/RC, actively maintained, stable enough for production per community
   - What's unclear: Official GA timeline, potential breaking changes before stable release
   - Recommendation: Use v5 (benefits outweigh risks), pin exact version, monitor changelog

4. **DynamoDB GSI Eventually Consistent Delay**
   - What we know: GSI propagation is milliseconds to seconds
   - What's unclear: Typical p95/p99 delay in practice for ap-southeast-1 region
   - Recommendation: Implement optimistic UI updates, add manual refresh button, log actual delays in production

5. **shadcn/ui Tailwind v4 Migration Impact**
   - What we know: shadcn/ui supports both v3 and v4, v4 is stable
   - What's unclear: Any breaking changes in component styling when upgrading
   - Recommendation: Start with Tailwind v3 (proven), migrate to v4 later if needed

## Sources

### Primary (HIGH confidence)
- [AWS Lambda CloudWatch Metrics](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-metrics-types.html) - Official metric names and descriptions
- [AWS Cost Explorer API](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-api.html) - Official API documentation
- [CloudWatch Live Tail](https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/CloudWatchLogs_LiveTail.html) - Real-time log streaming
- [API Gateway WebSocket APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-websocket-api.html) - WebSocket architecture
- [Next.js Official Documentation](https://nextjs.org/docs) - Server/Client Components, data fetching
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table) - TanStack Table integration
- [Auth.js Documentation](https://authjs.dev/getting-started/migrating-to-v5) - v5 migration guide
- [DynamoDB GSI Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html) - Global Secondary Indexes

### Secondary (MEDIUM confidence)
- [Next.js dashboard best practices 2026](https://www.ksolves.com/blog/next-js/best-practices-for-saas-dashboards) - SaaS patterns
- [AWS Cognito vs Auth0 vs NextAuth 2026](https://frontegg.com/guides/auth0-vs-cognito) - Authentication comparison
- [CloudWatch Lambda monitoring best practices](https://betterstack.com/community/guides/monitoring/aws-lambda-metrics/) - Metrics guide
- [WebSocket vs SSE 2026](https://ably.com/blog/websockets-vs-sse) - Real-time protocols
- [React UI libraries 2026](https://www.untitledui.com/blog/react-component-libraries) - Component library comparison
- [DynamoDB multi-tenancy patterns](https://aws.amazon.com/blogs/database/amazon-dynamodb-data-modeling-for-multi-tenancy-part-1/) - AWS blog
- [Next.js middleware authentication](https://authjs.dev/getting-started/session-management/protecting) - Session protection
- [Recharts vs Chart.js comparison](https://embeddable.com/blog/javascript-charting-libraries) - Charting libraries

### Tertiary (LOW confidence)
- WebSearch: "CloudWatch Logs Insights error aggregation" - Community query examples
- WebSearch: "API Gateway WebSocket pricing 2026" - Pricing calculator sites
- WebSearch: "AWS SDK v3 Next.js server actions" - Community tutorials
- WebSearch: "shadcn/ui installation 2026" - Community setup guides

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via official docs and npm trends, usage patterns confirmed
- Architecture: HIGH - Next.js patterns from official docs, AWS SDK patterns from AWS documentation
- Pitfalls: MEDIUM-HIGH - Most from AWS official troubleshooting, some from community experience reports

**Research date:** 2026-02-01
**Valid until:** 2026-03-15 (45 days - React/Next.js ecosystem moves fast, but fundamentals stable)
