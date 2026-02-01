/**
 * Auth Layout
 *
 * Minimal centered layout for authentication pages (login, register, etc.).
 * Uses a centered card design with gradient background.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="w-full max-w-md px-4">
        {children}
      </div>
    </div>
  );
}
