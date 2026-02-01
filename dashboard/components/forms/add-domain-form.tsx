'use client';

/**
 * Add Domain Form
 *
 * Form component for adding a custom domain to a project.
 * Validates domain format and calls the addDomain server action.
 */

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Loader2, Globe } from 'lucide-react';
import { addDomain } from '@/app/(dashboard)/sites/[siteId]/domains/actions';
import { toast } from 'sonner';

interface AddDomainFormProps {
  projectId: string;
  onSuccess?: () => void;
}

// Basic domain validation regex
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export function AddDomainForm({ projectId, onSuccess }: AddDomainFormProps) {
  const [domainName, setDomainName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedDomain = domainName.trim().toLowerCase();

    if (!trimmedDomain) {
      setError('Please enter a domain name');
      return;
    }

    if (!DOMAIN_REGEX.test(trimmedDomain)) {
      setError('Please enter a valid domain name (e.g., example.com or www.example.com)');
      return;
    }

    startTransition(async () => {
      try {
        await addDomain(projectId, trimmedDomain);
        toast.success(`Domain "${trimmedDomain}" added successfully`);
        setDomainName('');
        onSuccess?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add domain';
        setError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Add Custom Domain
        </CardTitle>
        <CardDescription>
          Connect a custom domain to your site. You&apos;ll need to configure DNS records after adding.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="domain" className="sr-only">
                Domain Name
              </Label>
              <Input
                id="domain"
                type="text"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                placeholder="example.com"
                className="bg-gray-800 border-gray-700"
                disabled={isPending}
              />
            </div>
            <Button type="submit" disabled={isPending} className="min-w-[120px]">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Domain
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            After adding, you&apos;ll receive DNS records to configure with your domain provider.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
