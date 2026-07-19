import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { describe, expect, it, vi, beforeEach } from 'vitest';

// The three "me" pages call into these two modules. Mock them so the tests
// stay hermetic.
vi.mock('@/lib/api/auth', () => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));
vi.mock('@/lib/api/me', () => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  listSessions: vi.fn(),
  revokeSession: vi.fn(),
  revokeAllSessions: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  hashRefreshToken: vi.fn().mockResolvedValue(''),
}));

import { ProfilePage } from '../me/ProfilePage';
import { PreferencesPage } from '../me/PreferencesPage';
import { fetchMe } from '@/lib/api/auth';
import { getPreferences, updatePreferences, updateProfile } from '@/lib/api/me';
import { useAuthStore } from '@/stores/auth.store';
import { DEFAULT_PREFERENCES } from '@safari-shule/shared-types';

function wrap(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {node}
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ME = {
  id: 'u1',
  tenantId: 't1',
  email: 'admin@safarishule.test',
  fullName: 'Ada Lovelace',
  phoneE164: '+254712345678',
  status: 'active',
  mustChangePassword: false,
  passwordUpdatedAt: new Date().toISOString(),
  passwordExpiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(),
  passwordExpiresInDays: 90,
  activatedAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ['system_admin'],
  permissions: ['tenants.manage'],
  preferences: DEFAULT_PREFERENCES,
};

describe('ProfilePage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    vi.mocked(fetchMe).mockResolvedValue(ME);
    vi.mocked(updateProfile).mockResolvedValue({
      ...ME,
      fullName: 'Ada L.',
      phoneE164: '+254799999999',
    });
  });

  it('shows the user name + email (locked) + phone', async () => {
    wrap(<ProfilePage />);
    expect(await screen.findByDisplayValue('Ada Lovelace')).toBeInTheDocument();
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('admin@safarishule.test');
    expect(emailInput).toBeDisabled();
    expect(screen.getByDisplayValue('+254712345678')).toBeInTheDocument();
  });

  it('submits an update when the name is edited', async () => {
    const user = userEvent.setup();
    wrap(<ProfilePage />);

    const nameInput = (await screen.findByLabelText(/full name/i)) as HTMLInputElement;
    await user.clear(nameInput);
    await user.type(nameInput, 'Ada L.');

    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        fullName: 'Ada L.',
        phoneE164: '+254712345678',
      }),
    );
  });
});

describe('PreferencesPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
    vi.mocked(getPreferences).mockResolvedValue(DEFAULT_PREFERENCES);
    vi.mocked(updatePreferences).mockResolvedValue({
      ...DEFAULT_PREFERENCES,
      theme: 'dark',
    });
  });

  it('renders the appearance + locale + notifications sections', async () => {
    wrap(<PreferencesPage />);
    expect(
      await screen.findByRole('heading', { name: /appearance/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /locale/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /notifications/i })).toBeInTheDocument();
  });

  it('disables save until a field is changed, then submits the patch', async () => {
    const user = userEvent.setup();
    wrap(<PreferencesPage />);

    const saveBtn = await screen.findByRole('button', { name: /save preferences/i });
    expect(saveBtn).toBeDisabled();

    const themeSelect = screen.getByLabelText(/^theme$/i) as HTMLSelectElement;
    await user.selectOptions(themeSelect, 'dark');

    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await user.click(saveBtn);

    await waitFor(() =>
      expect(updatePreferences).toHaveBeenCalledWith(
        expect.objectContaining({ theme: 'dark' }),
      ),
    );
  });
});
