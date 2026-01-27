/**
 * HelpModal - Modal displaying metrics documentation and usage tips.
 */

import { useCallback, useEffect, useRef } from 'react';
import './HelpModal.css';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === modalRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div className="help-modal-backdrop" ref={modalRef} onClick={handleBackdropClick}>
      <div className="help-modal">
        <div className="help-modal-header">
          <h2>Treemap Help</h2>
          <button className="help-modal-close" onClick={onClose} title="Close">
            ×
          </button>
        </div>

        <div className="help-modal-content">
          <section className="help-section">
            <h3>Metrics Glossary</h3>

            <div className="help-metric">
              <h4>Lines of Code (LOC)</h4>
              <p>
                The number of lines containing actual code, excluding comments and blank lines.
                This represents the "real" code that executes.
              </p>
            </div>

            <div className="help-metric">
              <h4>Cyclomatic Complexity</h4>
              <p>
                A measure of code complexity based on the number of independent paths through
                the code. Each decision point (if, for, while, case, catch, &&, ||, ternary)
                adds to complexity.
              </p>
              <ul>
                <li><strong>1-10:</strong> Simple, low risk</li>
                <li><strong>11-20:</strong> Moderate complexity</li>
                <li><strong>21-50:</strong> Complex, higher risk</li>
                <li><strong>50+:</strong> Very complex, consider refactoring</li>
              </ul>
              <p>
                For folders, we show <strong>average</strong> (typical file complexity) and
                <strong> maximum</strong> (worst-case file in that folder).
              </p>
            </div>

            <div className="help-metric">
              <h4>Comment Ratio</h4>
              <p>
                The percentage of lines that are comments. A healthy ratio depends on the
                codebase, but typically 10-30% indicates well-documented code.
              </p>
            </div>

            <div className="help-metric">
              <h4>Code Density</h4>
              <p>
                The percentage of non-blank, non-comment lines. Higher density means more
                code per line, which can indicate either efficient code or code that could
                benefit from more spacing and comments.
              </p>
              <ul>
                <li><strong>High density (80%+):</strong> Dense code, possibly needs comments</li>
                <li><strong>Medium (50-80%):</strong> Balanced</li>
                <li><strong>Low (&lt;50%):</strong> Well-spaced or heavily commented</li>
              </ul>
            </div>

            <div className="help-metric">
              <h4>File Count</h4>
              <p>
                The total number of files within a folder (recursive).
              </p>
            </div>
          </section>

          <section className="help-section">
            <h3>Color Modes</h3>

            <div className="help-item">
              <h4>Language</h4>
              <p>Files are colored by programming language. Each language has a distinct color.</p>
            </div>

            <div className="help-item">
              <h4>Age</h4>
              <p>
                Files are colored by last modification date.
                <span className="help-color-sample help-color-green">Green</span> = recently modified,
                <span className="help-color-sample help-color-red">Red</span> = old/stale.
              </p>
            </div>

            <div className="help-item">
              <h4>Complexity</h4>
              <p>
                Files are colored by cyclomatic complexity.
                <span className="help-color-sample help-color-green">Green</span> = simple,
                <span className="help-color-sample help-color-yellow">Yellow</span> = moderate,
                <span className="help-color-sample help-color-red">Red</span> = complex.
              </p>
            </div>

            <div className="help-item">
              <h4>Density</h4>
              <p>
                Files are colored by code density.
                <span className="help-color-sample help-color-green">Green</span> = dense code,
                <span className="help-color-sample help-color-red">Red</span> = sparse.
              </p>
            </div>
          </section>

          <section className="help-section">
            <h3>Size Modes</h3>

            <div className="help-item">
              <h4>LOC</h4>
              <p>Rectangle size represents lines of code. Larger = more code.</p>
            </div>

            <div className="help-item">
              <h4>Bytes</h4>
              <p>Rectangle size represents file size in bytes.</p>
            </div>

            <div className="help-item">
              <h4>Files</h4>
              <p>Each file gets equal size. Useful for seeing file distribution.</p>
            </div>

            <div className="help-item">
              <h4>Complexity</h4>
              <p>Rectangle size represents cyclomatic complexity. Larger = more complex.</p>
            </div>
          </section>

          <section className="help-section">
            <h3>Navigation</h3>

            <div className="help-item">
              <p><strong>Hover:</strong> View file/folder details in tooltip</p>
              <p><strong>Click:</strong> Select a file or folder</p>
              <p><strong>Double-click folder:</strong> Zoom into that folder</p>
              <p><strong>Double-click file:</strong> Open file in editor</p>
              <p><strong>Right-click:</strong> Context menu with additional options</p>
              <p><strong>Breadcrumb:</strong> Click path segments to navigate up</p>
              <p><strong>Tree view:</strong> Expand/collapse folders, click to select</p>
            </div>
          </section>

          <section className="help-section">
            <h3>Tips for Finding Problem Areas</h3>

            <ul className="help-tips">
              <li>Use <strong>Complexity color mode</strong> to spot red (complex) files that may need refactoring</li>
              <li>Use <strong>Age color mode</strong> to find stale code that hasn't been touched in a while</li>
              <li>Use <strong>Complexity size mode</strong> to make complex files visually larger and easier to spot</li>
              <li>Check the <strong>tree view</strong> for folders with high max complexity</li>
              <li>Low comment ratios in complex files may indicate technical debt</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
