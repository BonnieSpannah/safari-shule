import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bus,
  Route as RouteIcon,
  Users,
  Radio,
  Siren,
  CreditCard,
  Settings,
  ChevronsLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/fleet', label: 'Fleet', icon: Bus },
  { to: '/routes', label: 'Routes', icon: RouteIcon },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/trips', label: 'Trips', icon: Radio },
  { to: '/incidents', label: 'Incidents', icon: Siren },
  { to: '/payments', label: 'Payments', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        'hidden md:flex md:flex-col border-r border-border bg-surface-2 transition-[width] duration-200',
        collapsed ? 'md:w-16' : 'md:w-60',
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Bus className="h-4 w-4" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Safari Shule</span>
            <span className="text-xs text-muted-foreground">Ops console</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'hover:bg-surface-3 hover:text-foreground',
                isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                collapsed && 'justify-center px-2',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="m-2 flex h-8 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-3 hover:text-foreground"
      >
        <ChevronsLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
      </button>
    </aside>
  );
}
