import { Moon, Sun, LogOut, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { logout as logoutApi } from '@/lib/api/auth';
import { toast } from 'sonner';

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

  const isDark = theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'));

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-surface-2/80 px-4 backdrop-blur">
      <div className="relative flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search plates, students, routes…"
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <div className="hidden sm:flex flex-col items-end leading-tight">
        <span className="text-sm font-medium">{user?.fullName ?? 'Guest'}</span>
        <span className="text-xs text-muted-foreground">{user?.roles?.[0] ?? '—'}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        disabled={logoutMutation.isPending}
        onClick={() => logoutMutation.mutate()}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
