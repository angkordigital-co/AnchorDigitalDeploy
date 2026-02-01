/**
 * Login Page
 *
 * Credentials-based login form using Auth.js v5.
 * Uses react-hook-form with zod validation.
 *
 * Note: LoginForm uses useSearchParams, which must be wrapped in Suspense
 * for static generation compatibility.
 */
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="h-4 w-12 bg-gray-700 rounded animate-pulse" />
        <div className="h-10 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-16 bg-gray-700 rounded animate-pulse" />
        <div className="h-10 bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="h-10 bg-gray-700 rounded animate-pulse" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Card className="border-gray-700 bg-gray-800/50 backdrop-blur">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6 text-white"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-white">
          Anchor Deploy
        </CardTitle>
        <CardDescription className="text-gray-400">
          Sign in to manage your deployments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
