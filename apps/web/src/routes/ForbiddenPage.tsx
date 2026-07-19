import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import { humanizeRole, primaryRoleSlug } from '@/lib/roles';

interface ForbiddenPageProps {
  requiredPermissions?: readonly string[];
}

export function ForbiddenPage({ requiredPermissions }: ForbiddenPageProps) {
  const user = useAuthStore((s) => s.user);
  const role = humanizeRole(primaryRoleSlug(user?.roles));

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg border-danger/30">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
            <ShieldOff className="h-6 w-6" />
          </div>
          <CardTitle>You don't have access to this page</CardTitle>
          <CardDescription>
            Your current role is <span className="font-medium">{role}</span>. This page is
            restricted — ask your Safari Shule super admin (or platform support) to grant you the
            required permission if you need access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requiredPermissions && requiredPermissions.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Required permission (any of)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {requiredPermissions.map((p) => (
                  <code
                    key={p}
                    className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground"
                  >
                    {p}
                  </code>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
