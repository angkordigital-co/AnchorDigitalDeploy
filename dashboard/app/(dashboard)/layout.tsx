/**
 * Dashboard Layout
 *
 * Main layout for authenticated dashboard pages.
 * Includes sidebar navigation and header with user info.
 *
 * Session is fetched server-side and passed to client components.
 */
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Fixed sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <Header
          userEmail={session?.user?.email}
          userName={session?.user?.name}
        />

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
