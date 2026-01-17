import { useEffect } from 'react';
import { useStore } from './store';
import { useVsCodeApi } from './hooks/useVsCodeApi';
import { Navigation } from './components/Navigation';
import { ContributorsPanel } from './components/contributors/ContributorsPanel';
import { CodeFrequencyPanel } from './components/frequency/CodeFrequencyPanel';
import { TreemapPanel } from './components/treemap/TreemapPanel';

function App() {
  const vscode = useVsCodeApi();
  const {
    activeView,
    isLoading,
    error,
    setContributors,
    setCodeFrequency,
    setTreemapData,
    setRepoInfo,
    setLoading,
    setError,
  } = useStore();

  useEffect(() => {
    // Request initial data
    vscode.postMessage({ type: 'requestData' });

    // Listen for messages from the extension
    const handler = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'dataUpdate':
          setContributors(message.payload.contributors);
          setCodeFrequency(message.payload.codeFrequency);
          setTreemapData(message.payload.treemap);
          setRepoInfo(message.payload.repoInfo);
          setError(null);
          break;

        case 'loading':
          setLoading(message.payload);
          break;

        case 'error':
          setError(message.payload);
          setLoading(false);
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [vscode, setContributors, setCodeFrequency, setTreemapData, setRepoInfo, setLoading, setError]);

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading">
          Analyzing repository... This may take a moment for large repos.
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navigation />
      <div className="panel">
        {activeView === 'contributors' && <ContributorsPanel />}
        {activeView === 'frequency' && <CodeFrequencyPanel />}
        {activeView === 'treemap' && <TreemapPanel />}
      </div>
    </div>
  );
}

export default App;
