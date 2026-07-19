import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    api: {
      post: vi.fn(),
      get: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
  };
});

import { ForgotPasswordPage } from '../ForgotPasswordPage';
import { ResetPasswordPage } from '../ResetPasswordPage';
import { ActivatePage } from '../ActivatePage';
import { api } from '@/lib/api/client';

function wrap(node: React.ReactNode, path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        {node}
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the school code + email fields and send button', () => {
    wrap(<ForgotPasswordPage />);
    expect(screen.getByLabelText(/school code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('shows the check-your-inbox state after successful submission', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { delivered: true } });
    const user = userEvent.setup();
    wrap(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText(/school code/i), 'shule-academy');
    await user.type(screen.getByLabelText(/email/i), 'admin@shule.test');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });
});

describe('ResetPasswordPage', () => {
  beforeEach(() => vi.clearAllMocks());

  function wrapWithToken() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/reset-password/abc123token']}>
          <Routes>
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          </Routes>
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders password + confirm password fields', () => {
    wrapWithToken();
    expect(screen.getByLabelText('New password', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password', { selector: 'input' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
  });

  it('shows the success state after reset', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { resetAt: new Date().toISOString() } });
    const user = userEvent.setup();
    wrapWithToken();

    await user.type(screen.getByLabelText('New password', { selector: 'input' }), 'NewPass!9x10');
    await user.type(screen.getByLabelText('Confirm new password', { selector: 'input' }), 'NewPass!9x10');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});

describe('ActivatePage', () => {
  beforeEach(() => vi.clearAllMocks());

  function wrapWithToken() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/activate/abc123token']}>
          <Routes>
            <Route path="/activate/:token" element={<ActivatePage />} />
          </Routes>
          <Toaster />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders the activation form with password requirements listed', () => {
    wrapWithToken();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /activate account/i })).toBeInTheDocument();
    expect(screen.getByText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('shows the account activated success screen after submission', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { activatedAt: new Date().toISOString() } });
    const user = userEvent.setup();
    wrapWithToken();

    await user.type(screen.getByLabelText(/^password$/i), 'Activate!9x10');
    await user.type(screen.getByLabelText(/confirm password/i), 'Activate!9x10');
    await user.click(screen.getByRole('button', { name: /activate account/i }));

    expect(await screen.findByText(/account activated/i)).toBeInTheDocument();
  });
});
