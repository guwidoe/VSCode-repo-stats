import type { HTMLAttributes, ReactNode, Ref } from 'react';
import './DataGridFrame.css';

interface DataGridFrameProps {
  header: ReactNode;
  children: ReactNode;
  minWidth?: number | string;
  className?: string;
  tableClassName?: string;
  bodyClassName?: string;
  bodyRef?: Ref<HTMLDivElement>;
  bodyProps?: HTMLAttributes<HTMLDivElement>;
}

function joinClasses(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export function DataGridFrame({
  header,
  children,
  minWidth,
  className,
  tableClassName,
  bodyClassName,
  bodyRef,
  bodyProps,
}: DataGridFrameProps) {
  const { className: bodyPropsClassName, ...restBodyProps } = bodyProps ?? {};

  return (
    <div className={joinClasses('data-grid-shell', className)}>
      <div
        className={joinClasses('data-grid-table', tableClassName)}
        style={minWidth !== undefined ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth } : undefined}
      >
        {header}
        <div
          {...restBodyProps}
          ref={bodyRef}
          className={joinClasses('data-grid-body', bodyClassName, bodyPropsClassName)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
