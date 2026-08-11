import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';

// ─── DataTable ────────────────────────────────────────────────────────────────

interface Row { id: string; name: string; email: string }

const COLUMNS: Column<Row>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name },
  { key: 'email', header: 'Email', render: (r) => r.email },
];

const ROWS: Row[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders all row data', () => {
    render(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('shows loading skeleton rows when loading=true', () => {
    const { container } = render(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} loading skeletonRows={3} />,
    );
    // Skeleton cells are animate-pulse divs
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThanOrEqual(3);
  });

  it('shows empty slot when rows is empty and not loading', () => {
    render(
      <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} empty={<p>Nothing here</p>} />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('falls back to default empty message when no empty prop provided', () => {
    render(<DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} />);
    expect(screen.getByText(/no records found/i)).toBeInTheDocument();
  });
});

// ─── Pagination ───────────────────────────────────────────────────────────────

describe('Pagination', () => {
  it('shows correct X–Y of Z range on page 1', () => {
    render(<Pagination page={1} pageSize={10} total={35} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('1–10 of 35')).toBeInTheDocument();
  });

  it('shows correct range on middle page', () => {
    render(<Pagination page={2} pageSize={10} total={35} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('11–20 of 35')).toBeInTheDocument();
  });

  it('caps "to" at total on last page', () => {
    render(<Pagination page={4} pageSize={10} total={35} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('31–35 of 35')).toBeInTheDocument();
  });

  it('shows "No results" when total is 0', () => {
    render(<Pagination page={1} pageSize={10} total={0} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('Prev button is disabled on page 1', () => {
    render(<Pagination page={1} pageSize={10} total={35} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('Prev').closest('button')).toBeDisabled();
  });

  it('Next button is disabled on the last page', () => {
    render(<Pagination page={4} pageSize={10} total={35} onPrev={() => {}} onNext={() => {}} />);
    expect(screen.getByText('Next').closest('button')).toBeDisabled();
  });

  it('fires onPrev when Prev is clicked', () => {
    const onPrev = vi.fn();
    render(<Pagination page={2} pageSize={10} total={35} onPrev={onPrev} onNext={() => {}} />);
    fireEvent.click(screen.getByText('Prev').closest('button')!);
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('fires onNext when Next is clicked', () => {
    const onNext = vi.fn();
    render(<Pagination page={1} pageSize={10} total={35} onPrev={() => {}} onNext={onNext} />);
    fireEvent.click(screen.getByText('Next').closest('button')!);
    expect(onNext).toHaveBeenCalledOnce();
  });
});
