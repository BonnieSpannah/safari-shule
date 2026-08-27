import { Bus, Route as RouteIcon, Users, Siren, GraduationCap, UserCog, CalendarCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { getDashboardStats } from '@/lib/api/dashboard';
import { LiveTripsMapCard } from './dashboard/LiveTripsMapCard';

const TONE_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600',
  emerald: 'bg-emerald-500/10 text-emerald-600',
  violet: 'bg-violet-500/10 text-violet-600',
  amber: 'bg-amber-500/10 text-amber-600',
  rose: 'bg-rose-500/10 text-rose-600',
  sky: 'bg-sky-500/10 text-sky-600',
  orange: 'bg-orange-500/10 text-orange-600',
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 30_000,
  });
  const s = statsQuery.data;

  const stats = [
    { label: 'Active users', value: s?.users ?? '—', hint: 'System accounts', icon: Users, color: 'blue', to: '/settings' },
    { label: 'Students', value: s?.students ?? '—', hint: 'Enrolled', icon: GraduationCap, color: 'emerald', to: '/students' },
    { label: 'Staff', value: s?.staff ?? '—', hint: 'On record', icon: UserCog, color: 'violet', to: '/settings' },
    { label: 'Active vehicles', value: s?.vehicles ?? '—', hint: 'In service', icon: Bus, color: 'amber', to: '/fleet' },
    { label: 'Active routes', value: s?.routes ?? '—', hint: 'Running today', icon: RouteIcon, color: 'sky', to: '/routes' },
    { label: "Today's trips", value: s?.tripsToday ?? '—', hint: 'Scheduled today', icon: CalendarCheck, color: 'orange', to: '/trips' },
    { label: 'Open incidents', value: s?.incidentsOpen ?? '—', hint: 'Awaiting resolution', icon: Siren, color: 'rose', to: '/incidents' },
  ];

  return (
    <div>
      <PageHeader
        title={user ? `Karibu, ${user.fullName.split(' ')[0]}` : 'Karibu'}
        description="Live overview of your school's transport operation."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {stats.map(({ label, value, hint, icon: Icon, color, to }) => (
          <Link key={label} to={to} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE_CLASSES[color]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold leading-none">{value}</div>
                <div className="text-xs font-medium text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{hint}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LiveTripsMapCard />

        <Card>
          <CardHeader>
            <CardTitle>Recent incidents</CardTitle>
            <CardDescription>Latest SOS and operational events.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              {s?.incidentsOpen === 0 ? 'No open incidents. All clear.' : `${s?.incidentsOpen ?? '—'} incident(s) need attention.`}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
