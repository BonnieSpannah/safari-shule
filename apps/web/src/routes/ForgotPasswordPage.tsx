import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Bus, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@safari-shule/shared-types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';

export function ForgotPasswordPage() {
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: 'onChange',
    defaultValues: { tenantSlug: '', email: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: ForgotPasswordInput) => {
      const { data } = await api.post('/v1/auth/forgot-password', values);
      return data;
    },
    onError: (err) => {
      if (err instanceof AxiosError && err.response?.status === 422) {
        toast.error('Check your school code and email address.');
        return;
      }
      toast.error('Something went wrong. Please try again.');
    },
  });

  if (mutation.isSuccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-surface px-4 py-12">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
          <h2 className="text-xl font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If that account exists, we've sent a password reset link to{' '}
            <strong>{form.getValues('email')}</strong>. The link expires in 30 minutes.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn't receive it? Check your spam folder or{' '}
            <button
              className="text-primary hover:underline"
              onClick={() => mutation.reset()}
              type="button"
            >
              try again
            </button>
            .
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-sm text-primary hover:underline"
          >
            Back to sign in
          </Link>
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
            <CardTitle>Forgot your password?</CardTitle>
            <CardDescription>
              Enter your school code and email. We'll send a reset link if the account exists.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug">School code</Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  autoComplete="organization"
                  spellCheck={false}
                  autoCapitalize="off"
                  placeholder="e.g. shule-academy"
                  invalid={!!form.formState.errors.tenantSlug}
                  {...form.register('tenantSlug')}
                />
                {form.formState.errors.tenantSlug && (
                  <p className="text-xs text-danger">
                    {form.formState.errors.tenantSlug.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                  invalid={!!form.formState.errors.email}
                  {...form.register('email')}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-danger">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Remembered it?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
