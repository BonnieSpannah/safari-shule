import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from '../AppShell';
import { useImpersonationStore } from '@/stores/impersonation.store';

// Mock child components
vi.mock('../Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock('../Topbar', () => ({
  Topbar: () => <div data-testid="topbar">Topbar</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

describe('AppShell', () => {
  it('renders sidebar and topbar', () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
  });

  it('does not show impersonation banner when not impersonating', () => {
    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );
    expect(screen.queryByText(/Impersonating/)).not.toBeInTheDocument();
  });

  it('shows impersonation banner when impersonating', () => {
    useImpersonationStore.setState({
      isImpersonating: true,
      impersonatedUserEmail: 'driver@example.com',
      approverEmail: 'admin@example.com',
      impersonatedUserId: 'user123',
    });

    render(
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>,
    );

    expect(screen.getByText(/driver@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
  });
});
