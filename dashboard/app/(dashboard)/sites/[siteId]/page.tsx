/**
 * Site Overview Page
 *
 * Redirects to deployments page for now.
 * Will show overview stats in future.
 */
import { redirect } from "next/navigation";

interface SitePageProps {
  params: Promise<{ siteId: string }>;
}

export default async function SitePage({ params }: SitePageProps) {
  const { siteId } = await params;
  redirect(`/sites/${siteId}/deployments`);
}
