import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AxiosError } from 'axios';
import { AlertTriangle, KeyRound, ShieldCheck } from 'lucide-react';
import { type UpdateProfileInput } from '@safari-shule/shared-types';

// Local schema so the phone message stays consistent with the rest of the platform
// regardless of the baked-in shared-types dist version.
const profileFormSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(120),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+254[17]\d{8}$/, 'Must be a valid Kenyan mobile number, e.g. +254712345678')
    .nullable()
    .optional(),
});

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { RelativeTime } from '@/components/ui/relative-time';
import { FormActions } from '@/components/ui/form-actions';
import { Button } from '@/components/ui/button';
import { fetchMe } from '@/lib/api/auth';
import { updateProfile } from '@/lib/api/me';
import { useAuthStore } from '@/stores/auth.store';
import { humanizeRole } from '@/lib/roles';

/**
 * Self-service profile page. Editable: fullName, phoneE164. Locked: email
 * (rotate via admin flow — email is the login identifier). Non-editable but
 * displayed: status, roles, tenant, activation date, last login, password
 * age (with prominent nudge when close to expiry or forced to change).
 */
export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cached = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    initialData: cached ?? undefined,
    refetchOnMount: true,
  });
  const me = meQuery.data;

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(profileFormSchema),
    mode: 'onChange',
    values: {
      fullName: me?.fullName ?? '',
      phoneE164: me?.phoneE164 ?? '',
    },
  });

  useEffect(() => {
    if (me) form.reset({ fullName: me.fullName, phoneE164: me.phoneE164 ?? '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.fullName, me?.phoneE164]);

  const mutation = useMutation({
    mutationFn: (values: UpdateProfileInput) =>
      updateProfile({
        fullName: values.fullName.trim(),
        phoneE164: values.phoneE164?.trim() ? values.phoneE164.trim() : null,
      }),
    onSuccess: (updated) => {
      toast.success('Profile updated.');
      if (cached) {
        setUser({
          ...cached,
          fullName: updated.fullName,
          phoneE164: updated.phoneE164 ?? null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/');
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.message ?? 'Could not update profile.'
          : 'Could not update profile.';
      toast.error(message);
    },
  });

  const passwordExpiring = useMemo(() => {
    if (!me?.passwordExpiresInDays && me?.passwordExpiresInDays !== 0) return false;
    return me.passwordExpiresInDays <= 14;
  }, [me?.passwordExpiresInDays]);

  if (!me) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading profile…</div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Your profile"
        description="Update your name and phone. Contact your school administrator to change your email."
      />

      {me.mustChangePassword && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Password change required
            </p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
              Set a new password from Security &amp; sessions before continuing to use the platform.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href="/me/security">Go to security</a>
          </Button>
        </div>
      )}

      {!me.mustChangePassword && passwordExpiring && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <KeyRound className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-900 dark:text-amber-200">
              Password expires in {me.passwordExpiresInDays} day
              {me.passwordExpiresInDays === 1 ? '' : 's'}
            </p>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300/90">
              Rotate it soon to avoid being locked out.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <a href="/me/security">Rotate now</a>
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Editable profile card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="mb-3">Personal details</CardTitle>
            <hr className="border-border" />
          </CardHeader>
          <CardContent>
            <form
              id="profile-form"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  {...form.register('fullName')}
                  invalid={!!form.formState.errors.fullName}
                />
                {form.formState.errors.fullName && (
                  <p className="text-xs text-danger">{form.formState.errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={me.email} readOnly disabled autoComplete="email" />
                <p className="text-xs text-muted-foreground">
                  Email is your login identifier — contact your administrator to change it.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+254712345678"
                  autoComplete="tel"
                  {...form.register('phoneE164')}
                  invalid={!!form.formState.errors.phoneE164}
                />
                {form.formState.errors.phoneE164 && (
                  <p className="text-xs text-danger">{form.formState.errors.phoneE164.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Valid Kenyan mobile, e.g. +254712345678. Used for SMS alerts and OTP sign-in.
                </p>
              </div>
            </form>
          </CardContent>
          <FormActions
            formId="profile-form"
            submitLabel="Save changes"
            onCancel={() => form.reset({ fullName: me.fullName, phoneE164: me.phoneE164 ?? '' })}
            submitting={mutation.isPending}
            disabled={!form.formState.isDirty}
            className="rounded-b-xl"
          />
        </Card>

        {/* Read-only identity card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="mb-3">Account</CardTitle>
            <hr className="border-border" />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ReadRow label="Status">
              <StatusBadge status={me.status ?? 'active'} />
            </ReadRow>
            <ReadRow label="Roles">
              <div className="flex flex-wrap gap-1">
                {(me.roles ?? []).map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {humanizeRole(r)}
                  </span>
                ))}
              </div>
            </ReadRow>
            <ReadRow label="Activated">
              <RelativeTime date={me.activatedAt} />
            </ReadRow>
            <ReadRow label="Last sign-in">
              <RelativeTime date={me.lastLoginAt} />
            </ReadRow>
            <ReadRow label="Password age">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Changed <RelativeTime date={me.passwordUpdatedAt} />
              </span>
            </ReadRow>
            <ReadRow label="Password expires">
              <RelativeTime date={me.passwordExpiresAt} />
            </ReadRow>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}
