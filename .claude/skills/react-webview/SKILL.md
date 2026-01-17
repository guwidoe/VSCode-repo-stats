---
name: react-webview-development
description: Develop React components for VSCode webviews, handle postMessage communication, implement D3/Plotly visualizations
allowed-tools: Bash, Read, Grep, Glob, Write, Edit
---

# React Webview Development Skill

## When to Use
Apply this skill when:
- Creating new React components for the webview
- Implementing D3.js treemap visualization
- Adding Plotly.js charts
- Setting up postMessage communication with extension host

## Component Patterns

### 1. Basic Component Structure
```tsx
import React from 'react';
import { useStore } from '../store';

interface Props {
  title: string;
}

export const MyComponent: React.FC<Props> = ({ title }) => {
  const data = useStore((state) => state.data);

  return (
    <div className="my-component">
      <h2>{title}</h2>
      {/* Component content */}
    </div>
  );
};
```

### 2. postMessage Communication

#### Sending to Extension
```tsx
import { useVsCodeApi } from '../hooks/useVsCodeApi';

export const DataRequestComponent: React.FC = () => {
  const vscode = useVsCodeApi();

  const requestData = () => {
    vscode.postMessage({
      type: 'requestData',
      payload: { timeRange: 'lastMonth' }
    });
  };

  return <button onClick={requestData}>Load Data</button>;
};
```

#### Receiving from Extension
```tsx
import { useEffect } from 'react';
import { useStore } from '../store';

export const DataListener: React.FC = () => {
  const setContributors = useStore((state) => state.setContributors);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'contributorsData':
          setContributors(message.payload);
          break;
        case 'error':
          console.error('Extension error:', message.payload);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [setContributors]);

  return null;
};
```

### 3. VSCode API Hook
```tsx
// hooks/useVsCodeApi.ts
interface VsCodeApi {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

let vscodeApi: VsCodeApi | null = null;

export const useVsCodeApi = (): VsCodeApi => {
  if (!vscodeApi) {
    // @ts-expect-error VSCode injects this
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
};
```

## D3.js Treemap Implementation

### Basic Treemap Setup
```tsx
import * as d3 from 'd3-hierarchy';
import { TreemapNode } from '../types';

interface TreemapProps {
  data: TreemapNode;
  width: number;
  height: number;
  onNodeClick: (node: TreemapNode) => void;
}

export const Treemap: React.FC<TreemapProps> = ({ data, width, height, onNodeClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    const treemapLayout = d3.treemap<TreemapNode>()
      .size([width, height])
      .paddingInner(2)
      .paddingOuter(4)
      .round(true);

    const root = d3.hierarchy(data)
      .sum((d) => d.lines || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    treemapLayout(root);

    // Canvas rendering
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    root.leaves().forEach((leaf) => {
      const { x0, y0, x1, y1 } = leaf;
      ctx.fillStyle = getLanguageColor(leaf.data.language);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    });
  }, [data, width, height]);

  return <canvas ref={canvasRef} width={width} height={height} />;
};
```

### Language Color Palette
```tsx
// utils/colors.ts
export const languageColors: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CSS: '#563d7c',
  HTML: '#e34c26',
  JSON: '#292929',
  Markdown: '#083fa1',
};

export const getLanguageColor = (language?: string): string => {
  return languageColors[language || ''] || '#808080';
};
```

## Plotly.js Charts

### Commits Over Time Chart
```tsx
import Plot from 'react-plotly.js';
import { WeeklyCommit } from '../types';

interface CommitsChartProps {
  data: WeeklyCommit[];
}

export const CommitsChart: React.FC<CommitsChartProps> = ({ data }) => {
  return (
    <Plot
      data={[{
        x: data.map(d => d.week),
        y: data.map(d => d.commits),
        type: 'bar',
        marker: { color: '#0078d4' },
      }]}
      layout={{
        title: 'Commits Over Time',
        xaxis: { title: 'Week' },
        yaxis: { title: 'Commits' },
        margin: { l: 50, r: 20, t: 40, b: 50 },
      }}
      config={{ responsive: true }}
    />
  );
};
```

### Code Frequency Chart (Additions/Deletions)
```tsx
import Plot from 'react-plotly.js';
import { CodeFrequency } from '../types';

interface CodeFrequencyChartProps {
  data: CodeFrequency[];
}

export const CodeFrequencyChart: React.FC<CodeFrequencyChartProps> = ({ data }) => {
  return (
    <Plot
      data={[
        {
          x: data.map(d => d.week),
          y: data.map(d => d.additions),
          type: 'bar',
          name: 'Additions',
          marker: { color: '#28a745' },
        },
        {
          x: data.map(d => d.week),
          y: data.map(d => -d.deletions),
          type: 'bar',
          name: 'Deletions',
          marker: { color: '#dc3545' },
        },
      ]}
      layout={{
        barmode: 'relative',
        title: 'Code Frequency',
        xaxis: { title: 'Week' },
        yaxis: { title: 'Lines of Code' },
      }}
      config={{ responsive: true }}
    />
  );
};
```

## Zustand Store Pattern

```tsx
// store/index.ts
import { create } from 'zustand';
import { ContributorStats, CodeFrequency, TreemapNode } from '../types';

interface StoreState {
  // Data
  contributors: ContributorStats[];
  codeFrequency: CodeFrequency[];
  treemapData: TreemapNode | null;

  // UI State
  activeView: 'contributors' | 'frequency' | 'treemap';
  isLoading: boolean;
  error: string | null;

  // Actions
  setContributors: (data: ContributorStats[]) => void;
  setCodeFrequency: (data: CodeFrequency[]) => void;
  setTreemapData: (data: TreemapNode) => void;
  setActiveView: (view: 'contributors' | 'frequency' | 'treemap') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<StoreState>((set) => ({
  contributors: [],
  codeFrequency: [],
  treemapData: null,
  activeView: 'contributors',
  isLoading: false,
  error: null,

  setContributors: (data) => set({ contributors: data }),
  setCodeFrequency: (data) => set({ codeFrequency: data }),
  setTreemapData: (data) => set({ treemapData: data }),
  setActiveView: (view) => set({ activeView: view }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
```

## Testing Webview Components

### Basic Component Test
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContributorCard } from './ContributorCard';

describe('ContributorCard', () => {
  const mockContributor = {
    name: 'John Doe',
    email: 'john@example.com',
    commits: 150,
    linesAdded: 5000,
    linesDeleted: 2000,
  };

  it('renders contributor name', () => {
    render(<ContributorCard contributor={mockContributor} rank={1} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('displays commit count', () => {
    render(<ContributorCard contributor={mockContributor} rank={1} />);
    expect(screen.getByText('150')).toBeInTheDocument();
  });
});
```

### Mocking VSCode API in Tests
```tsx
// test/setup.ts
import { vi } from 'vitest';

const mockVsCode = {
  postMessage: vi.fn(),
  getState: vi.fn(() => ({})),
  setState: vi.fn(),
};

(globalThis as any).acquireVsCodeApi = () => mockVsCode;

export { mockVsCode };
```

## Validation
After implementing webview features:
1. Build webview: `npm run build:webview`
2. Run webview tests: `npm run test:unit`
3. Visual verification in Extension Development Host
4. Check no console errors in webview DevTools
