import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.js';

describe('Nivasa Frontend Application', () => {
  it('renders branding and navigation header', () => {
    render(<App />);
    expect(screen.getByText('Nivasa')).toBeInTheDocument();
    expect(screen.getByText('Township Ops')).toBeInTheDocument();
  });

  it('renders resident home hero card with dues summary', () => {
    render(<App />);
    expect(screen.getByText(/Maintenance Due/i)).toBeInTheDocument();
    expect(screen.getByText(/Fully Paid|Pay Maintenance/i)).toBeInTheDocument();
  });

  it('renders open complaints and notices sections', () => {
    render(<App />);
    expect(screen.getByText('Active Complaints')).toBeInTheDocument();
    expect(screen.getByText('Important Notices')).toBeInTheDocument();
    expect(screen.getByText("Today's Visitors")).toBeInTheDocument();
  });
});
