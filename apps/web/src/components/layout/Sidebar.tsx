import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bus,
  Route as RouteIcon,
  Users,
  UserRound,
  Radio,
  Siren,
  CreditCard,
  Settings,
  ChevronsLeft,
  Building2,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
  /**
   * Show this item if the current user has AT LEAST ONE of these permissions.
   * `null` = always show (e.g. Dashboard).
   */
  permissions: readonly string[] | null;
}

interface NavSection {
  key: string;
  label: string | null;
  items: readonly NavItem[];
}

// The full nav — every item lists the permissions that grant visibility.
// Sections whose items all resolve to "hidden" are dropped entirely.
const SECTIONS: readonly NavSection[] = [
  {
    key: 'overview',
    label: null,
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, permissions: null },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    items: [
      {
        to: '/students',
        label: 'Students',
        icon: Users,
        permissions: ['students.view', 'students.create', 'students.edit'],
      },
      {
        to: '/parents',
        label: 'Guardians',
        icon: UserRound,
        permissions: ['parents.view', 'parents.create'],
      },
      {
        to: '/fleet',
        label: 'Fleet',
        icon: Bus,
        permissions: ['vehicles.view', 'vehicles.create'],
      },
      {
        to: '/trips',
        label: 'Trips',
        icon: Radio,
        permissions: ['trips.list', 'trips.view', 'trips.live.view'],
      },
      {
        to: '/incidents',
        label: 'Incidents',
        icon: Siren,
        permissions: ['incidents.list', 'incidents.view'],
      },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      {
        to: '/payments',
        label: 'Payments',
        icon: CreditCard,
        permissions: ['payments.list', 'payments.view'],
      },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    items: [
      {
        to: '/audit',
        label: 'Audit log',
        icon: FileText,
        permissions: ['audit.view', 'audit.list'],
      },
    ],
  },
  {
    key: 'platform',
    label: 'Platform',
    items: [
      {
        to: '/platform/tenants',
        label: 'Tenants',
        icon: Building2,
        // Strictly `tenants.manage` — the other tenants.* perms may leak
        // into non-super-admin bundles (list-only auditors, etc.) later.
        permissions: ['tenants.manage'],
      },
    ],
  },
  {
    key: 'settings',
    label: null,
    items: [
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
        permissions: ['invitations.send', 'staff.view', 'staff.create', 'roles.view', 'users.view'],
      },
    ],
  },
];

function hasAny(userPerms: ReadonlySet<string>, wanted: readonly string[] | null): boolean {
  if (wanted === null) return true;
  for (const w of wanted) if (userPerms.has(w)) return true;
  return false;
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const user = useAuthStore((s) => s.user);
  const userPerms = new Set(user?.permissions ?? []);

  // Compute visible sections + items once per render.
  const visibleSections = SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasAny(userPerms, item.permissions)),
    }))
    .filter((section) => section.items.length > 0);

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

      <nav className="flex-1 space-y-4 overflow-y-auto p-2">
        {visibleSections.map((section) => (
          <div key={section.key} className="space-y-1">
            {!collapsed && section.label && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.label}
              </div>
            )}
            {collapsed && section.label && (
              <div
                className="mx-2 h-px bg-border"
                aria-hidden="true"
                role="presentation"
                title={section.label}
              />
            )}
            {section.items.map(({ to, label, icon: Icon, end }) => (
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
          </div>
        ))}
      </nav>

      {!collapsed && user && (
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            <span>{userPerms.size} permissions</span>
          </div>
        </div>
      )}

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
