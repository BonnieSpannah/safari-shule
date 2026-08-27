import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImpersonationBanner } from '../ImpersonationBanner';

describe('ImpersonationBanner', () => {
  it('displays impersonated user email', () => {
    render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
      />
    );
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument();
  });

  it('displays approver email', () => {
    render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
      />
    );
    expect(screen.getByText(/admin@example.com/)).toBeInTheDocument();
  });

  it('renders End button', () => {
    render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /end/i })).toBeInTheDocument();
  });

  it('calls onEnd when End button clicked', async () => {
    const onEnd = vi.fn();
    render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={onEnd}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: /end/i }));
    expect(onEnd).toHaveBeenCalled();
  });

  it('renders amber warning banner', () => {
    const { container } = render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
      />
    );
    expect(container.querySelector('.bg-amber-50')).toBeInTheDocument();
    expect(container.querySelector('.border-amber-200')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
        className="custom-banner"
      />
    );
    expect(container.querySelector('.custom-banner')).toBeInTheDocument();
  });

  it('shows pulsing indicator', () => {
    const { container } = render(
      <ImpersonationBanner
        impersonatedUserEmail="user@example.com"
        approverEmail="admin@example.com"
        onEnd={() => {}}
      />
    );
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });
});
