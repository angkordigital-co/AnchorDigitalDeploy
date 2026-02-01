/**
 * Metrics Chart Component
 *
 * Interactive line charts for Lambda metrics using Recharts.
 * Displays invocations/errors and duration percentiles.
 */
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ChartDataPoint {
  time: string;
  timestamp: number;
  invocations: number;
  errors: number;
  durationP50: number;
  durationP95: number;
  durationP99: number;
}

interface MetricsChartProps {
  data: ChartDataPoint[];
}

const COLORS = {
  invocations: "#60a5fa", // blue-400
  errors: "#f87171", // red-400
  durationP50: "#a78bfa", // violet-400
  durationP95: "#fb923c", // orange-400
  durationP99: "#f472b6", // pink-400
};

export function MetricsChart({ data }: MetricsChartProps) {
  if (data.length === 0) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">
              Invocations & Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-gray-500">
                No metrics data available for this time range.
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-lg text-gray-100">
              Response Time (ms)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <p className="text-gray-500">
                No metrics data available for this time range.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Invocations & Errors Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">
            Invocations & Errors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#6b7280"
                  tick={{ fill: "#9ca3af" }}
                  tickLine={{ stroke: "#374151" }}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fill: "#9ca3af" }}
                  tickLine={{ stroke: "#374151" }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f3f4f6",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span className="text-gray-300">{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="invocations"
                  name="Invocations"
                  stroke={COLORS.invocations}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="errors"
                  name="Errors"
                  stroke={COLORS.errors}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Duration Percentiles Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-lg text-gray-100">
            Response Time (ms)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="time"
                  stroke="#6b7280"
                  tick={{ fill: "#9ca3af" }}
                  tickLine={{ stroke: "#374151" }}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fill: "#9ca3af" }}
                  tickLine={{ stroke: "#374151" }}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#f3f4f6",
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                  formatter={(value, name) => {
                    if (typeof value !== "number") return ["", name || ""];
                    const formatted =
                      value >= 1000
                        ? `${(value / 1000).toFixed(2)}s`
                        : `${value.toFixed(0)}ms`;
                    return [formatted, name || ""];
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span className="text-gray-300">{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="durationP50"
                  name="p50"
                  stroke={COLORS.durationP50}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="durationP95"
                  name="p95"
                  stroke={COLORS.durationP95}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="durationP99"
                  name="p99"
                  stroke={COLORS.durationP99}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
