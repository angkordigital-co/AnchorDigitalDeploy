/**
 * Dashboard Home Page
 *
 * Landing page after login. Shows welcome message and links to sites.
 * Will be enhanced with overview stats in future plans.
 */
import Link from "next/link";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await auth();
  const userName = session?.user?.name || "there";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Welcome section */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome, {userName}!
        </h1>
        <p className="text-gray-400 mt-2">
          Manage your Next.js deployments from one place.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-blue-500"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
              Your Sites
            </CardTitle>
            <CardDescription className="text-gray-400">
              View and manage all your deployed Next.js applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sites">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Go to Sites
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5 text-green-500"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              Quick Deploy
            </CardTitle>
            <CardDescription className="text-gray-400">
              Connect a GitHub repository and deploy in seconds.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/sites/new">
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Add New Site
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* How it works */}
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">How Anchor Deploy Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4 text-gray-300">
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                1
              </span>
              <div>
                <p className="font-medium text-white">Connect your GitHub repo</p>
                <p className="text-gray-400 text-sm">Link your Next.js repository and configure the webhook.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                2
              </span>
              <div>
                <p className="font-medium text-white">Push to main branch</p>
                <p className="text-gray-400 text-sm">Every push triggers an automatic build and deployment.</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                3
              </span>
              <div>
                <p className="font-medium text-white">Go live instantly</p>
                <p className="text-gray-400 text-sm">Your site is deployed to a global CDN with zero-downtime updates.</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
