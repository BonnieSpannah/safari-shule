import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { Bus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { login, fetchMe } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth.store';
import { env, resolveTenantSlugFromHost } from '@/lib/env';
import { rememberTenantSlug, readRememberedTenantSlug } from '@/lib/api/client';

const schema = z.object({
  tenantSlug: z
    .string()
    .min(1, 'Tenant is required')
    .regex(/^[a-z][a-z0-9-]*$/, 'Lowercase letters, digits, hyphens (start with a letter)'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

interface LocationState {
  from?: string;
}

function initialTenantSlug(): string {
  if (typeof window !== 'undefined') {
    const fromHost = resolveTenantSlugFromHost(window.location.hostname);
    if (fromHost) return fromHost;
    const persisted = readRememberedTenantSlug();
    if (persisted) return persisted;
  }
  return env.tenantSlug;
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);
  const derivedTenant =
    typeof window !== 'undefined' ? resolveTenantSlugFromHost(window.location.hostname) : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { tenantSlug: initialTenantSlug(), email: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Persist the chosen tenant BEFORE the login request so the axios
      // interceptor stamps X-Tenant-Slug correctly on this call.
      rememberTenantSlug(values.tenantSlug.trim());
      const loginResponse = await login(values.email, values.password);
      // Store the access token so /v1/auth/me can use it, then fetch full
      // identity (roles + permissions) before we finish the login flow.
      useAuthStore.getState().setTokens(loginResponse.accessToken, loginResponse.refreshToken);
      const fullUser = await fetchMe();
      return { loginResponse, fullUser };
    },
    onSuccess: ({ loginResponse, fullUser }) => {
      setSession(loginResponse.accessToken, loginResponse.refreshToken, fullUser);
      // Immediately redirect to Security page if a password change is required.
      if (fullUser.mustChangePassword) {
        navigate('/me/security', { replace: true });
        return;
      }
      const from = (location.state as LocationState | null)?.from ?? '/';
      navigate(from, { replace: true });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 401) {
          toast.error('Invalid email or password.');
          return;
        }
        if (status === 400) {
          toast.error('Tenant not recognised. Check the tenant / school code and try again.');
          return;
        }
      }
      toast.error('Could not sign in. Please try again.');
    },
  });

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
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to manage your school's transport operation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="tenantSlug">Tenant / school code</Label>
                <Input
                  id="tenantSlug"
                  type="text"
                  autoComplete="organization"
                  spellCheck={false}
                  autoCapitalize="off"
                  readOnly={!!derivedTenant}
                  invalid={!!errors.tenantSlug}
                  aria-describedby={
                    errors.tenantSlug ? 'tenantSlug-error' : 'tenantSlug-hint'
                  }
                  placeholder="e.g. shule-academy"
                  {...register('tenantSlug')}
                />
                {errors.tenantSlug ? (
                  <p id="tenantSlug-error" className="text-xs text-danger">
                    {errors.tenantSlug.message}
                  </p>
                ) : (
                  <p id="tenantSlug-hint" className="text-xs text-muted-foreground">
                    {derivedTenant
                      ? 'Detected from this URL — cannot be changed here.'
                      : 'The short code your school (or Safari Shule) gave you.'}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  placeholder="you@example.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p id="email-error" className="text-xs text-danger">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-primary hover:underline"
                    tabIndex={-1}
                  >
                    Forgot password?
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  {...register('password')}
                />
                {errors.password && (
                  <p id="password-error" className="text-xs text-danger">
                    {errors.password.message}
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Trouble signing in?{' '}
          <Link to="/forgot-password" className="text-primary hover:underline">
            Reset your password
          </Link>
        </p>
      </div>
    </div>
  );
}
