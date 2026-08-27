import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ImpersonationBanner } from '@/components/audit/ImpersonationBanner';
import { useImpersonationStore } from '@/stores/impersonation.store';

export function AppShell() {
  const { isImpersonating, impersonatedUserEmail, approverEmail, endImpersonation } =
    useImpersonationStore();

  return (
    <div className="flex h-full flex-col">
      {isImpersonating && impersonatedUserEmail && approverEmail && (
        <ImpersonationBanner
          impersonatedUserEmail={impersonatedUserEmail}
          approverEmail={approverEmail}
          onEnd={endImpersonation}
        />
      )}
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto bg-surface">
            <div className="mx-auto w-full max-w-screen-2xl px-4 py-6 md:px-6 lg:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
