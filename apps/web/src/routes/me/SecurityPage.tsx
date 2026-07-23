import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import {
  KeyRound,
  Laptop,
  LogOut,
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import {
  changePasswordSchema,
  type ChangePasswordInput,
  type UserSession,
} from '@safari-shule/shared-types';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { RelativeTime } from '@/components/ui/relative-time';
import { FormActions } from '@/components/ui/form-actions';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  changePassword,
  hashRefreshToken,
  listSessions,
  revokeAllSessions,
  revokeSession,
} from '@/lib/api/me';
import { fetchMe } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Security page — two tabs: change password + active sessions. Password change
 * enforces the same strength rules as activation/reset (see passwordSchema in
 * shared-types) and shows an inline strength readout as you type.
 */
export function SecurityPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const [tokenHash, setTokenHash] = useState<string | null>(null);

  useEffect(() => {
    if (!refreshToken) {
      setTokenHash(null);
      return;
    }
    let cancelled = false;
    hashRefreshToken(refreshToken).then((h) => {
      if (!cancelled) setTokenHash(h || null);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  const meQuery = useQuery({ queryKey: ['me'], queryFn: fetchMe });

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Security & sessions"
        description="Rotate your password and see every device where you're signed in."
      />

      <Tabs defaultValue="password">
        <TabsList>
          <TabsTrigger value="password">
            <KeyRound className="h-4 w-4" /> Password
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <Monitor className="h-4 w-4" /> Active sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <ChangePasswordCard
            mustChange={!!meQuery.data?.mustChangePassword}
            expiresInDays={meQuery.data?.passwordExpiresInDays}
          />
        </TabsContent>

        <TabsContent value="sessions">
          <SessionsCard
            currentTokenHash={tokenHash}
            currentRefreshToken={refreshToken ?? undefined}
            onAnyRevocation={() =>
              queryClient.invalidateQueries({ queryKey: ['sessions'] })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Password card                                                             */
/* -------------------------------------------------------------------------- */

function ChangePasswordCard({
  mustChange,
  expiresInDays,
}: {
  mustChange: boolean;
  expiresInDays?: number;
}) {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const newPassword = form.watch('newPassword');
  const strength = scorePassword(newPassword);

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success('Password updated.');
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      navigate('/');
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? 'Could not update password.'
          : 'Could not update password.';
      toast.error(message);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change your password</CardTitle>
        <CardDescription>
          {mustChange
            ? 'A password change is required to continue.'
            : typeof expiresInDays === 'number'
              ? `Your current password expires in ${expiresInDays} day${
                  expiresInDays === 1 ? '' : 's'
                }.`
              : 'Choose a new password. Cannot match any of your last 5 passwords.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          id="password-form"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current password</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              {...form.register('currentPassword')}
              invalid={!!form.formState.errors.currentPassword}
            />
            {form.formState.errors.currentPassword && (
              <p className="text-xs text-danger">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              {...form.register('newPassword')}
              invalid={!!form.formState.errors.newPassword}
            />
            {form.formState.errors.newPassword && (
              <p className="text-xs text-danger">
                {form.formState.errors.newPassword.message}
              </p>
            )}
            <PasswordStrengthMeter score={strength.score} label={strength.label} />
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <Rule ok={/[A-Z]/.test(newPassword)}>One uppercase letter</Rule>
              <Rule ok={/[a-z]/.test(newPassword)}>One lowercase letter</Rule>
              <Rule ok={/\d/.test(newPassword)}>One digit</Rule>
              <Rule ok={/[^A-Za-z0-9]/.test(newPassword)}>One symbol (! @ # $ %…)</Rule>
              <Rule ok={newPassword.length >= 10}>At least 10 characters</Rule>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
              invalid={!!form.formState.errors.confirmPassword}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-xs text-danger">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
        </form>
      </CardContent>
      <FormActions
        formId="password-form"
        submitLabel="Update password"
        onCancel={() =>
          form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
        }
        submitting={mutation.isPending}
        disabled={!form.formState.isValid}
        className="rounded-b-xl"
      />
    </Card>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={
          'inline-block h-1.5 w-1.5 rounded-full ' +
          (ok ? 'bg-emerald-500' : 'bg-zinc-400/60')
        }
        aria-hidden
      />
      <span className={ok ? 'text-emerald-600 dark:text-emerald-400' : ''}>{children}</span>
    </li>
  );
}

interface PasswordScore {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}
function scorePassword(pw: string): PasswordScore {
  if (!pw) return { score: 0, label: 'Empty' };
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Excellent'] as const;
  return { score: clamped, label: labels[clamped] };
}

function PasswordStrengthMeter({ score, label }: PasswordScore) {
  const bars = [0, 1, 2, 3];
  const color =
    score <= 1 ? 'bg-rose-500' : score === 2 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {bars.map((i) => (
          <span
            key={i}
            className={
              'h-1.5 flex-1 rounded-full ' +
              (i < score ? color : 'bg-zinc-300/50 dark:bg-zinc-700')
            }
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sessions card                                                             */
/* -------------------------------------------------------------------------- */

function SessionsCard({
  currentTokenHash,
  currentRefreshToken,
  onAnyRevocation,
}: {
  currentTokenHash: string | null;
  currentRefreshToken?: string;
  onAnyRevocation: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<UserSession | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ['sessions', currentTokenHash],
    queryFn: () => listSessions(currentTokenHash ?? undefined),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      toast.success('Session revoked.');
      onAnyRevocation();
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: () => toast.error('Could not revoke session.'),
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => revokeAllSessions(currentRefreshToken),
    onSuccess: (data) => {
      toast.success(
        `Signed out of ${data.revoked} other session${data.revoked === 1 ? '' : 's'}.`,
      );
      onAnyRevocation();
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: () => toast.error('Could not sign out of other sessions.'),
  });

  const sessions = sessionsQuery.data ?? [];
  const others = sessions.filter((s) => !s.isCurrent);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>
            Every device with a valid refresh token. Revoking one signs it out immediately.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmRevokeAll(true)}
          disabled={others.length === 0 || revokeAllMutation.isPending}
        >
          <LogOut className="h-4 w-4" />
          Sign out of all other sessions
        </Button>
      </CardHeader>
      <CardContent>
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {sessions.map((session) => (
              <li key={session.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex items-start gap-3">
                  <DeviceIcon userAgent={session.userAgent} />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {describeUserAgent(session.userAgent)}
                      </span>
                      {session.isCurrent && (
                        <StatusBadge status="active" label="This device" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress ?? 'IP unknown'} · Started{' '}
                      <RelativeTime date={session.createdAt} className="inline" /> ·
                      Last used <RelativeTime date={session.lastUsedAt ?? session.createdAt} className="inline" />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Expires <RelativeTime date={session.expiresAt} className="inline" />
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={session.isCurrent || revokeMutation.isPending}
                  onClick={() => setConfirmRevoke(session)}
                  className="text-danger hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(next) => (!next ? setConfirmRevoke(null) : undefined)}
        title="Revoke this session?"
        description={
          confirmRevoke
            ? `Sign out ${describeUserAgent(confirmRevoke.userAgent)} (${
                confirmRevoke.ipAddress ?? 'IP unknown'
              }) immediately.`
            : ''
        }
        confirmLabel="Revoke"
        destructive
        pending={revokeMutation.isPending}
        onConfirm={async () => {
          if (!confirmRevoke) return;
          await revokeMutation.mutateAsync(confirmRevoke.id);
          setConfirmRevoke(null);
        }}
      />

      <ConfirmDialog
        open={confirmRevokeAll}
        onOpenChange={setConfirmRevokeAll}
        title="Sign out of all other sessions?"
        description={`This will sign out ${others.length} other session${
          others.length === 1 ? '' : 's'
        }. Your current session on this device will stay signed in.`}
        confirmLabel="Sign out others"
        destructive
        pending={revokeAllMutation.isPending}
        onConfirm={async () => {
          await revokeAllMutation.mutateAsync();
          setConfirmRevokeAll(false);
        }}
      />
    </Card>
  );
}

function DeviceIcon({ userAgent }: { userAgent: string | null }) {
  const kind = detectDeviceKind(userAgent);
  const Icon = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Tablet : kind === 'desktop' ? Laptop : Monitor;
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
  );
}

function detectDeviceKind(ua: string | null): 'mobile' | 'tablet' | 'desktop' | 'unknown' {
  if (!ua) return 'unknown';
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/mobile|iphone|android/.test(s)) return 'mobile';
  return 'desktop';
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const s = ua.toLowerCase();
  const browser = /firefox/.test(s)
    ? 'Firefox'
    : /edg\//.test(s)
      ? 'Edge'
      : /chrome/.test(s)
        ? 'Chrome'
        : /safari/.test(s)
          ? 'Safari'
          : 'Browser';
  const os = /mac os x/.test(s)
    ? 'macOS'
    : /windows/.test(s)
      ? 'Windows'
      : /android/.test(s)
        ? 'Android'
        : /iphone|ipad|ios/.test(s)
          ? 'iOS'
          : /linux/.test(s)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`;
}
