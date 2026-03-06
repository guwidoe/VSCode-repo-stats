import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DonutChart } from './DonutChart';

describe('DonutChart', () => {
  it('renders a full-circle arc when there is only one non-zero segment', () => {
    const { container } = render(
      <DonutChart
        title="Line Age by Last Commit (git blame)"
        segments={[
          { label: '0-30d', value: 138340, color: '#4caf50' },
        ]}
      />
    );

    expect(screen.getByText('138,340')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();

    const path = container.querySelector('svg path');
    expect(path).toBeInTheDocument();
    expect(path?.getAttribute('d')?.match(/\bA\b/g)).toHaveLength(2);
  });

  it('omits zero-value segments from the donut and legend', () => {
    const { container } = render(
      <DonutChart
        title="Files by Type"
        segments={[
          { label: '.ts', value: 10, color: '#3178c6' },
          { label: '.md', value: 0, color: '#f1e05a' },
        ]}
      />
    );

    expect(screen.getByText('.ts')).toBeInTheDocument();
    expect(screen.queryByText('.md')).not.toBeInTheDocument();
    expect(container.querySelectorAll('svg path')).toHaveLength(1);
  });
});
