import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CommandPalette from './CommandPalette.jsx';

const groups = [
  { label: 'Operations', items: [{ to: '/intake', icon: '↑', label: 'Intake' }, { to: '/approvals', icon: '✓', label: 'Approvals' }] },
  { label: 'Policy', items: [{ to: '/policy', icon: '⚖', label: 'Policy Manager' }] }
];

describe('CommandPalette', () => {
  it('lists every navigable page by default', () => {
    render(<CommandPalette groups={groups} onNavigate={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/Intake/)).toBeInTheDocument();
    expect(screen.getByText(/Policy Manager/)).toBeInTheDocument();
  });

  it('filters results as the user types', () => {
    render(<CommandPalette groups={groups} onNavigate={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'policy' } });
    expect(screen.getByText(/Policy Manager/)).toBeInTheDocument();
    expect(screen.queryByText(/Intake/)).not.toBeInTheDocument();
  });

  it('navigates on click', () => {
    const onNavigate = vi.fn();
    render(<CommandPalette groups={groups} onNavigate={onNavigate} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/Approvals/));
    expect(onNavigate).toHaveBeenCalledWith('/approvals');
  });

  it('shows an honest empty state instead of nothing', () => {
    render(<CommandPalette groups={groups} onNavigate={() => {}} onClose={() => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz-nothing-matches' } });
    expect(screen.getByText(/No matching pages/)).toBeInTheDocument();
  });
});
