import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sensitive } from '../Sensitive';

describe('Sensitive', () => {
  it('renders children for P0 level', () => {
    render(
      <Sensitive level="P0">
        <span>Public data</span>
      </Sensitive>
    );
    expect(screen.getByText('Public data')).toBeInTheDocument();
  });

  it('renders children for P1 level', () => {
    render(
      <Sensitive level="P1">
        <span>Sensitive data</span>
      </Sensitive>
    );
    expect(screen.getByText('Sensitive data')).toBeInTheDocument();
  });

  it('shows restricted indicator for P1 data', () => {
    const { container } = render(
      <Sensitive level="P1">
        <span>Data</span>
      </Sensitive>
    );
    const indicator = container.querySelector('[data-sensitive="true"]');
    expect(indicator).toBeInTheDocument();
  });

  it('blocks copy when blockCopy is true', () => {
    const { container } = render(
      <Sensitive blockCopy={true}>
        <span>Data</span>
      </Sensitive>
    );
    const sensitive = container.querySelector('[data-sensitive="true"]');
    expect(sensitive).toHaveAttribute(
      'title',
      expect.stringContaining('copy'),
    );
  });

  it('allows all actions when level is P0', () => {
    const { container } = render(
      <Sensitive level="P0" blockCopy={true}>
        <span>Data</span>
      </Sensitive>
    );
    const sensitive = container.querySelector('[data-sensitive="true"]');
    expect(sensitive).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <Sensitive className="custom-sensitive">
        <span>Data</span>
      </Sensitive>
    );
    expect(container.querySelector('.custom-sensitive')).toBeInTheDocument();
  });

  it('shows title tooltip with blocked actions', () => {
    const { container } = render(
      <Sensitive
        blockCopy={true}
        blockDownload={true}
        blockPrint={false}
      >
        <span>Data</span>
      </Sensitive>
    );
    const div = container.querySelector('[data-sensitive="true"]');
    const title = div?.getAttribute('title');
    expect(title).toContain('copy');
    expect(title).toContain('download');
    expect(title).not.toContain('print');
  });
});
