/**
 * Dashboard Home Page
 *
 * Redirects to /sites for the main dashboard view.
 */
import { redirect } from "next/navigation";

export default function DashboardHome() {
  redirect("/sites");
}
