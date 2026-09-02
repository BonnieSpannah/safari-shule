import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type * as TripsApi from '@/lib/api/trips';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/trips', async (importOriginal) => {
  const actual = await importOriginal<typeof TripsApi>();
  return {
    ...actual,
    listTrips: vi.fn(),
    startTrip: vi.fn(),
    endTrip: vi.fn(),
    cancelTrip: vi.fn(),
    createTrip: vi.fn(),
  };
});

import { TripsPage } from '../TripsPage';
import { listTrips, startTrip, type Trip } from '@/lib/api/trips';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

const mockTrip: Trip = {
  id: 'trip-1',
  routeId: 'route-1',
  vehicleId: 'vehicle-1',
  driverUserId: 'driver-1',
  assistantUserId: null,
  scheduledStart: new Date().toISOString(),
  startedAt: null,
  endedAt: null,
  status: 'scheduled',
  direction: 'morning_pickup',
  createdAt: new Date().toISOString(),
  route: { id: 'route-1', name: 'Route A' },
  vehicle: { id: 'vehicle-1', registration: 'KAA 123A', make: 'Toyota', model: 'Hiace' },
};

function setPerms() {
  useAuthStore.setState({
    user: { id: 'u1', tenantId: 't1', email: 'e@t.com', fullName: 'T', permissions: ['trips.dispatch'], roles: [] },
    accessToken: 'tok',
    refreshToken: 'rtok',
    isHydrated: true,
  });
}

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TripsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function startTheTrip() {
  wrap();
  await screen.findByText('Route A');
  fireEvent.click(screen.getByLabelText('Row actions'));
  fireEvent.click(await screen.findByText('Start trip'));
  fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
}

describe('TripsPage — actionMutation error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setPerms();
    vi.mocked(listTrips).mockResolvedValue({
      data: [mockTrip],
      meta: { page: 1, pageSize: 15, total: 1, pageCount: 1 },
    });
  });

  it('shows the specific vehicle-conflict message from a 409 TRIP_ALREADY_ACTIVE error', async () => {
    vi.mocked(startTrip).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: 'TRIP_ALREADY_ACTIVE',
          message: 'Vehicle already has a trip in progress.',
          details: { activeTripId: 'trip-9', conflictType: 'vehicle' },
        },
      },
    });

    await startTheTrip();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Vehicle already has a trip in progress.');
    });
  });

  it('falls back to the generic message for a non-conflict error', async () => {
    vi.mocked(startTrip).mockRejectedValueOnce(new Error('Network error'));

    await startTheTrip();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Could not update trip status.');
    });
  });
});
