import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Bus, CheckCircle2, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { passwordSchema } from '@safari-shule/shared-types';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';

const schema = z
  .object({ newPassword: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match.',
  });
type FormValues = z.infer<typeof schema>;

/**
 * First-login page reached via the activation link in the welcome email.
 * The user sets their initial password here, and their account transitions to
 * `active`. After this they are redirected to sign in.
 */
export function ActivatePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { data } = await api.post('/v1/auth/activate', {
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      return data;
    },
    onError: (err) => {
      if (err instanceof AxiosError) {
        const code = err.response?.data?.code;
        if (code === 'TOKEN_INVALID') {
          toast.error('This activation link is invalid or has expired. Contact your administrator.');
          return;
        }
      }
      toast.error('Could not activate account. Please try again.');
    },
  });

  if (mutation.isSuccess) {
    const tenantSlug = searchParams.get('tenant') ?? '';
    return (
      <div className="flex min-h-full items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h2 className="text-xl font-semibold">Account activated</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is ready. Sign in below to get started.
          </p>
          <Button
            className="mt-6"
            onClick={() => navigate(`/login${tenantSlug ? `?tenant=${tenantSlug}` : ''}`, { replace: true })}
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Bus className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold leading-tight">Safari Shule</div>
            <div className="text-xs text-muted-foreground">Ops console</div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activate your account</CardTitle>
            <CardDescription>
              Set a password to activate your Safari Shule account. You'll use it to sign in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Password</Label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  invalid={!!form.formState.errors.newPassword}
                  {...form.register('newPassword')}
                />
                {form.formState.errors.newPassword && (
                  <p className="text-xs text-danger">
                    {form.formState.errors.newPassword.message}
                  </p>
                )}
                <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                  <li>At least 10 characters</li>
                  <li>One uppercase + one lowercase letter</li>
                  <li>One digit and one symbol (! @ # $…)</li>
                </ul>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  invalid={!!form.formState.errors.confirmPassword}
                  {...form.register('confirmPassword')}
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-xs text-danger">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Activate account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Link expired?{' '}
          <Link to="/forgot-password" className="text-primary hover:underline">
            Request a new activation link
          </Link>
        </p>
      </div>
    </div>
  );
}
