import { useEffect, useRef, useState } from 'react';
import {
  Brush,
  CheckCircle2,
  Gem,
  Heart,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import type { EnclosureItem, SanctuaryState } from '../types/game';
import { RESOURCE_CATALOG, SPECIES_CATALOG } from '../data/catalog';
import { soundEngine } from '../audio/soundEngine';
import { SpeciesIcon } from './SpeciesIcon';

interface EnclosureModalProps {
  enclosure: EnclosureItem;
  sanctuary: SanctuaryState;
  isVisiting: boolean;
  onClose: () => void;
  onCompleteFeeding: (enclosureId: string, score: number, combo: number) => void;
  onCompleteGrooming: (enclosureId: string, cleanlinessPct: number) => void;
  onUpgradeExotic: (enclosureId: string) => void;
  onSendVisitGift: (enclosureId: string) => void;
}

type ModalMode = 'overview' | 'feed' | 'groom';

interface GroomSpot {
  id: number;
  x: number;
  y: number;
  r: number;
  alpha: number;
}

export function EnclosureModal({
  enclosure,
  sanctuary,
  isVisiting,
  onClose,
  onCompleteFeeding,
  onCompleteGrooming,
  onUpgradeExotic,
  onSendVisitGift,
}: EnclosureModalProps) {
  const spec = SPECIES_CATALOG[enclosure.species];
  const treatDef = RESOURCE_CATALOG[spec.favoriteTreat];
  const rareDef = RESOURCE_CATALOG[spec.rareDrop];
  const treatCount = sanctuary.inventory[spec.favoriteTreat] || 0;

  const [mode, setMode] = useState<ModalMode>('overview');

  // --- FEEDING MINI-GAME STATE (Timing Sweet-Spot Treat Toss) ---
  const [feedRound, setFeedRound] = useState(0);
  const [feedScore, setFeedScore] = useState(0);
  const [feedCombo, setFeedCombo] = useState(0);
  const [markerPos, setMarkerPos] = useState(15); // 0..100
  const [targetCenter, setTargetCenter] = useState(50);
  const [feedFeedback, setFeedFeedback] = useState<string | null>(null);
  const markerDirRef = useRef(1);
  const markerPosRef = useRef(15);

  useEffect(() => {
    if (mode !== 'feed') return;
    let raf = 0;
    let last = performance.now();
    const speed = 78 + feedRound * 16;

    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      markerPosRef.current += markerDirRef.current * speed * dt;
      if (markerPosRef.current >= 96) {
        markerPosRef.current = 96;
        markerDirRef.current = -1;
      } else if (markerPosRef.current <= 4) {
        markerPosRef.current = 4;
        markerDirRef.current = 1;
      }
      setMarkerPos(markerPosRef.current);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [mode, feedRound]);

  const startFeedingGame = () => {
    soundEngine.playClick();
    setFeedRound(0);
    setFeedScore(0);
    setFeedCombo(0);
    setTargetCenter(38 + Math.floor(Math.random() * 28));
    setFeedFeedback(null);
    markerPosRef.current = 12;
    markerDirRef.current = 1;
    setMode('feed');
  };

  const handleFeedToss = () => {
    const dist = Math.abs(markerPosRef.current - targetCenter);
    let points = 0;
    let label = 'Soft Catch';
    let nextCombo = feedCombo;
    if (dist <= 7.5) {
      points = 30;
      nextCombo = feedCombo + 1;
      label = `Perfect Toss! x${nextCombo}`;
      soundEngine.playFeedHit(nextCombo);
    } else if (dist <= 16) {
      points = 18;
      nextCombo = feedCombo + 1;
      label = 'Tasty Catch!';
      soundEngine.playFeedHit(1);
    } else {
      points = 8;
      nextCombo = 0;
      label = 'Close Toss!';
      soundEngine.playClick();
    }

    const nextScore = feedScore + points;
    const nextRound = feedRound + 1;
    setFeedScore(nextScore);
    setFeedCombo(nextCombo);
    setFeedFeedback(label);

    if (nextRound >= 5) {
      soundEngine.playCelebration();
      onCompleteFeeding(enclosure.id, nextScore, Math.max(1, nextCombo));
      setMode('overview');
    } else {
      setFeedRound(nextRound);
      setTargetCenter(22 + Math.floor(Math.random() * 56));
    }
  };

  // --- GROOMING MINI-GAME STATE (Interactive Brush & Sparkle Scrub) ---
  const [groomSpots, setGroomSpots] = useState<GroomSpot[]>([]);
  const [groomSparkles, setGroomSparkles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isBrushing, setIsBrushing] = useState(false);
  const groomSurfaceRef = useRef<HTMLDivElement | null>(null);
  const lastSparkleSoundRef = useRef(0);

  const startGroomingGame = () => {
    soundEngine.playClick();
    const spots: GroomSpot[] = [
      { id: 1, x: 26, y: 34, r: 22, alpha: 1 },
      { id: 2, x: 52, y: 26, r: 24, alpha: 1 },
      { id: 3, x: 72, y: 44, r: 22, alpha: 1 },
      { id: 4, x: 38, y: 62, r: 24, alpha: 1 },
      { id: 5, x: 64, y: 68, r: 20, alpha: 1 },
      { id: 6, x: 48, y: 48, r: 21, alpha: 1 },
    ];
    setGroomSpots(spots);
    setGroomSparkles([]);
    setMode('groom');
  };

  const scrubAtPoint = (clientX: number, clientY: number) => {
    const el = groomSurfaceRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * 100;
    const py = ((clientY - rect.top) / rect.height) * 100;

    let hitAny = false;
    setGroomSpots((prev) => {
      const updated = prev.map((s) => {
        if (s.alpha <= 0) return s;
        const d = Math.hypot(s.x - px, s.y - py);
        if (d < 17) {
          hitAny = true;
          return { ...s, alpha: Math.max(0, s.alpha - 0.14) };
        }
        return s;
      });
      return updated;
    });

    if (hitAny) {
      const now = performance.now();
      if (now - lastSparkleSoundRef.current > 110) {
        soundEngine.playGroomSparkle();
        lastSparkleSoundRef.current = now;
      }
      const spId = Math.random();
      setGroomSparkles((prev) => [...prev.slice(-10), { id: spId, x: px, y: py }]);
    }
  };

  const remainingSpots = groomSpots.filter((s) => s.alpha > 0.08).length;
  const cleanlinessPct =
    groomSpots.length === 0
      ? 100
      : Math.round(
          ((groomSpots.length - groomSpots.reduce((acc, s) => acc + s.alpha, 0)) / groomSpots.length) *
            100,
        );

  const finishGrooming = () => {
    soundEngine.playCelebration();
    onCompleteGrooming(enclosure.id, Math.max(cleanlinessPct, 65));
    setMode('overview');
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#19241B]/45">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#FAF6EE] border border-[#263129]/15 rounded-3xl shadow-[0_24px_64px_rgba(24,36,26,0.3)] overflow-hidden sanctuary-modal">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#263129]/10 bg-[#F3ECE0]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FAF6EE] border border-[#263129]/10 flex items-center justify-center">
              <SpeciesIcon
                species={enclosure.species}
                exotic={enclosure.variant === 'exotic'}
                className="w-8 h-8"
              />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-[#233026] leading-tight">
                {enclosure.name}
              </h2>
              <div className="text-xs text-[#5A6B5C]">
                {enclosure.variant === 'exotic' ? spec.exoticName : spec.name} · {spec.habitatTitle}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#E6DEC9] text-[#455447] cursor-pointer"
            aria-label="Close Enclosure Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {mode === 'overview' && (
            <div className="space-y-5">
              {/* Care Bars */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Happiness', value: enclosure.happiness, color: '#D97B29' },
                  { label: 'Fullness', value: enclosure.hunger, color: '#3A8455' },
                  { label: 'Grooming', value: enclosure.grooming, color: '#3B82B8' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-[#F3ECE0] rounded-2xl p-3">
                    <div className="flex items-center justify-between text-xs text-[#546457] mb-1.5">
                      <span>{stat.label}</span>
                      <span className="font-mono-num font-semibold text-[#233026]">{stat.value}%</span>
                    </div>
                    <div className="h-2 bg-[#E2D9C7] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${stat.value}%`, backgroundColor: stat.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Bond & Yield Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#546457] px-1">
                <span>
                  Bond Level <strong className="font-mono-num text-[#233026]">{enclosure.bondLevel}</strong> ·{' '}
                  Visitor Hearts <strong className="font-mono-num text-[#233026]">{enclosure.visitorHearts}</strong>
                </span>
                <span>
                  Rare Drop: <strong className="text-[#233026]">{rareDef.name}</strong>
                </span>
              </div>

              {isVisiting ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playCelebration();
                    onSendVisitGift(enclosure.id);
                    onClose();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] font-semibold text-sm cursor-pointer"
                >
                  <Heart className="w-4 h-4 fill-current" />
                  Pet &amp; Leave Care Gift (+40 Coins &amp; +1 Heart)
                </button>
              ) : (
                <>
                  {/* Mini-Game Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startFeedingGame}
                      disabled={treatCount <= 0}
                      className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] text-left transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Utensils className="w-4 h-4" />
                        <span>{spec.feedVerb}</span>
                      </div>
                      <span className="text-xs text-[#D5E9DC]">
                        {treatDef.name}: <span className="font-mono-num font-semibold">{treatCount}</span> in pantry
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={startGroomingGame}
                      className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-[#C46B33] hover:bg-[#AB5A28] text-[#FAF6EE] text-left transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        <Brush className="w-4 h-4" />
                        <span>Groom &amp; Care</span>
                      </div>
                      <span className="text-xs text-[#F9E3D4]">{spec.groomToolName}</span>
                    </button>
                  </div>

                  {/* Exotic Morph Upgrade */}
                  {enclosure.variant === 'classic' && (
                    <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#233026] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#C9851E] shrink-0" />
                          <span className="truncate">Awaken {spec.exoticName}</span>
                        </div>
                        <p className="text-xs text-[#5A6B5C]">
                          +160 Prestige &amp; shimmering rare habitat aura
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpgradeExotic(enclosure.id)}
                        disabled={sanctuary.gems < spec.exoticCostGems}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2A6F97] hover:bg-[#21597A] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
                      >
                        <Gem className="w-3.5 h-3.5" />
                        {spec.exoticCostGems} Gems
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* --- SPECIALIZED FEEDING MINI-GAME --- */}
          {mode === 'feed' && (
            <div className="space-y-5 text-center">
              <div>
                <h3 className="font-display font-bold text-lg text-[#233026]">
                  {spec.feedVerb} — Round {feedRound + 1} / 5
                </h3>
                <p className="text-xs text-[#5A6B5C] mt-1">
                  Tap Toss Treat when the marker glides inside the golden sweet spot.
                </p>
              </div>

              {/* Interactive Rhythm Timing Bar */}
              <div className="relative h-14 bg-[#EDE4D3] rounded-2xl border border-[#263129]/15 overflow-hidden px-2 flex items-center">
                {/* Sweet Spot Target Zone */}
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-xl bg-[#E8B13E]/35 border-2 border-[#C9851E]"
                  style={{
                    left: `${Math.max(2, targetCenter - 11)}%`,
                    width: '22%',
                  }}
                />
                {/* Perfect Bullseye Line */}
                <div
                  className="absolute top-1 bottom-1 w-1 bg-[#B8561D] rounded-full"
                  style={{ left: `${targetCenter}%` }}
                />
                {/* Moving Treat Marker */}
                <div
                  className="absolute top-2 bottom-2 w-4 -ml-2 rounded-lg bg-[#2F6E49] shadow-md"
                  style={{ left: `${markerPos}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono-num text-[#4B5A4E] px-1">
                <span>Score: {feedScore}</span>
                <span className="font-sans font-semibold text-[#C46B33]">
                  {feedFeedback || 'Aim for the golden zone'}
                </span>
                <span>Combo: x{feedCombo}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('overview')}
                  className="px-4 py-3 rounded-xl bg-[#EFE7D8] text-[#354438] text-sm font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleFeedToss}
                  className="flex-1 py-3.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] font-semibold text-base shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
                >
                  Toss {treatDef.name}
                </button>
              </div>
            </div>
          )}

          {/* --- SPECIALIZED GROOMING MINI-GAME --- */}
          {mode === 'groom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#233026]">
                    {spec.groomToolName}
                  </h3>
                  <p className="text-xs text-[#5A6B5C]">{spec.groomTaskLabel}</p>
                </div>
                <span className="font-mono-num font-bold text-sm text-[#2F6E49]">
                  {cleanlinessPct}% Clean
                </span>
              </div>

              {/* Interactive Grooming Scrub Surface */}
              <div
                ref={groomSurfaceRef}
                onPointerDown={(e) => {
                  setIsBrushing(true);
                  scrubAtPoint(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (isBrushing) scrubAtPoint(e.clientX, e.clientY);
                }}
                onPointerUp={() => setIsBrushing(false)}
                onPointerLeave={() => setIsBrushing(false)}
                className="relative h-56 rounded-2xl bg-[#EFE6D4] border-2 border-dashed border-[#263129]/20 overflow-hidden select-none touch-none cursor-crosshair flex items-center justify-center"
              >
                {/* Centered Species Portrait */}
                <div className="pointer-events-none flex flex-col items-center">
                  <SpeciesIcon
                    species={enclosure.species}
                    exotic={enclosure.variant === 'exotic'}
                    className="w-36 h-36 opacity-95"
                  />
                  <span className="text-xs font-medium text-[#5A6B5C] mt-1">
                    Drag or rub gently over every mud &amp; pollen patch
                  </span>
                </div>

                {/* Scrubbable Dirt / Pollen / Burr Patches */}
                {groomSpots.map((spot) =>
                  spot.alpha > 0.04 ? (
                    <div
                      key={spot.id}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        left: `${spot.x}%`,
                        top: `${spot.y}%`,
                        width: `${spot.r * 2}px`,
                        height: `${spot.r * 2}px`,
                        opacity: spot.alpha,
                        background:
                          enclosure.species === 'butterfly'
                            ? 'radial-gradient(circle, rgba(235,190,56,0.92), rgba(210,152,32,0.55))'
                            : 'radial-gradient(circle, rgba(110,78,52,0.9), rgba(84,56,34,0.45))',
                      }}
                    />
                  ) : null,
                )}

                {/* Sparkle Feedback */}
                {groomSparkles.map((sp) => (
                  <Sparkles
                    key={sp.id}
                    className="pointer-events-none absolute w-4 h-4 text-[#E6A22E] -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${sp.x}%`, top: `${sp.y}%` }}
                  />
                ))}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMode('overview')}
                  className="px-4 py-2.5 rounded-xl bg-[#EFE7D8] text-[#354438] text-sm font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={finishGrooming}
                  disabled={cleanlinessPct < 60}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white font-semibold text-sm cursor-pointer disabled:opacity-45"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {remainingSpots === 0
                    ? 'Gleaming! Claim Grooming Bonus'
                    : `Finish Care (${cleanlinessPct}% brushed)`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
