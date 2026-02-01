"use client";

/**
 * Sites Table Component
 *
 * Displays user's projects in a sortable table.
 * Each site name links to its detail page.
 */
import { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Project, Deployment } from "@/lib/aws/types";
import { ArrowUpDown, ExternalLink, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Extended project type with latest deployment info
 */
export interface SiteWithStatus extends Project {
  latestDeployment?: Deployment;
}

/**
 * Get badge variant based on deployment status
 */
function getStatusVariant(
  status?: Deployment["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "success":
      return "default";
    case "building":
    case "deploying":
    case "pending":
    case "built":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

/**
 * Format status for display
 */
function formatStatus(status?: Deployment["status"]): string {
  if (!status) return "No deployments";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const columns: ColumnDef<SiteWithStatus>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="text-gray-400 hover:text-white hover:bg-transparent -ml-4"
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const project = row.original;
      return (
        <Link
          href={`/sites/${project.projectId}`}
          className="font-medium text-white hover:text-blue-400 transition-colors"
        >
          {project.name}
        </Link>
      );
    },
  },
  {
    accessorKey: "repoUrl",
    header: "Repository",
    cell: ({ row }) => {
      const project = row.original;
      return (
        <a
          href={project.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <Github className="h-4 w-4" />
          <span className="truncate max-w-[200px]">
            {project.repoOwner}/{project.repoName}
          </span>
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    },
  },
  {
    accessorKey: "latestDeployment",
    header: "Status",
    cell: ({ row }) => {
      const deployment = row.original.latestDeployment;
      return (
        <Badge variant={getStatusVariant(deployment?.status)}>
          {formatStatus(deployment?.status)}
        </Badge>
      );
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="text-gray-400 hover:text-white hover:bg-transparent -ml-4"
      >
        Last Updated
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const deployment = row.original.latestDeployment;
      const date = deployment?.createdAt || row.original.updatedAt;
      return (
        <span className="text-gray-400">
          {formatDistanceToNow(new Date(date), { addSuffix: true })}
        </span>
      );
    },
  },
];

interface SitesTableProps {
  data: SiteWithStatus[];
}

export function SitesTable({ data }: SitesTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage="No sites yet. Connect a GitHub repository to get started."
    />
  );
}
