import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvolutionLineChart } from './EvolutionLineChart';

const plotMock = vi.fn(() => null);

vi.mock('react-plotly.js', () => ({
  default: (props: unknown) => plotMock(props),
}));

describe('EvolutionLineChart', () => {
  it('keeps fine-grained snapshot timestamps on the x-axis', () => {
    render(
      <EvolutionLineChart
        data={{
          ts: [
            '2026-01-01T00:00:00.000Z',
            '2026-01-08T00:00:00.000Z',
            '2026-01-15T00:00:00.000Z',
          ],
          labels: ['Alice'],
          y: [[10, 12, 15]],
        }}
        normalize={false}
      />
    );

    expect(plotMock).toHaveBeenCalledTimes(1);

    const props = plotMock.mock.calls[0]?.[0] as {
      data: Array<{ x: string[] }>;
      layout: { xaxis?: { type?: string } };
    };

    expect(props.data[0]?.x).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-08T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
    ]);
    expect(props.layout.xaxis?.type).toBe('date');
  });
});
