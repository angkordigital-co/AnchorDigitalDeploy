"use client";

/**
 * Site Navigation Component
 *
 * Sub-navigation for individual site pages.
 * Highlights active route.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Rocket,
  ScrollText,
  BarChart3,
  Key,
  Globe,
  DollarSign,
} from "lucide-react";

interface SiteNavProps {
  siteId: string;
}

const navItems = [
  {
    name: "Overview",
    href: "",
    icon: LayoutDashboard,
  },
  {
    name: "Deployments",
    href: "/deployments",
    icon: Rocket,
  },
  {
    name: "Logs",
    href: "/logs",
    icon: ScrollText,
  },
  {
    name: "Metrics",
    href: "/metrics",
    icon: BarChart3,
  },
  {
    name: "Env",
    href: "/env",
    icon: Key,
  },
  {
    name: "Domains",
    href: "/domains",
    icon: Globe,
  },
  {
    name: "Costs",
    href: "/costs",
    icon: DollarSign,
  },
];

export function SiteNav({ siteId }: SiteNavProps) {
  const pathname = usePathname();
  const basePath = `/sites/${siteId}`;

  return (
    <nav className="flex space-x-1 border-b border-gray-800 pb-4 mb-6 overflow-x-auto">
      {navItems.map((item) => {
        const href = `${basePath}${item.href}`;
        const isActive =
          item.href === ""
            ? pathname === basePath
            : pathname.startsWith(href);

        return (
          <Link
            key={item.name}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
