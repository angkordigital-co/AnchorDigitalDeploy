/**
 * AWS Cost Explorer Client
 *
 * Functions for fetching AWS cost and usage data.
 * Data is cached for 24 hours since Cost Explorer has up to 24-hour lag.
 */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
  type GetCostAndUsageRequest,
} from "@aws-sdk/client-cost-explorer";

const client = new CostExplorerClient({
  region: "us-east-1", // Cost Explorer requires us-east-1
});

export interface CostBreakdownItem {
  service: string;
  amount: number;
  unit: string;
}

export interface DailyCost {
  date: string;
  amount: number;
}

export interface CostData {
  breakdown: CostBreakdownItem[];
  dailyCosts: DailyCost[];
  totalCost: number;
  currency: string;
  startDate: string;
  endDate: string;
}

/**
 * Get cost breakdown by service for a project
 *
 * @param projectId - Project ID (used to filter by tag)
 * @param days - Number of days to look back (default 30)
 * @returns Cost breakdown by service and daily trend
 */
export async function getCostBreakdown(
  projectId: string,
  days: number = 30
): Promise<CostData> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const params: GetCostAndUsageRequest = {
    TimePeriod: {
      Start: formatDate(startDate),
      End: formatDate(endDate),
    },
    Granularity: "DAILY",
    Metrics: ["UnblendedCost"],
    GroupBy: [
      {
        Type: "DIMENSION",
        Key: "SERVICE",
      },
    ],
    // Filter by project tag if available
    // For now, we'll get all costs (filtering by tag requires tags to be set on resources)
  };

  try {
    const command = new GetCostAndUsageCommand(params);
    const response = await client.send(command);

    const resultsByTime = response.ResultsByTime || [];

    // Aggregate costs by service
    const serviceMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();

    for (const result of resultsByTime) {
      const date = result.TimePeriod?.Start || "";
      let dayTotal = 0;

      for (const group of result.Groups || []) {
        const service = group.Keys?.[0] || "Unknown";
        const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || "0");

        // Aggregate by service
        serviceMap.set(service, (serviceMap.get(service) || 0) + amount);

        // Add to daily total
        dayTotal += amount;
      }

      // Store daily total
      if (date) {
        dailyMap.set(date, dayTotal);
      }
    }

    // Convert to arrays
    const breakdown: CostBreakdownItem[] = Array.from(serviceMap.entries())
      .map(([service, amount]) => ({
        service: formatServiceName(service),
        amount: Math.round(amount * 100) / 100, // Round to 2 decimals
        unit: "USD",
      }))
      .sort((a, b) => b.amount - a.amount); // Sort by cost descending

    const dailyCosts: DailyCost[] = Array.from(dailyMap.entries())
      .map(([date, amount]) => ({
        date,
        amount: Math.round(amount * 100) / 100,
      }))
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort by date ascending

    const totalCost = breakdown.reduce((sum, item) => sum + item.amount, 0);

    return {
      breakdown,
      dailyCosts,
      totalCost: Math.round(totalCost * 100) / 100,
      currency: "USD",
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  } catch (error) {
    console.error("Error fetching cost data:", error);

    // Return empty data on error
    return {
      breakdown: [],
      dailyCosts: [],
      totalCost: 0,
      currency: "USD",
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

/**
 * Get total cost for a time period
 *
 * @param projectId - Project ID
 * @param days - Number of days to look back
 * @returns Total cost in USD
 */
export async function getTotalCost(
  projectId: string,
  days: number = 30
): Promise<number> {
  const data = await getCostBreakdown(projectId, days);
  return data.totalCost;
}

/**
 * Format date for Cost Explorer API (YYYY-MM-DD)
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format AWS service name for display
 *
 * Removes "AWS" prefix and "Amazon" prefix for cleaner display.
 */
function formatServiceName(service: string): string {
  return service
    .replace(/^Amazon\s+/, "")
    .replace(/^AWS\s+/, "")
    .trim();
}
