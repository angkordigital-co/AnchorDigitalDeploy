/**
 * Cost Breakdown Component
 *
 * Bar chart showing AWS cost breakdown by service using Recharts.
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface CostBreakdownItem {
  service: string;
  amount: number;
  unit: string;
}

interface CostBreakdownProps {
  breakdown: CostBreakdownItem[];
  totalCost: number;
  currency: string;
}

const COLORS = [
  "#60a5fa", // blue-400
  "#a78bfa", // violet-400
  "#fb923c", // orange-400
  "#f472b6", // pink-400
  "#34d399", // emerald-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#818cf8", // indigo-400
];

export function CostBreakdown({
  breakdown,
  totalCost,
  currency,
}: CostBreakdownProps) {
  if (breakdown.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">
            Cost by Service
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <p className="text-gray-500">
              No cost data available for this period.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-lg text-gray-100">
          Cost by Service
        </CardTitle>
        <p className="text-sm text-gray-400 mt-1">
          Total: {currency} ${totalCost.toFixed(2)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={breakdown}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                type="number"
                stroke="#6b7280"
                tick={{ fill: "#9ca3af" }}
                tickLine={{ stroke: "#374151" }}
                tickFormatter={(value) => `$${value.toFixed(2)}`}
              />
              <YAxis
                type="category"
                dataKey="service"
                stroke="#6b7280"
                tick={{ fill: "#9ca3af" }}
                tickLine={{ stroke: "#374151" }}
                width={110}
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
              <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                {breakdown.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cost Table */}
        <div className="mt-6 border-t border-gray-800 pt-4">
          <div className="space-y-2">
            {breakdown.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-gray-300">{item.service}</span>
                </div>
                <span className="text-gray-100 font-medium">
                  ${item.amount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
