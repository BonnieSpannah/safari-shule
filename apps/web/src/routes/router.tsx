import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { LoginPage } from './LoginPage';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { ActivatePage } from './ActivatePage';
import { DashboardPage } from './DashboardPage';
import { PlaceholderPage } from './PlaceholderPage';
import { NotFoundPage } from './NotFoundPage';
import { TenantsPage } from './platform/TenantsPage';
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
          <PlaceholderPage
            title="Fleet"
            description="Vehicles, fuel logs, repairs and insurance."
            eta="Fleet management screens ship in M2."
          />
        ),
      },
      {
        path: 'routes',
        element: (
          <PlaceholderPage
            title="Routes"
            description="Draw routes on the map, manage bus stops and student assignments."
            eta="Route drawing tools ship in M2."
          />
        ),
      },
      {
        path: 'students',
        element: (
          <PlaceholderPage
            title="Students"
            description="Roster, RFID tags, route assignments and guardians."
            eta="Student management ships in M2."
          />
        ),
      },
      {
        path: 'trips',
        element: (
          <PlaceholderPage
            title="Trips"
            description="Live trip tracking, attendance timeline and dispatch history."
            eta="Live trips + WebSocket telemetry ships in M2."
          />
        ),
      },
      {
        path: 'incidents',
        element: (
          <PlaceholderPage
            title="Incidents"
            description="SOS events, resolution timeline and emergency contacts."
            eta="Incident console ships in M2."
          />
        ),
      },
      {
        path: 'payments',
        element: (
          <PlaceholderPage
            title="Payments"
            description="M-Pesa transactions for fuel and repairs."
            eta="Payments ledger ships in M2."
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <PlaceholderPage
            title="Settings"
            description="Users, roles, feature flags and custom attributes."
            eta="Settings ship in M2."
          />
        ),
      },
      {
        path: 'audit',
        element: (
          <PlaceholderPage
            title="Audit log"
            description="Every mutation, sign-in, and sensitive read across your tenant — immutable, timestamped."
            eta="Audit browser ships in M3."
          />
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
