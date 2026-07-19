import {
  Moon,
  Sun,
  LogOut,
  Search,
  MessageSquareText,
  Bell,
  User as UserIcon,
  Shield,
  Settings as SettingsIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { IconButton } from '@/components/ui/icon-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, initialsFromName } from '@/components/ui/avatar';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { logout as logoutApi } from '@/lib/api/auth';
import { humanizeRole, primaryRoleSlug } from '@/lib/roles';

export function Topbar() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const logoutMutation = useMutation({
    mutationFn: () => logoutApi(refreshToken ?? ''),
    onSettled: () => {
      clear();
      navigate('/login', { replace: true });
    },
    onError: () => toast.error('Logout partially failed — you have been signed out locally.'),
  });

  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('dark'));

  const displayName = user?.fullName ?? 'Guest';
  const roleLabel = humanizeRole(primaryRoleSlug(user?.roles));

  // Placeholder counts — real values arrive when Messages + Notifications APIs
  // land (M5). Wired here so the badges are ready to light up.
  const unreadMessages = 0;
  const unreadNotifications = 0;

  const comingSoon = (feature: string) =>
    toast.info(`${feature} lands in the next release.`, { duration: 2200 });

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface-2/80 px-4 backdrop-blur">
      {/* ─── Left: global search ───────────────────────────────────────── */}
      <div className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search plates, students, routes…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* ─── Right cluster: hugs the far right edge ───────────────────── */}
      <div className="ml-auto flex items-center gap-1">
        <IconButton
          icon={MessageSquareText}
          label={`Messages${unreadMessages ? ` (${unreadMessages} unread)` : ''}`}
          badgeCount={unreadMessages}
          onClick={() => comingSoon('Messages')}
        />
        <IconButton
          icon={Bell}
          label={`Notifications${unreadNotifications ? ` (${unreadNotifications} unread)` : ''}`}
          badgeCount={unreadNotifications}
          onClick={() => comingSoon('Notifications')}
        />
        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        />

        <div className="mx-1 h-6 w-px bg-border" aria-hidden="true" />

        {/* User identity + dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Open user menu"
            >
              <Avatar>
                <AvatarFallback>{initialsFromName(user?.fullName)}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{roleLabel}</span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="flex flex-col leading-tight">
              <span>{displayName}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user?.email ?? '—'}
              </span>
              <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-primary">
                {roleLabel}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/me/profile')}>
              <UserIcon />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/me/security')}>
              <Shield />
              Security &amp; sessions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/me/preferences')}>
              <SettingsIcon />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="text-danger focus:bg-danger/10 focus:text-danger"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
