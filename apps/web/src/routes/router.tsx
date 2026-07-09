import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ProtectedRoute } from './ProtectedRoute';
import { LoginPage } from './LoginPage';
import { DashboardPage } from './DashboardPage';
import { PlaceholderPage } from './PlaceholderPage';
import { NotFoundPage } from './NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
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
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
