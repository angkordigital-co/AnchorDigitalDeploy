/**
 * Metrics Time Range Selector
 *
 * Client component for selecting the time range for metrics display.
 * Updates URL search params to trigger server-side refetch.
 */
"use client";

import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface MetricsTimeRangeProps {
  currentRange: string;
}

const TIME_RANGES = [
  { label: "6 hours", value: "6h" },
  { label: "24 hours", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
];

export function MetricsTimeRange({ currentRange }: MetricsTimeRangeProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleRangeChange = (range: string) => {
    router.push(`${pathname}?range=${range}`);
  };

  return (
    <div className="flex rounded-lg border border-gray-700 overflow-hidden">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => handleRangeChange(range.value)}
          className={cn(
            "px-3 py-1.5 text-sm transition-colors",
            currentRange === range.value
              ? "bg-blue-600 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
