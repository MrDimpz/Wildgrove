import { Suspense, lazy, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntroVideoOverlay } from './components/IntroVideoOverlay';
import './index.css';

let appChunkPromise: Promise<typeof import('./App')> | null = null;

function loadAppChunk() {
  if (!appChunkPromise) {
    appChunkPromise = import('./App');
  }
  return appChunkPromise;
}

const LazyApp = lazy(loadAppChunk);

function RootApp() {
  const [introFinished, setIntroFinished] = useState(false);

  // Preload the heavy 3D sanctuary bundle quietly only AFTER the intro video has started playing
  const handleIntroStarted = useCallback(() => {
    void loadAppChunk();
  }, []);

  const handleIntroComplete = useCallback(() => {
    void loadAppChunk();
    setIntroFinished(true);
  }, []);

  if (!introFinished) {
    return (
      <IntroVideoOverlay
        onStarted={handleIntroStarted}
        onComplete={handleIntroComplete}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#0F1711] flex items-center justify-center text-[#FAF6EE]/80 text-sm font-medium">
          Entering Wildgrove Sanctuary...
        </div>
      }
    >
      <LazyApp />
    </Suspense>
  );
}

createRoot(document.getElementById('root')!).render(<RootApp />);
