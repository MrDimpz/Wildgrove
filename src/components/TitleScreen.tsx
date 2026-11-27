import { useEffect, useState } from 'react';
import { CloudDownload, Play } from 'lucide-react';

interface TitleScreenProps {
  existingSyncCode?: string;
  onStart: (keeperName: string, sanctuaryName: string) => void;
  onLoadSyncCode: (code: string) => Promise<boolean>;
}

export function TitleScreen({ existingSyncCode, onStart, onLoadSyncCode }: TitleScreenProps) {
  const [showRestore, setShowRestore] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restoreError, setRestoreError] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showRestore) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStart('Meadow Keeper', 'Sunlit Wildgrove');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showRestore, onStart]);

  const handleRestore = async () => {
    if (!restoreCode.trim()) return;
    setLoadingCode(true);
    setRestoreError('');
    const ok = await onLoadSyncCode(restoreCode.trim());
    setLoadingCode(false);
    if (!ok) {
      setRestoreError('No sanctuary found for that code. Double-check your Sync Code and try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-between px-6 py-10 pointer-events-none select-none">
      {/* Top calm spacing */}
      <div className="h-4" />

      {/* Bespoke Inline SVG Title Lockup + Start CTA over sunlit 3D meadow */}
      <div className="pointer-events-auto flex flex-col items-center text-center max-w-xl w-full">
        <div className="bg-[#FAF6EE]/95 border border-[#263129]/15 rounded-3xl px-8 py-8 shadow-[0_24px_60px_rgba(32,48,34,0.22)] w-full">
          {/* Bespoke SVG Botanical Crest */}
          <svg
            viewBox="0 0 280 86"
            className="w-64 h-20 mx-auto mb-3"
            role="img"
            aria-label="Wildgrove Sanctuary"
          >
            {/* Sunlit meadow arch & leaf crest */}
            <circle cx="140" cy="24" r="14" fill="#F2B84B" />
            <path
              d="M92 34C108 18 124 22 140 34C156 22 172 18 188 34"
              stroke="#3B7A4A"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
            <path d="M114 25C108 17 115 10 124 15C122 21 118 24 114 25Z" fill="#4D8F56" />
            <path d="M166 25C172 17 165 10 156 15C158 21 162 24 166 25Z" fill="#D97236" />
            <text
              x="140"
              y="62"
              textAnchor="middle"
              fill="#233026"
              style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: '30px', fontWeight: 700 }}
            >
              Wildgrove
            </text>
            <text
              x="140"
              y="80"
              textAnchor="middle"
              fill="#5A6B5C"
              style={{
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.24em',
              }}
            >
              ANIMAL SANCTUARY
            </text>
          </svg>

          <p className="text-sm text-[#4A594D] leading-relaxed max-w-md mx-auto mb-6">
            Shelter Raccoons, Gorillas, Butterflies, and Wolves in custom 3D habitats. Harvest treats, play cozy care mini-games, trade rare finds, and visit friends.
          </p>

          {!showRestore ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onStart('Meadow Keeper', 'Sunlit Wildgrove')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] font-semibold text-base shadow-sm transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                {existingSyncCode ? 'Continue Sanctuary' : 'Enter Sanctuary'}
              </button>

              <button
                type="button"
                onClick={() => setShowRestore(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#EFE8DA] hover:bg-[#E5DCCB] text-[#2B382E] font-medium text-sm border border-[#263129]/12 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CloudDownload className="w-4 h-4" />
                Load Sync Code
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-left max-w-sm mx-auto">
              <label className="block text-xs font-semibold text-[#4A594D]">
                Enter Cross-Platform Sync Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={restoreCode}
                  onChange={(e) => setRestoreCode(e.target.value.toUpperCase())}
                  placeholder="GROVE-XXXX"
                  maxLength={16}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#263129]/20 text-sm font-mono-num text-[#233026] focus:outline-none focus:ring-2 focus:ring-[#2F6E49]"
                />
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={loadingCode}
                  className="px-4 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-sm font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {loadingCode ? 'Syncing...' : 'Load'}
                </button>
              </div>
              {restoreError && <p className="text-xs text-[#B83B3B]">{restoreError}</p>}
              <button
                type="button"
                onClick={() => {
                  setShowRestore(false);
                  setRestoreError('');
                }}
                className="text-xs font-medium text-[#5A6B5C] hover:text-[#233026] cursor-pointer"
              >
                Back to Start
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Single flat control-hint line */}
      <div className="pointer-events-auto bg-[#FAF6EE]/92 border border-[#263129]/12 rounded-xl px-4 py-2 text-xs font-medium text-[#3D4C40] shadow-sm">
        Drag to Rotate · Scroll or Pinch to Zoom · Click Enclosures or Crops to Interact · WASD Pan
      </div>
    </div>
  );
}
