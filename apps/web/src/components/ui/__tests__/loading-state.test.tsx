import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from '../loading-state';

describe('LoadingState', () => {
  it('renders loading message', () => {
    render(<LoadingState title="Fetching data…" description="Please wait" />);
    expect(screen.getByText('Fetching data…')).toBeInTheDocument();
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });

  it('renders default title', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders animated dots', () => {
    const { container } = render(<LoadingState />);
    const dots = container.querySelectorAll('.animate-pulse');
    expect(dots.length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(
      <LoadingState className="custom-loader" />
    );
    expect(container.querySelector('.custom-loader')).toBeInTheDocument();
  });

  it('optionally renders description', () => {
    const { rerender } = render(<LoadingState />);
    expect(screen.queryByText(/some description/i)).not.toBeInTheDocument();

    rerender(<LoadingState description="Loading vehicles…" />);
    expect(screen.getByText('Loading vehicles…')).toBeInTheDocument();
  });
});
