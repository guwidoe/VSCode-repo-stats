import type { ReactNode } from 'react';
import './DataGridFrame.css';

interface DataGridToolbarProps {
  start?: ReactNode;
  end?: ReactNode;
  summary?: ReactNode;
  className?: string;
}

function joinClasses(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function DataGridToolbar({ start, end, summary, className }: DataGridToolbarProps) {
  return (
    <div className={joinClasses('data-grid-toolbar', className)}>
      <div className="data-grid-toolbar-main">
        {start && <div className="data-grid-toolbar-start">{start}</div>}
        {end && <div className="data-grid-toolbar-end">{end}</div>}
      </div>
      {summary && <div className="data-grid-toolbar-summary">{summary}</div>}
    </div>
  );
}
