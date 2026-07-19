import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { PasswordInput } from '@/components/ui/password-input';

describe('PasswordInput', () => {
  it('renders as type=password by default', () => {
    render(<PasswordInput aria-label="pw" defaultValue="secret" />);
    const input = screen.getByLabelText(/pw/i) as HTMLInputElement;
    expect(input.type).toBe('password');
  });

  it('toggles between hidden and visible on eye click', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="pw" defaultValue="secret" />);
    const input = screen.getByLabelText(/pw/i) as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: /show password/i });

    await user.click(toggle);
    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input.type).toBe('password');
  });

  it('hides the toggle when showToggle=false', () => {
    render(<PasswordInput aria-label="pw" showToggle={false} defaultValue="x" />);
    expect(screen.queryByRole('button', { name: /show password/i })).not.toBeInTheDocument();
  });
});
