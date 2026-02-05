"use client";

/**
 * App Providers
 *
 * Client-side providers wrapper for the application.
 * Includes SessionProvider for next-auth.
 */
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
