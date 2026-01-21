import './TreemapBreadcrumb.css';

interface TreemapBreadcrumbProps {
  path: string[];
  onNavigate: (path: string[]) => void;
}

export function TreemapBreadcrumb({ path, onNavigate }: TreemapBreadcrumbProps) {
  const handleClick = (index: number) => {
    if (index === path.length - 1) {return;} // Last segment not clickable
    onNavigate(path.slice(0, index + 1));
  };

  const handleRootClick = () => {
    if (path.length === 0) {return;} // Already at root
    onNavigate([]);
  };

  return (
    <div className="treemap-breadcrumb">
      <span
        className={`breadcrumb-segment ${path.length === 0 ? 'current' : 'clickable'}`}
        onClick={path.length > 0 ? handleRootClick : undefined}
      >
        root
      </span>
      {path.map((segment, index) => (
        <span key={index}>
          <span className="breadcrumb-separator">/</span>
          <span
            className={`breadcrumb-segment ${index === path.length - 1 ? 'current' : 'clickable'}`}
            onClick={index < path.length - 1 ? () => handleClick(index) : undefined}
          >
            {segment}
          </span>
        </span>
      ))}
    </div>
  );
}
