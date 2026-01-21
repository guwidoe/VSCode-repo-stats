import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TreemapLegend } from './TreemapLegend';

const mockLanguageCounts = new Map([
  ['TypeScript', 5000],
  ['JavaScript', 3000],
  ['CSS', 1000],
]);

describe('TreemapLegend', () => {
  it('should render language legend in language mode', () => {
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={mockLanguageCounts}
      />
    );
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
  });

  it('should render age legend in age mode', () => {
    render(
      <TreemapLegend
        colorMode="age"
        languageCounts={mockLanguageCounts}
      />
    );
    expect(screen.getByText('Recent')).toBeInTheDocument();
    expect(screen.getByText('Old')).toBeInTheDocument();
  });

  it('should limit displayed languages to top 8', () => {
    const manyLanguages = new Map([
      ['Lang1', 1000], ['Lang2', 900], ['Lang3', 800], ['Lang4', 700],
      ['Lang5', 600], ['Lang6', 500], ['Lang7', 400], ['Lang8', 300],
      ['Lang9', 200], ['Lang10', 100],
    ]);
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={manyLanguages}
      />
    );
    expect(screen.getByText('Lang1')).toBeInTheDocument();
    expect(screen.getByText('Lang8')).toBeInTheDocument();
    expect(screen.queryByText('Lang9')).not.toBeInTheDocument();
  });

  it('should display line counts for languages', () => {
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={mockLanguageCounts}
      />
    );
    // 5000 should be formatted as 5.0K
    expect(screen.getByText('5.0K')).toBeInTheDocument();
    // 3000 should be formatted as 3.0K
    expect(screen.getByText('3.0K')).toBeInTheDocument();
    // 1000 should be formatted as 1.0K
    expect(screen.getByText('1.0K')).toBeInTheDocument();
  });

  it('should sort languages by line count descending', () => {
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={mockLanguageCounts}
      />
    );
    const legendItems = screen.getAllByText(/TypeScript|JavaScript|CSS/);
    // TypeScript should come first (5000 lines), then JavaScript (3000), then CSS (1000)
    expect(legendItems[0].textContent).toBe('TypeScript');
    expect(legendItems[1].textContent).toBe('JavaScript');
    expect(legendItems[2].textContent).toBe('CSS');
  });

  it('should render empty legend when no languages provided', () => {
    render(
      <TreemapLegend
        colorMode="language"
        languageCounts={new Map()}
      />
    );
    // Should render the container but no legend items
    const container = document.querySelector('.treemap-legend');
    expect(container).toBeInTheDocument();
  });

  it('should show age gradient bar in age mode', () => {
    render(
      <TreemapLegend
        colorMode="age"
        languageCounts={mockLanguageCounts}
      />
    );
    const gradientBar = document.querySelector('.age-gradient');
    expect(gradientBar).toBeInTheDocument();
  });
});
