import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
}));

import { LoginPage } from '../LoginPage';
import { login as loginApi } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth.store';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('renders welcome copy and the form', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument();
    expect(loginApi).not.toHaveBeenCalled();
  });

  it('rejects an obviously bad email format', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'Demo!Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(loginApi).not.toHaveBeenCalled();
  });

  it('stores the session and calls the API on valid submit', async () => {
    const user = userEvent.setup();
    (loginApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'test-token',
      accessTtlSeconds: 900,
      refreshTtlSeconds: 604_800,
      user: {
        id: 'u1',
        tenantId: 't1',
        email: 'admin@hillcrest.ac.ke',
        fullName: 'Admin User',
        roles: ['admin'],
        permissions: ['tenants.manage'],
      },
    });

    renderPage();

    await user.type(screen.getByLabelText(/email/i), 'admin@hillcrest.ac.ke');
    await user.type(screen.getByLabelText(/password/i), 'Demo!Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith('admin@hillcrest.ac.ke', 'Demo!Password1');
      expect(useAuthStore.getState().accessToken).toBe('test-token');
      expect(useAuthStore.getState().user?.email).toBe('admin@hillcrest.ac.ke');
    });
  });
});
