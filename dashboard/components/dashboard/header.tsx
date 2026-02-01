/**
 * Dashboard Header
 *
 * Top header showing user info and sign out button.
 * Session is passed from server component (dashboard layout).
 */
"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userEmail: string | null | undefined;
  userName: string | null | undefined;
}

export function Header({ userEmail, userName }: HeaderProps) {
  return (
    <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
      {/* Page title area - can be customized by pages */}
      <div className="flex-1" />

      {/* User info and actions */}
      <div className="flex items-center gap-4">
        {/* User avatar and info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-300">
              {userName?.[0]?.toUpperCase() || userEmail?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-white">
              {userName || "User"}
            </p>
            <p className="text-xs text-gray-400">{userEmail}</p>
          </div>
        </div>

        {/* Sign out button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 mr-2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Sign out
        </Button>
      </div>
    </header>
  );
}
