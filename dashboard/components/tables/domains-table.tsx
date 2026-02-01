'use client';

/**
 * Domains Table
 *
 * Displays custom domains for a project with status badges,
 * DNS validation records, and actions (refresh, delete).
 */

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Loader2,
} from 'lucide-react';
import type { Domain } from '@/lib/aws/types';
import { deleteDomain, refreshDomainStatus } from '@/app/(dashboard)/sites/[siteId]/domains/actions';
import { toast } from 'sonner';

interface DomainsTableProps {
  projectId: string;
  domains: Domain[];
}

type CertificateStatus = Domain['certificateStatus'];
type CloudFrontStatus = Domain['cloudFrontStatus'];

const certificateStatusConfig: Record<
  CertificateStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING_VALIDATION: { label: 'Pending Validation', color: 'bg-yellow-500/20 text-yellow-500', icon: Clock },
  ISSUED: { label: 'Issued', color: 'bg-green-500/20 text-green-500', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'bg-red-500/20 text-red-500', icon: AlertCircle },
  INACTIVE: { label: 'Inactive', color: 'bg-gray-500/20 text-gray-500', icon: AlertCircle },
};

const cloudFrontStatusConfig: Record<
  CloudFrontStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  PENDING: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-500', icon: Clock },
  DEPLOYED: { label: 'Deployed', color: 'bg-green-500/20 text-green-500', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'bg-red-500/20 text-red-500', icon: AlertCircle },
};

function StatusBadge({
  status,
  config,
}: {
  status: string;
  config: { label: string; color: string; icon: React.ElementType };
}) {
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon-xs" onClick={handleCopy} className="h-6 w-6">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function DomainRow({ domain, projectId }: { domain: Domain; projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const [isDeleting, startDelete] = useTransition();

  const certConfig = certificateStatusConfig[domain.certificateStatus] || certificateStatusConfig.FAILED;
  const cfConfig = cloudFrontStatusConfig[domain.cloudFrontStatus] || cloudFrontStatusConfig.PENDING;

  const handleRefresh = () => {
    startRefresh(async () => {
      try {
        await refreshDomainStatus(projectId, domain.domainId);
        toast.success('Domain status refreshed');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to refresh status';
        toast.error(message);
      }
    });
  };

  const handleDelete = () => {
    startDelete(async () => {
      try {
        await deleteDomain(projectId, domain.domainId);
        toast.success(`Domain "${domain.domain}" deleted`);
        setDeleteDialogOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete domain';
        toast.error(message);
      }
    });
  };

  const showValidation = domain.certificateStatus === 'PENDING_VALIDATION' && domain.validationRecord;

  return (
    <>
      <div className="border border-gray-800 rounded-lg overflow-hidden">
        {/* Main row */}
        <div className="flex items-center justify-between p-4 bg-gray-900">
          <div className="flex items-center gap-4">
            {showValidation && (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setExpanded(!expanded)}
                className="h-6 w-6"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {!showValidation && <div className="w-6" />}

            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm text-white">{domain.domain}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <StatusBadge status={domain.certificateStatus} config={certConfig} />
            <StatusBadge status={domain.cloudFrontStatus} config={cfConfig} />

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title="Refresh status"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                title="Delete domain"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Expandable DNS validation section */}
        {expanded && showValidation && domain.validationRecord && (
          <div className="border-t border-gray-800 p-4 bg-gray-950">
            <Alert className="bg-yellow-500/10 border-yellow-500/20">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <AlertTitle className="text-yellow-500">DNS Validation Required</AlertTitle>
              <AlertDescription className="text-muted-foreground">
                Add the following DNS record to your domain provider to validate your certificate:
              </AlertDescription>
            </Alert>

            <div className="mt-4 p-4 bg-gray-900 rounded-lg space-y-3">
              <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
                <span className="text-xs text-muted-foreground uppercase font-medium">Type</span>
                <code className="text-sm text-white bg-gray-800 px-2 py-1 rounded">
                  {domain.validationRecord.type}
                </code>
                <CopyButton value={domain.validationRecord.type} />
              </div>
              <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
                <span className="text-xs text-muted-foreground uppercase font-medium">Name</span>
                <code className="text-sm text-white bg-gray-800 px-2 py-1 rounded break-all">
                  {domain.validationRecord.name}
                </code>
                <CopyButton value={domain.validationRecord.name} />
              </div>
              <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-center">
                <span className="text-xs text-muted-foreground uppercase font-medium">Value</span>
                <code className="text-sm text-white bg-gray-800 px-2 py-1 rounded break-all">
                  {domain.validationRecord.value}
                </code>
                <CopyButton value={domain.validationRecord.value} />
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              DNS propagation can take up to 48 hours. Click &quot;Refresh Status&quot; to check if validation is complete.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Domain</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong className="text-white">{domain.domain}</strong>?
              This will remove the domain from your project and delete the associated SSL certificate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              className="border-gray-700"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Domain
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DomainsTable({ projectId, domains }: DomainsTableProps) {
  if (domains.length === 0) {
    return (
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Globe className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No custom domains</h3>
          <p className="text-muted-foreground max-w-sm">
            Add a custom domain to use your own URL for your deployed site.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Your Domains</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {domains.map((domain) => (
          <DomainRow key={domain.domainId} domain={domain} projectId={projectId} />
        ))}
      </CardContent>
    </Card>
  );
}
