'use client';

/**
 * Environment Variables Form
 *
 * Dynamic form for managing project environment variables.
 * Supports add, edit, and delete operations with save/cancel.
 */

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trash2, Plus, Eye, EyeOff, Loader2, Save, Lock } from 'lucide-react';
import { updateEnvVars, type EnvVar } from '@/app/(dashboard)/sites/[siteId]/env/actions';
import { toast } from 'sonner';

interface EnvVarsFormProps {
  projectId: string;
  initialEnvVars: EnvVar[];
}

export function EnvVarsForm({ projectId, initialEnvVars }: EnvVarsFormProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>(
    initialEnvVars.length > 0 ? initialEnvVars : [{ key: '', value: '', isSecret: false }]
  );
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleAddRow = () => {
    setEnvVars([...envVars, { key: '', value: '', isSecret: false }]);
  };

  const handleRemoveRow = (index: number) => {
    if (envVars.length === 1) {
      // Keep at least one row, just clear it
      setEnvVars([{ key: '', value: '', isSecret: false }]);
    } else {
      setEnvVars(envVars.filter((_, i) => i !== index));
    }
  };

  const handleChange = (index: number, field: 'key' | 'value' | 'isSecret', value: string | boolean) => {
    const newEnvVars = [...envVars];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    setEnvVars(newEnvVars);
  };

  const toggleSecretVisibility = (index: number) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(index)) {
      newVisible.delete(index);
    } else {
      newVisible.add(index);
    }
    setVisibleSecrets(newVisible);
  };

  const toggleIsSecret = (index: number) => {
    handleChange(index, 'isSecret', !envVars[index].isSecret);
  };

  const handleSave = () => {
    setError(null);

    // Validate: check for duplicate keys
    const keys = envVars.filter((env) => env.key.trim() !== '').map((env) => env.key);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      setError('Duplicate keys are not allowed');
      return;
    }

    // Validate: check for invalid key names
    const invalidKey = envVars.find(
      (env) => env.key.trim() !== '' && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(env.key)
    );
    if (invalidKey) {
      setError(`Invalid key name: "${invalidKey.key}". Keys must start with a letter or underscore and contain only letters, numbers, and underscores.`);
      return;
    }

    startTransition(async () => {
      try {
        await updateEnvVars(projectId, envVars);
        toast.success('Environment variables saved successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save environment variables';
        setError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Environment Variables</CardTitle>
        <CardDescription>
          Add environment variables for your deployment. Changes require a new deployment to take effect.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center text-sm text-muted-foreground">
            <span>Key</span>
            <span>Value</span>
            <span className="w-10 text-center">Secret</span>
            <span className="w-10"></span>
            <span className="w-10"></span>
          </div>

          {/* Env var rows */}
          {envVars.map((envVar, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-3 items-center">
              <div>
                <Label htmlFor={`key-${index}`} className="sr-only">
                  Key
                </Label>
                <Input
                  id={`key-${index}`}
                  value={envVar.key}
                  onChange={(e) => handleChange(index, 'key', e.target.value)}
                  placeholder="KEY_NAME"
                  className="font-mono bg-gray-800 border-gray-700"
                />
              </div>
              <div className="relative">
                <Label htmlFor={`value-${index}`} className="sr-only">
                  Value
                </Label>
                <Input
                  id={`value-${index}`}
                  type={envVar.isSecret && !visibleSecrets.has(index) ? 'password' : 'text'}
                  value={envVar.value}
                  onChange={(e) => handleChange(index, 'value', e.target.value)}
                  placeholder="value"
                  className="font-mono bg-gray-800 border-gray-700 pr-10"
                />
                {envVar.isSecret && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => toggleSecretVisibility(index)}
                  >
                    {visibleSecrets.has(index) ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <Button
                type="button"
                variant={envVar.isSecret ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => toggleIsSecret(index)}
                title={envVar.isSecret ? 'Marked as secret' : 'Mark as secret'}
                className="w-10"
              >
                <Lock className={`h-4 w-4 ${envVar.isSecret ? 'text-yellow-500' : 'text-gray-500'}`} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => toggleSecretVisibility(index)}
                className="w-10"
                disabled={!envVar.isSecret}
              >
                {visibleSecrets.has(index) ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveRow(index)}
                className="text-red-500 hover:text-red-400 hover:bg-red-500/10 w-10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 pt-4 border-t border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddRow}
            className="border-gray-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Variable
          </Button>

          <div className="flex-1" />

          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="min-w-[120px]"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Secret variables will be masked in logs. All variables require a new deployment to take effect.
        </p>
      </CardContent>
    </Card>
  );
}
