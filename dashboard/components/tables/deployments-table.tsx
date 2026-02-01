"use client";

/**
 * Deployments Table Component
 *
 * Displays deployment history with status badges and rollback action.
 */
import { ColumnDef } from "@tanstack/react-table";
import { formatDistanceToNow, format } from "date-fns";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Deployment } from "@/lib/aws/types";
import {
  MoreHorizontal,
  RotateCcw,
  ScrollText,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useState, useTransition } from "react";
import Link from "next/link";
import { triggerRollback } from "@/app/(dashboard)/sites/[siteId]/deployments/actions";

/**
 * Get badge variant based on deployment status
 */
function getStatusVariant(
  status: Deployment["status"]
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
 * Get human-readable status text
 */
function formatStatus(status: Deployment["status"]): string {
  switch (status) {
    case "built":
      return "Built";
    case "building":
      return "Building";
    case "deploying":
      return "Deploying";
    case "pending":
      return "Pending";
    case "success":
      return "Success";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

interface DeploymentsTableProps {
  data: Deployment[];
  projectId: string;
}

export function DeploymentsTable({ data, projectId }: DeploymentsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleRollback = (deploymentId: string) => {
    setRollbackId(deploymentId);
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await triggerRollback(projectId, deploymentId);
        setSuccess(`Rollback initiated for deployment ${deploymentId.slice(0, 8)}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Rollback failed");
      } finally {
        setRollbackId(null);
      }
    });
  };

  const columns: ColumnDef<Deployment>[] = [
    {
      accessorKey: "deploymentId",
      header: "Deployment",
      cell: ({ row }) => {
        const deployment = row.original;
        return (
          <code className="text-blue-400 font-mono text-sm">
            {deployment.deploymentId.slice(0, 8)}
          </code>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status;
        return <Badge variant={getStatusVariant(status)}>{formatStatus(status)}</Badge>;
      },
    },
    {
      accessorKey: "commitHash",
      header: "Commit",
      cell: ({ row }) => {
        const deployment = row.original;
        return (
          <div className="flex flex-col">
            <code className="text-gray-300 font-mono text-sm">
              {deployment.commitHash.slice(0, 7)}
            </code>
            {deployment.commitMessage && (
              <span className="text-gray-500 text-xs truncate max-w-[200px]">
                {deployment.commitMessage}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "commitAuthor",
      header: "Author",
      cell: ({ row }) => {
        const author = row.original.commitAuthor;
        return <span className="text-gray-400">{author || "-"}</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Deployed",
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt);
        return (
          <div className="flex flex-col">
            <span className="text-gray-300">
              {formatDistanceToNow(date, { addSuffix: true })}
            </span>
            <span className="text-gray-500 text-xs">
              {format(date, "MMM d, yyyy HH:mm")}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const deployment = row.original;
        const isCurrentlyRollingBack = rollbackId === deployment.deploymentId && isPending;
        const canRollback = deployment.status === "success";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                disabled={isCurrentlyRollingBack}
              >
                {isCurrentlyRollingBack ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
              <DropdownMenuItem asChild>
                <Link
                  href={`/sites/${projectId}/logs?deploymentId=${deployment.deploymentId}`}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <ScrollText className="h-4 w-4" />
                  View Logs
                </Link>
              </DropdownMenuItem>
              {canRollback && (
                <DropdownMenuItem
                  onClick={() => handleRollback(deployment.deploymentId)}
                  className="flex items-center gap-2 cursor-pointer text-amber-400 focus:text-amber-400"
                  disabled={isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                  Rollback to this version
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* Feedback messages */}
      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-300 px-4 py-3 rounded-md">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-800 text-green-300 px-4 py-3 rounded-md">
          {success}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        emptyMessage="No deployments yet. Push to main branch to trigger your first deployment."
      />
    </div>
  );
}
