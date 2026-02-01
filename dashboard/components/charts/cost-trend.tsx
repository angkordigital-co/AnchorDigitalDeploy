/**
 * Cost Trend Component
 *
 * Line chart showing daily AWS cost trend using Recharts.
 */
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface DailyCost {
  date: string;
  amount: number;
}

interface CostTrendProps {
  dailyCosts: DailyCost[];
}

export function CostTrend({ dailyCosts }: CostTrendProps) {
  if (dailyCosts.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">
            Daily Cost Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <p className="text-gray-500">
              No cost trend data available for this period.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format data for display
  const chartData = dailyCosts.map((item) => ({
    ...item,
    displayDate: formatDisplayDate(item.date),
  }));

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-lg text-gray-100">
          Daily Cost Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="displayDate"
                stroke="#6b7280"
                tick={{ fill: "#9ca3af" }}
                tickLine={{ stroke: "#374151" }}
              />
              <YAxis
                stroke="#6b7280"
                tick={{ fill: "#9ca3af" }}
                tickLine={{ stroke: "#374151" }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1f2937",
                  border: "1px solid #374151",
                  borderRadius: "8px",
                  color: "#f3f4f6",
                }}
                labelStyle={{ color: "#9ca3af" }}
                formatter={(value) => {
                  if (typeof value !== "number") return ["", "Cost"];
                  return [`$${value.toFixed(2)}`, "Cost"];
                }}
              />
              <Line
                type="monotone"
                dataKey="amount"
                name="Daily Cost"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Format date for display (MM/DD)
 */
function formatDisplayDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
