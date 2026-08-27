import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '../error-state';

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState title="Test error" description="Test description" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('displays default message when none provided', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const button = screen.getByRole('button', { name: /try again/i });
    await userEvent.click(button);
    expect(onRetry).toHaveBeenCalled();
  });

  it('renders custom action when provided', () => {
    render(
      <ErrorState action={<button>Custom Action</button>} />
    );
    expect(screen.getByRole('button', { name: /custom action/i })).toBeInTheDocument();
  });

  it('uses error message when error object provided', () => {
    const error = new Error('Network timeout');
    render(<ErrorState error={error} />);
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ErrorState className="custom-class" />
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });
});
