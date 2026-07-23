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

export function ResetPasswordPage() {
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
      const { data } = await api.post('/v1/auth/reset-password', {
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
          toast.error('This link is invalid or has expired. Request a new one.');
          return;
        }
        if (code === 'PASSWORD_HISTORY_REUSE') {
          form.setError('newPassword', { message: err.response?.data?.message });
          return;
        }
      }
      toast.error('Could not reset password. Please try again.');
    },
  });

  // Navigate to login after a short delay so the user can read the success message.
  if (mutation.isSuccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h2 className="text-xl font-semibold">Password updated</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your password has been reset. All other active sessions have been signed out.
          </p>
          <Button
            className="mt-6"
            onClick={() =>
              navigate(`/login${searchParams.get('tenant') ? `?tenant=${searchParams.get('tenant')}` : ''}`, { replace: true })
            }
          >
            Sign in with new password
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
            <CardTitle>Set a new password</CardTitle>
            <CardDescription>
              Choose a strong password — it can't match your last 5 passwords.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
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
                Reset password
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Link expired?{' '}
          <Link to="/forgot-password" className="text-primary hover:underline">
            Request a new one
          </Link>
        </p>
      </div>
    </div>
  );
}
