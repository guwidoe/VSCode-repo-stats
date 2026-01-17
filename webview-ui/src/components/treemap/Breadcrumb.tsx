import React from 'react';

interface Props {
  path: string[];
  rootName: string;
  onNavigate: (index: number) => void;
}

export const Breadcrumb: React.FC<Props> = ({ path, rootName, onNavigate }) => {
  return (
    <div className="breadcrumb">
      <span
        className="breadcrumb-item"
        onClick={() => onNavigate(0)}
      >
        {rootName}
      </span>
      {path.map((segment, index) => (
        <React.Fragment key={index}>
          <span className="breadcrumb-separator">/</span>
          <span
            className="breadcrumb-item"
            onClick={() => onNavigate(index + 1)}
          >
            {segment}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};
