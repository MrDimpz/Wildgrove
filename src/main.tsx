import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
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
const LazyAdminConsole = lazy(() =>
  import('./components/AdminConsole').then((m) => ({ default: m.AdminConsole })),
);

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function RootApp() {
  const [adminRoute, setAdminRoute] = useState<boolean>(() =>
    typeof window !== 'undefined' ? isAdminPath(window.location.pathname) : false,
  );
  const [introFinished, setIntroFinished] = useState(false);

  useEffect(() => {
    const onPopState = () => {
      setAdminRoute(isAdminPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleReturnToGame = useCallback(() => {
    window.history.pushState({}, '', '/');
    setAdminRoute(false);
  }, []);

  // Preload the heavy 3D sanctuary bundle quietly only AFTER the intro video has started playing
  const handleIntroStarted = useCallback(() => {
    void loadAppChunk();
  }, []);

  const handleIntroComplete = useCallback(() => {
    void loadAppChunk();
    setIntroFinished(true);
  }, []);

  if (adminRoute) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-slate-50 flex items-center justify-center text-slate-600 text-sm font-medium">
            Loading Wildgrove Admin Console...
          </div>
        }
      >
        <LazyAdminConsole onReturnToGame={handleReturnToGame} />
      </Suspense>
    );
  }

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
