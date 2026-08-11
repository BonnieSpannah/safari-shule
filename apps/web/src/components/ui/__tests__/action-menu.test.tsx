import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { ActionMenu, type ActionItem } from '@/components/ui/action-menu';
import { useAuthStore } from '@/stores/auth.store';

function setPerms(permissions: string[]) {
  useAuthStore.setState({
    user: { id: 'u1', tenantId: 't1', email: 'e@t.com', fullName: 'T', permissions, roles: [] },
    accessToken: 'tok', refreshToken: 'rtok', isHydrated: true,
  });
}

describe('ActionMenu', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isHydrated: true });
  });

  it('renders a trigger button', () => {
    setPerms(['students.edit']);
    const items: ActionItem[] = [{ label: 'Edit', onClick: vi.fn() }];
    render(<ActionMenu items={items} />);
    expect(screen.getByLabelText('Row actions')).toBeInTheDocument();
  });

  it('opens the dropdown on click and shows item labels', () => {
    setPerms(['students.edit', 'students.delete']);
    const items: ActionItem[] = [
      { label: 'Edit', onClick: vi.fn() },
      { label: 'Delete', onClick: vi.fn(), variant: 'destructive' },
    ];
    render(<ActionMenu items={items} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('hides items whose permission is absent from the user', () => {
    setPerms(['students.edit']); // no students.delete
    const items: ActionItem[] = [
      { label: 'Edit', permission: 'students.edit', onClick: vi.fn() },
      { label: 'Delete', permission: 'students.delete', onClick: vi.fn() },
    ];
    render(<ActionMenu items={items} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders nothing when all items are permission-gated and user has none', () => {
    setPerms([]); // no permissions at all
    const items: ActionItem[] = [
      { label: 'Edit', permission: 'students.edit', onClick: vi.fn() },
    ];
    const { container } = render(<ActionMenu items={items} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClick when an item is clicked and closes the menu', () => {
    setPerms(['students.edit']);
    const handler = vi.fn();
    const items: ActionItem[] = [{ label: 'Edit', onClick: handler }];
    render(<ActionMenu items={items} />);
    fireEvent.click(screen.getByLabelText('Row actions'));
    fireEvent.click(screen.getByText('Edit'));
    expect(handler).toHaveBeenCalledOnce();
    // Menu should close after click
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});
