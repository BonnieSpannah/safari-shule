import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders the status text title-cased', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('supports a custom label', () => {
    render(<StatusBadge status="pending" label="Awaiting activation" />);
    expect(screen.getByText('Awaiting activation')).toBeInTheDocument();
  });

  it('handles unknown statuses without throwing', () => {
    render(<StatusBadge status="whatever" />);
    expect(screen.getByText('Whatever')).toBeInTheDocument();
  });
});
