import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';

const MUST_CHANGE_EXEMPT = ['/me/security', '/me/preferences', '/login'];

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { accessToken, user, isHydrated } = useAuthStore();
  const location = useLocation();

  if (!isHydrated) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading session…
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // After login with mustChangePassword=true, any route except Security and
  // Preferences bounces to the Security page's change-password tab.
  if (
    user?.mustChangePassword &&
    !MUST_CHANGE_EXEMPT.some((path) => location.pathname.startsWith(path))
  ) {
    return <Navigate to="/me/security" replace />;
  }

  return <>{children}</>;
}
