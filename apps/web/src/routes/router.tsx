import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { LoginPage } from './LoginPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { ActivatePage } from './ActivatePage';
import { DashboardPage } from './DashboardPage';
import { NotFoundPage } from './NotFoundPage';
import { TenantsPage } from './platform/TenantsPage';
import { TenantDetailPage } from './platform/TenantDetailPage';
import { StudentsPage } from './students/StudentsPage';
import { FleetPage } from './fleet/FleetPage';
import { RoutesPage } from './routes/RoutesPage';
import { SettingsPage } from './settings/SettingsPage';
import { ParentsPage } from './parents/ParentsPage';
import { TripsPage } from './trips/TripsPage';
import { HardwarePage } from './hardware/HardwarePage';
import { AuditPage } from './audit/AuditPage';
import { IncidentsPage } from './incidents/IncidentsPage';
import { PaymentsPage } from './payments/PaymentsPage';
import { ProfilePage } from './me/ProfilePage';
import { SecurityPage } from './me/SecurityPage';
import { PreferencesPage } from './me/PreferencesPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/forgot-password',
    element: <ForgotPasswordPage />,
  },
  {
    path: '/reset-password/:token',
    element: <ResetPasswordPage />,
  },
  {
    path: '/activate/:token',
    element: <ActivatePage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'fleet',
        element: (
          <PermissionGate anyOf={['vehicles.view', 'vehicles.create']}>
            <FleetPage />
          </PermissionGate>
        ),
      },
      {
        path: 'routes',
        element: (
          <PermissionGate anyOf={['routes.view', 'routes.manage']}>
            <RoutesPage />
          </PermissionGate>
        ),
      },
      {
        path: 'students',
        element: (
          <PermissionGate anyOf={['students.view', 'students.create']}>
            <StudentsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'parents',
        element: (
          <PermissionGate anyOf={['parents.view', 'parents.create']}>
            <ParentsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'trips',
        element: (
          <PermissionGate anyOf={['trips.view', 'trips.dispatch']}>
            <TripsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'incidents',
        element: (
          <PermissionGate anyOf={['incidents.view', 'incidents.list']}>
            <IncidentsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'payments',
        element: (
          <PermissionGate anyOf={['payments.view', 'payments.list']}>
            <PaymentsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'hardware',
        element: (
          <PermissionGate anyOf={['rfid_devices.view', 'rfid_devices.manage']}>
            <HardwarePage />
          </PermissionGate>
        ),
      },
      {
        path: 'audit',
        element: (
          <PermissionGate anyOf={['audit.view']}>
            <AuditPage />
          </PermissionGate>
        ),
      },
      {
        path: 'settings',
        element: (
          <PermissionGate anyOf={['invitations.send', 'users.view', 'staff.view', 'staff.create']}>
            <SettingsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'platform/tenants',
        element: (
          <PermissionGate anyOf={['tenants.manage']}>
            <TenantsPage />
          </PermissionGate>
        ),
      },
      {
        path: 'platform/tenants/:id',
        element: (
          <PermissionGate anyOf={['tenants.manage']}>
            <TenantDetailPage />
          </PermissionGate>
        ),
      },
      // ─── Self-service ("me") pages — every signed-in user reaches these
      //     from the topbar avatar menu, regardless of role.
      { path: 'me/profile', element: <ProfilePage /> },
      { path: 'me/security', element: <SecurityPage /> },
      { path: 'me/preferences', element: <PreferencesPage /> },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
