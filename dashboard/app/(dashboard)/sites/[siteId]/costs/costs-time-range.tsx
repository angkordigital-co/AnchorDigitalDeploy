/**
 * Costs Time Range Selector
 *
 * Client component for selecting cost time range.
 */
"use client";

import { useRouter } from "next/navigation";

interface CostsTimeRangeProps {
  currentRange: string;
}

export function CostsTimeRange({ currentRange }: CostsTimeRangeProps) {
  const router = useRouter();

  const handleRangeChange = (newRange: string) => {
    router.push(`?range=${newRange}`);
  };

  return (
    <select
      className="bg-gray-800 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-300"
      value={currentRange}
      onChange={(e) => handleRangeChange(e.target.value)}
    >
      <option value="7d">Last 7 days</option>
      <option value="30d">Last 30 days</option>
      <option value="90d">Last 90 days</option>
    </select>
  );
}
