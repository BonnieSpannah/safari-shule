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
import { login as loginApi, fetchMe as fetchMeApi } from '@/lib/api/auth';
import { useAuthStore } from '@/stores/auth.store';
import { readRememberedTenantSlug } from '@/lib/api/client';

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
    window.localStorage.clear();
  });

  it('renders welcome copy and the form (tenant + email + password + sign in)', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/tenant \/ school code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Password', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates required email + password on submit', async () => {
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
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Demo!Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument();
    expect(loginApi).not.toHaveBeenCalled();
  });

  it('rejects an invalid tenant slug (uppercase / spaces)', async () => {
    const user = userEvent.setup();
    renderPage();

    const tenantInput = screen.getByLabelText(/tenant \/ school code/i);
    await user.clear(tenantInput);
    await user.type(tenantInput, 'BAD SLUG');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Demo!Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/lowercase letters, digits, hyphens/i)).toBeInTheDocument();
    expect(loginApi).not.toHaveBeenCalled();
  });

  it('remembers the tenant slug and stores the session on valid submit', async () => {
    const user = userEvent.setup();
    (loginApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
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
    (fetchMeApi as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'u1',
      tenantId: 't1',
      email: 'admin@hillcrest.ac.ke',
      fullName: 'Admin User',
      roles: ['school_manager'],
      permissions: ['tenants.manage', 'vehicles.list', 'students.list'],
    });

    renderPage();

    const tenantInput = screen.getByLabelText(/tenant \/ school code/i);
    await user.clear(tenantInput);
    await user.type(tenantInput, 'hillcrest');
    await user.type(screen.getByLabelText(/email/i), 'admin@hillcrest.ac.ke');
    await user.type(screen.getByLabelText('Password', { selector: 'input' }), 'Demo!Password1');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await vi.waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith('admin@hillcrest.ac.ke', 'Demo!Password1');
      expect(fetchMeApi).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().accessToken).toBe('test-token');
      expect(useAuthStore.getState().user?.permissions).toEqual([
        'tenants.manage',
        'vehicles.list',
        'students.list',
      ]);
      expect(readRememberedTenantSlug()).toBe('hillcrest');
    });
  });
});
