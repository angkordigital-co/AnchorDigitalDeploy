/**
 * Auth.js v5 API Route Handler
 *
 * Exposes GET and POST handlers for authentication endpoints:
 * - GET /api/auth/session - Get current session
 * - POST /api/auth/signin - Sign in with credentials
 * - POST /api/auth/signout - Sign out
 * - GET /api/auth/csrf - Get CSRF token
 */
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
