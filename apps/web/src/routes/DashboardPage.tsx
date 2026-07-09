import { useQuery } from '@tanstack/react-query';
import { Bus, Route as RouteIcon, Users, Siren } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { fetchMe } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth.store';

interface Stat {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'primary' | 'accent' | 'info' | 'danger';
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    staleTime: 60_000,
    enabled: !user,
  });

  const stats: Stat[] = [
    { label: 'Active vehicles', value: '—', hint: 'On duty right now', icon: Bus, tone: 'primary' },
    { label: 'Live trips', value: '—', hint: 'Being tracked live', icon: RouteIcon, tone: 'accent' },
    { label: 'Students on board', value: '—', hint: 'Scanned in this morning', icon: Users, tone: 'info' },
    { label: 'Open incidents', value: '—', hint: 'Awaiting acknowledgement', icon: Siren, tone: 'danger' },
  ];

  return (
    <div>
      <PageHeader
        title={user ? `Karibu, ${user.fullName.split(' ')[0]}` : 'Karibu'}
        description="Live overview of your school's transport operation."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, hint, icon: Icon, tone }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <div
                className={
                  tone === 'primary'
                    ? 'flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary'
                    : tone === 'accent'
                    ? 'flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent-foreground'
                    : tone === 'info'
                    ? 'flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info'
                    : 'flex h-8 w-8 items-center justify-center rounded-md bg-danger/10 text-danger'
                }
              >
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{value}</div>
              <CardDescription>{hint}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Live map</CardTitle>
            <CardDescription>Vehicles reporting in the last 60 seconds.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-surface-3 text-sm text-muted-foreground">
              Live map coming in the next release.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent incidents</CardTitle>
            <CardDescription>Latest SOS + operational events.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-surface-3 text-sm text-muted-foreground">
              No incidents to show.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
