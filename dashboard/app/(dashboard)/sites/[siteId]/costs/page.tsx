/**
 * Costs Page
 *
 * Displays AWS cost breakdown and trends for a site.
 * Data is cached for 24 hours since Cost Explorer has up to 24-hour lag.
 */
import { notFound } from "next/navigation";
import { getProject } from "@/lib/aws/dynamodb";
import { getCostBreakdown, type CostData } from "@/lib/aws/cost-explorer";
import { CostBreakdown } from "@/components/charts/cost-breakdown";
import { CostTrend } from "@/components/charts/cost-trend";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { CostsTimeRange } from "./costs-time-range";

interface CostsPageProps {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ range?: string }>;
}

// Time range options in days
const TIME_RANGES: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const revalidate = 86400; // Cache for 24 hours (Cost Explorer data lags up to 24h)

export default async function CostsPage({
  params,
  searchParams,
}: CostsPageProps) {
  const { siteId } = await params;
  const { range = "30d" } = await searchParams;

  // Validate time range
  const days = TIME_RANGES[range] || 30;

  // Get project
  const project = await getProject(siteId);

  if (!project) {
    notFound();
  }

  // Fetch cost data
  let costData: CostData;
  try {
    costData = await getCostBreakdown(siteId, days);
  } catch (error) {
    console.error("Error fetching cost data:", error);
    costData = {
      breakdown: [],
      dailyCosts: [],
      totalCost: 0,
      currency: "USD",
      startDate: "",
      endDate: "",
    };
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">AWS Costs</h2>
          <p className="text-sm text-gray-400 mt-1">
            Cost breakdown and trends from AWS Cost Explorer
          </p>
        </div>
        <CostsTimeRange currentRange={range} />
      </div>

      {/* Data Lag Warning */}
      <Card className="bg-yellow-900/20 border-yellow-800">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-100 font-medium">
              Cost data may be delayed
            </p>
            <p className="text-sm text-yellow-200/80 mt-1">
              AWS Cost Explorer data has up to 24-hour lag. Recent costs may not
              be reflected yet. Data is cached for 24 hours.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Total Cost Card */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-2">
              Total Cost ({costData.startDate} to {costData.endDate})
            </p>
            <p className="text-4xl font-bold text-white">
              ${costData.totalCost.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500 mt-1">{costData.currency}</p>
          </div>
        </CardContent>
      </Card>

      {/* Cost Trend Chart */}
      <CostTrend dailyCosts={costData.dailyCosts} />

      {/* Cost Breakdown Chart */}
      <CostBreakdown
        breakdown={costData.breakdown}
        totalCost={costData.totalCost}
        currency={costData.currency}
      />
    </div>
  );
}
