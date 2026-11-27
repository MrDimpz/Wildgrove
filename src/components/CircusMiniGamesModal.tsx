/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Coins,
  Fish,
  Flame,
  Flower2,
  Leaf,
  Play,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  Trophy,
  Waves,
  X,
} from 'lucide-react';
import type { ResourceId, SanctuaryState, SpeciesId } from '../types/game';
import { RESOURCE_CATALOG, SPECIES_CATALOG } from '../data/catalog';
import { soundEngine } from '../audio/soundEngine';
import { SpeciesIcon } from './SpeciesIcon';

export interface MiniGameRewardPayload {
  gameTitle: string;
  coins: number;
  xp: number;
  lanternPoints: number;
  resource?: { id: ResourceId; qty: number };
}

interface CircusMiniGamesModalProps {
  sanctuary: SanctuaryState;
  onClose: () => void;
  onClaimReward: (reward: MiniGameRewardPayload) => void;
}

type MiniGameId =
  | 'lilypad_hop'
  | 'firefly_catcher'
  | 'chameleon_match'
  | 'creekside_fishing'
  | 'kitchen_bakeoff'
  | 'meadow_derby';

interface GameCardMeta {
  id: MiniGameId;
  title: string;
  subtitle: string;
  rewardHint: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  species: SpeciesId;
}

const MINI_GAMES: GameCardMeta[] = [
  {
    id: 'lilypad_hop',
    title: 'Lilypad Hop',
    subtitle: 'Guide an Emerald Tree Frog across drifting pond pads and snag golden dragonflies.',
    rewardHint: 'Coins, XP & Jade Lily Dew',
    accentBg: 'bg-[#E7F5EC]',
    accentBorder: 'border-[#2F6E49]/25',
    accentText: 'text-[#1F5436]',
    species: 'tree_frog',
  },
  {
    id: 'firefly_catcher',
    title: 'Firefly & Butterfly Catcher',
    subtitle: 'Tap glowing dusk fireflies and prism butterflies before the 20s lantern timer runs out.',
    rewardHint: 'Coins, Lantern Pts & Wing Dust',
    accentBg: 'bg-[#FEF3DD]',
    accentBorder: 'border-[#C9851E]/30',
    accentText: 'text-[#73450C]',
    species: 'butterfly',
  },
  {
    id: 'chameleon_match',
    title: 'Chameleon Color Match',
    subtitle: 'Repeat the Sunleaf Chameleon’s hibiscus petal sequence across escalating memory rounds.',
    rewardHint: 'Coins, XP & Prism Scales',
    accentBg: 'bg-[#F3EAFA]',
    accentBorder: 'border-[#7E49A8]/25',
    accentText: 'text-[#4F2570]',
    species: 'chameleon',
  },
  {
    id: 'creekside_fishing',
    title: 'Creekside Fishing',
    subtitle: 'Cast into the sunlit brook and reel right as the bobber splashes for rare catches.',
    rewardHint: 'Coins, Pond Fish & River Pearls',
    accentBg: 'bg-[#E5F2FA]',
    accentBorder: 'border-[#2A6F97]/25',
    accentText: 'text-[#1D4E6B]',
    species: 'river_otter',
  },
  {
    id: 'kitchen_bakeoff',
    title: 'Meadow Kitchen Bake-Off',
    subtitle: 'Stop the hearth gauge right inside the golden crust zone across 3 cozy baking rounds.',
    rewardHint: 'Coins & Gourmet Meadow Tarts',
    accentBg: 'bg-[#FCECE7]',
    accentBorder: 'border-[#C45B3B]/25',
    accentText: 'text-[#7D2F18]',
    species: 'raccoon',
  },
  {
    id: 'meadow_derby',
    title: 'Tortoise & Critter Derby',
    subtitle: 'Pick a sanctuary racer and cheer on the beat to sprint across the clover finish line.',
    rewardHint: 'Coins, Lantern Pts & Golden Acorn',
    accentBg: 'bg-[#F7F1DC]',
    accentBorder: 'border-[#9C7624]/25',
    accentText: 'text-[#5C4410]',
    species: 'giant_tortoise',
  },
];

function RewardBanner({
  reward,
  summary,
  onPlayAgain,
  onBack,
}: {
  reward: MiniGameRewardPayload;
  summary: string;
  onPlayAgain: () => void;
  onBack: () => void;
}) {
  return (
    <div className="p-5 rounded-2xl bg-[#FDF4DF] border border-[#C9851E]/35 space-y-4 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#F5D68E]/60 text-[#8A540E] mx-auto">
        <Trophy className="w-6 h-6" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display font-bold text-lg text-[#233026]">{summary}</h3>
        <p className="text-xs sm:text-sm text-[#5A4624]">
          Rewards added directly to your Wildgrove sanctuary pouch!
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-mono-num font-bold text-[#233026]">
        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#263129]/12">
          <Coins className="w-4 h-4 text-[#C9851E]" />+{reward.coins} Coins
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#263129]/12">
          <Star className="w-4 h-4 text-[#2F6E49]" />+{reward.xp} XP
        </span>
        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-[#263129]/12">
          <Sparkles className="w-4 h-4 text-[#C9522B]" />+{reward.lanternPoints} Lantern Pts
        </span>
        {reward.resource && (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#E7F5EC] border border-[#2F6E49]/25 text-[#1F5436]">
            +{reward.resource.qty} {RESOURCE_CATALOG[reward.resource.id].name}
          </span>
        )}
      </div>
      <div className="flex items-center justify-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={onPlayAgain}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#C93B44] hover:bg-[#AA2E36] text-white text-xs sm:text-sm font-semibold cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Play Again
        </button>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E4DAC7] text-[#233026] text-xs sm:text-sm font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Big-Top
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// #1 LILYPAD HOP
// ============================================================================
interface LilyLane {
  id: number;
  x: number; // 0..100 center of pad
  width: number; // % width
  speed: number; // % per sec
  dir: 1 | -1;
  hasDragonfly: boolean;
}

function LilypadHopGame({
  onFinish,
  onBack,
}: {
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'READY' | 'PLAYING' | 'FINISHED'>('READY');
  const [frogRow, setFrogRow] = useState(0); // 0 = bottom bank, 1..3 = lanes, 4 = top bank
  const [frogX, setFrogX] = useState(50);
  const [crossings, setCrossings] = useState(0);
  const [dragonflies, setDragonflies] = useState(0);
  const [lives, setLives] = useState(3);
  const [splashMsg, setSplashMsg] = useState<string | null>(null);
  const [lanes, setLanes] = useState<LilyLane[]>([
    { id: 1, x: 25, width: 28, speed: 34, dir: 1, hasDragonfly: false },
    { id: 2, x: 70, width: 26, speed: 42, dir: -1, hasDragonfly: true },
    { id: 3, x: 40, width: 24, speed: 48, dir: 1, hasDragonfly: false },
  ]);
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);

  const lanesRef = useRef(lanes);
  lanesRef.current = lanes;
  const crossingsRef = useRef(crossings);
  crossingsRef.current = crossings;
  const dragonfliesRef = useRef(dragonflies);
  dragonfliesRef.current = dragonflies;

  const finishGame = useCallback(
    (finalCrossings: number, finalFlies: number) => {
      const coins = 45 + finalCrossings * 32 + finalFlies * 18;
      const xp = 18 + finalCrossings * 8 + finalFlies * 4;
      const lanternPoints = 10 + finalCrossings * 5;
      const payload: MiniGameRewardPayload = {
        gameTitle: 'Lilypad Hop',
        coins,
        xp,
        lanternPoints,
        resource: finalCrossings >= 2 ? { id: 'jade_lily_dew', qty: 1 } : undefined,
      };
      setReward(payload);
      setPhase('FINISHED');
      soundEngine.playCelebration();
      onFinish(payload);
    },
    [onFinish],
  );

  const startGame = () => {
    soundEngine.playClick();
    setFrogRow(0);
    setFrogX(50);
    setCrossings(0);
    setDragonflies(0);
    setLives(3);
    setSplashMsg(null);
    setReward(null);
    setLanes([
      { id: 1, x: 28, width: 28, speed: 34, dir: 1, hasDragonfly: false },
      { id: 2, x: 72, width: 26, speed: 42, dir: -1, hasDragonfly: true },
      { id: 3, x: 35, width: 24, speed: 48, dir: 1, hasDragonfly: false },
    ]);
    setPhase('PLAYING');
  };

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setLanes((prev) =>
        prev.map((lane) => {
          let nextX = lane.x + lane.dir * lane.speed * dt;
          let nextDir = lane.dir;
          const half = lane.width / 2;
          if (nextX > 96 - half) {
            nextX = 96 - half;
            nextDir = -1;
          } else if (nextX < 4 + half) {
            nextX = 4 + half;
            nextDir = 1;
          }
          return { ...lane, x: nextX, dir: nextDir };
        }),
      );
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Keep frog drifting with current lilypad if standing on lanes 1..3
  useEffect(() => {
    if (phase !== 'PLAYING' || frogRow < 1 || frogRow > 3) return;
    const lane = lanes[frogRow - 1];
    if (lane) setFrogX(lane.x);
  }, [lanes, frogRow, phase]);

  const handleHop = useCallback(() => {
    if (phase !== 'PLAYING') return;
    const nextRow = frogRow + 1;
    if (nextRow === 4) {
      soundEngine.playCoin();
      const nextCrossings = crossingsRef.current + 1;
      setCrossings(nextCrossings);
      setSplashMsg(`Crossing ${nextCrossings}/3 complete!`);
      if (nextCrossings >= 3) {
        finishGame(nextCrossings, dragonfliesRef.current);
        return;
      }
      setFrogRow(0);
      setFrogX(50);
      setLanes((prev) =>
        prev.map((l, idx) => ({
          ...l,
          speed: l.speed + 7,
          hasDragonfly: idx === nextCrossings % 3,
        })),
      );
      return;
    }

    const targetLane = lanesRef.current[nextRow - 1];
    const halfTolerance = targetLane.width * 0.56;
    if (Math.abs(frogX - targetLane.x) <= halfTolerance) {
      soundEngine.playClick();
      setFrogRow(nextRow);
      setFrogX(targetLane.x);
      if (targetLane.hasDragonfly) {
        soundEngine.playCoin();
        setDragonflies((d) => d + 1);
        setSplashMsg('Snagged a golden dragonfly! +18 Coins');
        setLanes((prev) =>
          prev.map((l) => (l.id === targetLane.id ? { ...l, hasDragonfly: false } : l)),
        );
      } else {
        setSplashMsg(null);
      }
    } else {
      soundEngine.playError();
      setLives((prevLives) => {
        const nextLives = prevLives - 1;
        if (nextLives <= 0) {
          finishGame(crossingsRef.current, dragonfliesRef.current);
        }
        return nextLives;
      });
      setSplashMsg('Splash! Back to the mossy bank.');
      setFrogRow(0);
      setFrogX(50);
    }
  }, [phase, frogRow, frogX, finishGame]);

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        handleHop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, handleHop]);

  if (phase === 'FINISHED' && reward) {
    return (
      <RewardBanner
        reward={reward}
        summary={
          crossings >= 3
            ? `Grand Pond Hopper! 3/3 Crossings & ${dragonflies} Dragonflies`
            : `Pond Splash Finish! ${crossings} Crossings & ${dragonflies} Dragonflies`
        }
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#3C4E40]">
        <span>Crossings: {crossings}/3</span>
        <span>Dragonflies: {dragonflies}</span>
        <span>Lives: {'●'.repeat(lives)}{'○'.repeat(Math.max(0, 3 - lives))}</span>
      </div>

      {phase === 'READY' ? (
        <div className="p-6 rounded-2xl bg-[#E7F5EC] border border-[#2F6E49]/25 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <SpeciesIcon species="tree_frog" className="w-10 h-10" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#1F5436]">Lilypad Hop</h3>
          <p className="text-xs sm:text-sm text-[#355A44] max-w-md mx-auto">
            Time your hops across 3 drifting lily pad lanes to reach the far lotus bank 3 times. Land on pads carrying golden dragonflies for bonus Coins!
          </p>
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#24573A] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Start Hopping
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            onClick={handleHop}
            className="relative w-full h-64 rounded-2xl overflow-hidden border-2 border-[#2A6F97]/35 bg-gradient-to-b from-[#3A9CC4] via-[#2B82A8] to-[#236A8C] select-none cursor-pointer"
          >
            {/* Top lotus bank */}
            <div className="absolute top-0 inset-x-0 h-10 bg-[#5FA854] border-b-2 border-[#3C7A35] flex items-center justify-center text-[11px] font-bold text-[#FAF6EE] tracking-wide">
              LOTUS FINISH BANK
            </div>

            {/* 3 Drifting Lilypad Lanes */}
            {[3, 2, 1].map((rowNum) => {
              const lane = lanes[rowNum - 1];
              const topPct = rowNum === 3 ? 22 : rowNum === 2 ? 44 : 66;
              return (
                <div
                  key={rowNum}
                  className="absolute inset-x-0 h-12"
                  style={{ top: `${topPct}%` }}
                >
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-10 rounded-full bg-[#52B85E] border-2 border-[#2C7A38] shadow-md flex items-center justify-center"
                    style={{ left: `${lane.x}%`, width: `${lane.width}%` }}
                  >
                    <Leaf className="w-4 h-4 text-[#C7F5B5]" />
                    {lane.hasDragonfly && (
                      <Sparkles className="w-4 h-4 text-[#FFE066] ml-1 animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Bottom mossy starting bank */}
            <div className="absolute bottom-0 inset-x-0 h-10 bg-[#64B058] border-t-2 border-[#3C7A35] flex items-center justify-center text-[11px] font-bold text-[#FAF6EE] tracking-wide">
              MOSSY START BANK
            </div>

            {/* Emerald Tree Frog */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-[#FAF6EE] border-2 border-[#2F6E49] shadow-lg flex items-center justify-center transition-[top] duration-150 pointer-events-none"
              style={{
                left: `${frogX}%`,
                top:
                  frogRow === 0
                    ? '91%'
                    : frogRow === 1
                      ? '73%'
                      : frogRow === 2
                        ? '51%'
                        : '29%',
              }}
            >
              <SpeciesIcon species="tree_frog" className="w-8 h-8" />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-[#46594B] min-h-[1rem]">
              {splashMsg || 'Tap the pond or press Space when a lily pad aligns!'}
            </span>
            <button
              type="button"
              onClick={handleHop}
              className="px-5 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#24573A] text-white text-sm font-semibold cursor-pointer shrink-0"
            >
              Hop Forward!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// #2 FIREFLY & BUTTERFLY CATCHER
// ============================================================================
interface DuskCritter {
  id: number;
  kind: 'firefly' | 'butterfly' | 'bramble';
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function FireflyCatcherGame({
  onFinish,
  onBack,
}: {
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'READY' | 'PLAYING' | 'FINISHED'>('READY');
  const [timeLeft, setTimeLeft] = useState(20);
  const [score, setScore] = useState(0);
  const [caughtCount, setCaughtCount] = useState(0);
  const [critters, setCritters] = useState<DuskCritter[]>([]);
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);

  const scoreRef = useRef(0);
  scoreRef.current = score;
  const nextIdRef = useRef(1);

  const spawnCritter = useCallback((): DuskCritter => {
    const r = Math.random();
    const kind: DuskCritter['kind'] = r < 0.22 ? 'bramble' : r < 0.55 ? 'butterfly' : 'firefly';
    return {
      id: nextIdRef.current++,
      kind,
      x: 12 + Math.random() * 76,
      y: 14 + Math.random() * 72,
      vx: (Math.random() - 0.5) * 34,
      vy: (Math.random() - 0.5) * 26,
    };
  }, []);

  const startGame = () => {
    soundEngine.playClick();
    setScore(0);
    setCaughtCount(0);
    setTimeLeft(20);
    setReward(null);
    setCritters(Array.from({ length: 7 }, () => spawnCritter()));
    setPhase('PLAYING');
  };

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const countdown = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          window.clearInterval(countdown);
          const finalScore = Math.max(0, scoreRef.current);
          const payload: MiniGameRewardPayload = {
            gameTitle: 'Firefly & Butterfly Catcher',
            coins: 40 + Math.min(140, Math.round(finalScore * 0.72)),
            xp: 18 + Math.min(35, Math.round(finalScore * 0.16)),
            lanternPoints: 12 + Math.min(26, Math.round(finalScore * 0.12)),
            resource: finalScore >= 110 ? { id: 'wing_dust', qty: 1 } : undefined,
          };
          setReward(payload);
          setPhase('FINISHED');
          soundEngine.playCelebration();
          onFinish(payload);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    let raf = 0;
    let last = performance.now();
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      setCritters((prev) =>
        prev.map((c) => {
          let nx = c.x + c.vx * dt;
          let ny = c.y + c.vy * dt;
          let vx = c.vx;
          let vy = c.vy;
          if (nx < 8 || nx > 92) {
            vx = -vx;
            nx = Math.max(8, Math.min(92, nx));
          }
          if (ny < 12 || ny > 88) {
            vy = -vy;
            ny = Math.max(12, Math.min(88, ny));
          }
          return { ...c, x: nx, y: ny, vx, vy };
        }),
      );
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      window.clearInterval(countdown);
      cancelAnimationFrame(raf);
    };
  }, [phase, onFinish]);

  const handleTapCritter = (item: DuskCritter) => {
    if (phase !== 'PLAYING') return;
    if (item.kind === 'bramble') {
      soundEngine.playError();
      setScore((s) => Math.max(0, s - 15));
    } else if (item.kind === 'butterfly') {
      soundEngine.playCoin();
      setScore((s) => s + 25);
      setCaughtCount((c) => c + 1);
    } else {
      soundEngine.playClick();
      setScore((s) => s + 15);
      setCaughtCount((c) => c + 1);
    }
    setCritters((prev) => [...prev.filter((c) => c.id !== item.id), spawnCritter()]);
  };

  if (phase === 'FINISHED' && reward) {
    return (
      <RewardBanner
        reward={reward}
        summary={`Lantern Net Full! Score ${score} (${caughtCount} caught)`}
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#3C4E40]">
        <span>Score: {score}</span>
        <span>Caught: {caughtCount}</span>
        <span className="font-mono-num">Time: {timeLeft}s</span>
      </div>

      {phase === 'READY' ? (
        <div className="p-6 rounded-2xl bg-[#FEF3DD] border border-[#C9851E]/30 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <SpeciesIcon species="butterfly" exotic className="w-10 h-10" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#73450C]">
            Firefly &amp; Butterfly Catcher
          </h3>
          <p className="text-xs sm:text-sm text-[#6E4D1F] max-w-md mx-auto">
            Catch glowing golden fireflies (+15) and prism butterflies (+25) in 20 seconds. Avoid dark thorny brambles (-15)! Score 110+ for bonus Prismatic Wing Dust.
          </p>
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9851E] hover:bg-[#AA6D14] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Begin Dusk Hunt
          </button>
        </div>
      ) : (
        <div className="relative w-full h-64 rounded-2xl overflow-hidden border-2 border-[#3C507A] bg-gradient-to-b from-[#172440] via-[#213659] to-[#22453A] select-none">
          {critters.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => handleTapCritter(c)}
              style={{ left: `${c.x}%`, top: `${c.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-transform active:scale-90 ${
                c.kind === 'firefly'
                  ? 'bg-[#FFE169]/90 border-2 border-[#FFF8C9] shadow-[0_0_16px_rgba(255,225,105,0.85)]'
                  : c.kind === 'butterfly'
                    ? 'bg-[#8BD6FF]/90 border-2 border-[#E3F6FF] shadow-[0_0_16px_rgba(110,206,255,0.85)]'
                    : 'bg-[#4D2430]/95 border-2 border-[#C94B5B] text-[#FFB8C2]'
              }`}
              title={
                c.kind === 'firefly'
                  ? 'Golden Firefly (+15)'
                  : c.kind === 'butterfly'
                    ? 'Prism Butterfly (+25)'
                    : 'Thorny Bramble (-15)'
              }
            >
              {c.kind === 'firefly' ? (
                <Sparkles className="w-5 h-5 text-[#7A4B00]" />
              ) : c.kind === 'butterfly' ? (
                <SpeciesIcon species="butterfly" exotic className="w-7 h-7" />
              ) : (
                <Flame className="w-5 h-5" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// #3 CHAMELEON COLOR MATCH
// ============================================================================
const PETALS = [
  { id: 0, label: 'Ruby Rose', bg: 'bg-[#DF4757]', activeBg: 'bg-[#FF7A88]', ring: 'ring-[#FF9EA8]', icon: Flower2 },
  { id: 1, label: 'Sunburst Gold', bg: 'bg-[#E5A324]', activeBg: 'bg-[#FFD166]', ring: 'ring-[#FFE49C]', icon: Sun },
  { id: 2, label: 'Emerald Leaf', bg: 'bg-[#2F8F54]', activeBg: 'bg-[#5ED98B]', ring: 'ring-[#9FF2BD]', icon: Leaf },
  { id: 3, label: 'Sky Lotus', bg: 'bg-[#2E7AB8]', activeBg: 'bg-[#6CC2FF]', ring: 'ring-[#A8DCFF]', icon: Waves },
];

function ChameleonColorMatchGame({
  onFinish,
  onBack,
}: {
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'READY' | 'SHOWING' | 'INPUT' | 'FINISHED'>('READY');
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [litPetal, setLitPetal] = useState<number | null>(null);
  const [roundsCleared, setRoundsCleared] = useState(0);
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const playSequence = useCallback((seq: number[]) => {
    clearTimers();
    setPhase('SHOWING');
    setLitPetal(null);
    setPlayerStep(0);
    seq.forEach((petalIdx, idx) => {
      const t1 = window.setTimeout(() => {
        setLitPetal(petalIdx);
        soundEngine.playClick();
      }, 420 + idx * 620);
      const t2 = window.setTimeout(() => {
        setLitPetal(null);
      }, 420 + idx * 620 + 360);
      timersRef.current.push(t1, t2);
    });
    const endT = window.setTimeout(() => {
      setPhase('INPUT');
    }, 420 + seq.length * 620 + 120);
    timersRef.current.push(endT);
  }, []);

  const startGame = () => {
    soundEngine.playClick();
    setRoundsCleared(0);
    setReward(null);
    const initial = [
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4),
      Math.floor(Math.random() * 4),
    ];
    setSequence(initial);
    playSequence(initial);
  };

  const finishMatch = useCallback(
    (cleared: number) => {
      clearTimers();
      const payload: MiniGameRewardPayload = {
        gameTitle: 'Chameleon Color Match',
        coins: 35 + cleared * 28,
        xp: 16 + cleared * 7,
        lanternPoints: 8 + cleared * 4,
        resource: cleared >= 3 ? { id: 'prism_scale', qty: 1 } : undefined,
      };
      setReward(payload);
      setPhase('FINISHED');
      soundEngine.playCelebration();
      onFinish(payload);
    },
    [onFinish],
  );

  const handleTapPetal = (petalId: number) => {
    if (phase !== 'INPUT') return;
    setLitPetal(petalId);
    const t = window.setTimeout(() => setLitPetal(null), 180);
    timersRef.current.push(t);

    if (sequence[playerStep] !== petalId) {
      soundEngine.playError();
      finishMatch(roundsCleared);
      return;
    }

    soundEngine.playCoin();
    const nextStep = playerStep + 1;
    if (nextStep >= sequence.length) {
      const nextCleared = roundsCleared + 1;
      setRoundsCleared(nextCleared);
      if (nextCleared >= 5) {
        finishMatch(nextCleared);
        return;
      }
      const nextSeq = [...sequence, Math.floor(Math.random() * 4)];
      setSequence(nextSeq);
      const pauseT = window.setTimeout(() => playSequence(nextSeq), 480);
      timersRef.current.push(pauseT);
    } else {
      setPlayerStep(nextStep);
    }
  };

  if (phase === 'FINISHED' && reward) {
    return (
      <RewardBanner
        reward={reward}
        summary={
          roundsCleared >= 5
            ? 'Prism Master! Cleared all 5 Chameleon sequences!'
            : `Color Harmony Complete! ${roundsCleared} rounds cleared`
        }
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#3C4E40]">
        <span>Rounds Cleared: {roundsCleared}/5</span>
        <span>
          {phase === 'SHOWING'
            ? 'Watch the Chameleon...'
            : phase === 'INPUT'
              ? `Your turn (${playerStep}/${sequence.length})`
              : 'Memory Sequence'}
        </span>
      </div>

      {phase === 'READY' ? (
        <div className="p-6 rounded-2xl bg-[#F3EAFA] border border-[#7E49A8]/25 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <SpeciesIcon species="chameleon" exotic className="w-10 h-10" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#4F2570]">Chameleon Color Match</h3>
          <p className="text-xs sm:text-sm text-[#5E3A7A] max-w-md mx-auto">
            Watch the hibiscus petals light up, then tap them back in order. Clear 3+ rounds to earn a rare Shimmering Prism Scale!
          </p>
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7E49A8] hover:bg-[#66398A] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Start Sequence
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 p-3 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                litPetal !== null ? PETALS[litPetal].activeBg : 'bg-white'
              }`}
            >
              <SpeciesIcon species="chameleon" className="w-9 h-9" />
            </div>
            <div className="text-xs sm:text-sm font-semibold text-[#233026]">
              {phase === 'SHOWING'
                ? 'Memorize the glowing hibiscus petals...'
                : 'Tap the petals in the exact same order!'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PETALS.map((p) => {
              const Icon = p.icon;
              const isLit = litPetal === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={phase !== 'INPUT'}
                  onClick={() => handleTapPetal(p.id)}
                  className={`h-24 rounded-2xl text-white font-display font-bold text-sm sm:text-base flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer disabled:cursor-default ${
                    isLit ? `${p.activeBg} ring-4 ${p.ring} scale-[1.03]` : `${p.bg} opacity-90 hover:opacity-100`
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// #4 CREEKSIDE FISHING
// ============================================================================
function CreeksideFishingGame({
  onFinish,
  onBack,
}: {
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'READY' | 'WAITING' | 'BITING' | 'RESULT' | 'FINISHED'>('READY');
  const [castNum, setCastNum] = useState(1);
  const [catches, setCatches] = useState<Array<{ label: string; coins: number; rare?: ResourceId }>>([]);
  const [lastMsg, setLastMsg] = useState('');
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);
  const biteStartRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => () => clearTimer(), []);

  const beginCast = useCallback((nextCast: number) => {
    clearTimer();
    setCastNum(nextCast);
    setLastMsg('Bobber floating gently on the brook...');
    setPhase('WAITING');
    const waitMs = 1100 + Math.random() * 1700;
    timerRef.current = window.setTimeout(() => {
      biteStartRef.current = performance.now();
      soundEngine.playClick();
      setLastMsg('SPLASH! Tap Reel In NOW!');
      setPhase('BITING');
      timerRef.current = window.setTimeout(() => {
        // Missed bite window
        soundEngine.playError();
        setLastMsg('The fish slipped away! Too slow.');
        setCatches((prev) => [...prev, { label: 'Driftwood Twig', coins: 12 }]);
        setPhase('RESULT');
      }, 1150);
    }, waitMs);
  }, []);

  const startGame = () => {
    soundEngine.playClick();
    setCatches([]);
    setReward(null);
    beginCast(1);
  };

  const handleReel = () => {
    if (phase === 'WAITING') {
      clearTimer();
      soundEngine.playError();
      setLastMsg('Reeled too early — startled the brook fish!');
      setCatches((prev) => [...prev, { label: 'Mossy Pebble', coins: 10 }]);
      setPhase('RESULT');
      return;
    }
    if (phase === 'BITING') {
      clearTimer();
      const reaction = performance.now() - biteStartRef.current;
      soundEngine.playCoin();
      if (reaction < 420) {
        setLastMsg('PERFECT CATCH! Shimmering River Pearl & Silver Trout!');
        setCatches((prev) => [...prev, { label: 'River Pearl Catch', coins: 62, rare: 'river_pearl' }]);
      } else if (reaction < 780) {
        setLastMsg('Great reel! Caught a fresh Glacial Pond Fish!');
        setCatches((prev) => [...prev, { label: 'Glacial Pond Fish', coins: 46, rare: 'ice_fish_treat' }]);
      } else {
        setLastMsg('Nice catch! Reeled in a Creekside Sunfish!');
        setCatches((prev) => [...prev, { label: 'Creekside Sunfish', coins: 34 }]);
      }
      setPhase('RESULT');
    }
  };

  const handleNextCast = () => {
    if (castNum >= 3) {
      const totalCoins = Math.max(45, catches.reduce((s, c) => s + c.coins, 0));
      const bestRare =
        catches.find((c) => c.rare === 'river_pearl')?.rare ||
        catches.find((c) => c.rare === 'ice_fish_treat')?.rare;
      const payload: MiniGameRewardPayload = {
        gameTitle: 'Creekside Fishing',
        coins: totalCoins,
        xp: 22 + catches.length * 6,
        lanternPoints: 12 + (bestRare ? 10 : 4),
        resource: bestRare ? { id: bestRare, qty: 1 } : undefined,
      };
      setReward(payload);
      setPhase('FINISHED');
      soundEngine.playCelebration();
      onFinish(payload);
      return;
    }
    beginCast(castNum + 1);
  };

  if (phase === 'FINISHED' && reward) {
    return (
      <RewardBanner
        reward={reward}
        summary={`Fishing Basket Full! (${catches.map((c) => c.label).join(', ')})`}
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#3C4E40]">
        <span>Cast: {castNum}/3</span>
        <span>Haul so far: {catches.reduce((s, c) => s + c.coins, 0)} Coins</span>
      </div>

      {phase === 'READY' ? (
        <div className="p-6 rounded-2xl bg-[#E5F2FA] border border-[#2A6F97]/25 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <Fish className="w-8 h-8 text-[#2A6F97]" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#1D4E6B]">Creekside Fishing</h3>
          <p className="text-xs sm:text-sm text-[#355A70] max-w-md mx-auto">
            Make 3 casts along the sunlit brook. Wait for the bobber to splash golden ripples, then tap Reel In fast to land Pond Fish or a River Pearl!
          </p>
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#2A6F97] hover:bg-[#21597A] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Cast Line
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            type="button"
            onClick={phase === 'RESULT' ? handleNextCast : handleReel}
            className={`relative w-full h-56 rounded-2xl border-2 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              phase === 'BITING'
                ? 'bg-gradient-to-b from-[#2B9FD6] to-[#1D6D9E] border-[#FFD559] ring-4 ring-[#FFD559]/50'
                : 'bg-gradient-to-b from-[#3E9AC7] to-[#287096] border-[#2A6F97]/40'
            }`}
          >
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-md transition-transform ${
                phase === 'BITING'
                  ? 'bg-[#FF5252] border-[#FFE066] scale-125 animate-bounce'
                  : 'bg-[#E54B4B] border-white'
              }`}
            >
              <Fish className="w-7 h-7 text-white" />
            </div>
            <div className="px-4 py-1.5 rounded-xl bg-[#102A3A]/70 text-white text-xs sm:text-sm font-semibold">
              {lastMsg}
            </div>
            <div className="text-xs font-bold text-[#FFEAA8]">
              {phase === 'RESULT'
                ? castNum >= 3
                  ? 'Tap to Collect Basket Rewards'
                  : 'Tap for Next Cast'
                : phase === 'BITING'
                  ? 'TAP NOW TO REEL IN!'
                  : 'Hold steady... wait for the splash!'}
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// #5 MEADOW KITCHEN BAKE-OFF
// ============================================================================
function KitchenBakeOffGame({
  onFinish,
  onBack,
}: {
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const [phase, setPhase] = useState<'READY' | 'PLAYING' | 'FINISHED'>('READY');
  const [round, setRound] = useState(1);
  const [needle, setNeedle] = useState(10); // 0..100
  const [totalScore, setTotalScore] = useState(0);
  const [feedback, setFeedback] = useState('Stop the brass needle inside the Golden Crust zone!');
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);

  const needleRef = useRef(10);
  const dirRef = useRef<1 | -1>(1);
  const scoreRef = useRef(0);
  scoreRef.current = totalScore;

  // Golden target zone centered at 50, narrows slightly each round
  const halfZone = round === 1 ? 14 : round === 2 ? 11 : 8.5;

  useEffect(() => {
    if (phase !== 'PLAYING') return;
    let raf = 0;
    let last = performance.now();
    const speed = round === 1 ? 88 : round === 2 ? 118 : 146;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let next = needleRef.current + dirRef.current * speed * dt;
      if (next >= 96) {
        next = 96;
        dirRef.current = -1;
      } else if (next <= 4) {
        next = 4;
        dirRef.current = 1;
      }
      needleRef.current = next;
      setNeedle(next);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, round]);

  const startGame = () => {
    soundEngine.playClick();
    needleRef.current = 10;
    dirRef.current = 1;
    setNeedle(10);
    setRound(1);
    setTotalScore(0);
    setReward(null);
    setFeedback('Round 1 of 3 — Tap Bake inside the golden crust zone!');
    setPhase('PLAYING');
  };

  const handleBakeStop = () => {
    if (phase !== 'PLAYING') return;
    const dist = Math.abs(needleRef.current - 50);
    let pts = 25;
    let msg = 'Toasty edges (+25)';
    if (dist <= halfZone) {
      pts = 100;
      msg = 'PERFECT GOLDEN CRUST! (+100)';
      soundEngine.playCoin();
    } else if (dist <= halfZone + 12) {
      pts = 60;
      msg = 'Warm & flaky! (+60)';
      soundEngine.playClick();
    } else {
      soundEngine.playError();
    }

    const nextScore = scoreRef.current + pts;
    setTotalScore(nextScore);
    setFeedback(msg);

    if (round >= 3) {
      const payload: MiniGameRewardPayload = {
        gameTitle: 'Meadow Kitchen Bake-Off',
        coins: 45 + Math.round(nextScore * 0.42),
        xp: 20 + Math.round(nextScore * 0.09),
        lanternPoints: 10 + Math.round(nextScore * 0.05),
        resource: nextScore >= 200 ? { id: 'gourmet_treat', qty: 1 } : undefined,
      };
      setReward(payload);
      setPhase('FINISHED');
      soundEngine.playCelebration();
      onFinish(payload);
    } else {
      setRound((r) => r + 1);
    }
  };

  if (phase === 'FINISHED' && reward) {
    return (
      <RewardBanner
        reward={reward}
        summary={
          totalScore >= 200
            ? `Master Meadow Baker! Score ${totalScore}/300`
            : `Fresh from the Hearth! Score ${totalScore}/300`
        }
        onPlayAgain={startGame}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-[#3C4E40]">
        <span>Bake Round: {round}/3</span>
        <span>Score: {totalScore}/300</span>
      </div>

      {phase === 'READY' ? (
        <div className="p-6 rounded-2xl bg-[#FCECE7] border border-[#C45B3B]/25 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm">
            <Flame className="w-8 h-8 text-[#C45B3B]" />
          </div>
          <h3 className="font-display font-bold text-lg text-[#7D2F18]">
            Meadow Kitchen Bake-Off
          </h3>
          <p className="text-xs sm:text-sm text-[#734232] max-w-md mx-auto">
            Hit the golden crust zone across 3 hearth rounds. Score 200+ to pull a fresh Gourmet Meadow Tart straight from the oven!
          </p>
          <button
            type="button"
            onClick={startGame}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C45B3B] hover:bg-[#A64A2E] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Fire Up Hearth
          </button>
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/12 space-y-5">
          <div className="text-center text-xs sm:text-sm font-semibold text-[#233026]">{feedback}</div>

          {/* Oven Timing Track */}
          <div className="relative h-14 rounded-2xl bg-[#E3D6C0] border-2 border-[#8C6D46]/40 overflow-hidden">
            {/* Good zone */}
            <div
              className="absolute inset-y-0 bg-[#F2C97D]/70"
              style={{
                left: `${50 - (halfZone + 12)}%`,
                width: `${(halfZone + 12) * 2}%`,
              }}
            />
            {/* Perfect golden crust zone */}
            <div
              className="absolute inset-y-0 bg-[#2F8F54]/85 border-x-2 border-[#FAF6EE]"
              style={{
                left: `${50 - halfZone}%`,
                width: `${halfZone * 2}%`,
              }}
            />
            {/* Moving Needle */}
            <div
              className="absolute top-1 bottom-1 w-2.5 -translate-x-1/2 rounded-full bg-[#C93B44] border border-white shadow-md"
              style={{ left: `${needle}%` }}
            />
          </div>

          <button
            type="button"
            onClick={handleBakeStop}
            className="w-full py-3 rounded-xl bg-[#C45B3B] hover:bg-[#A64A2E] text-white font-display font-bold text-base cursor-pointer"
          >
            Bake Now! (Round {round}/3)
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// #7 TORTOISE & CRITTER MEADOW DERBY
// ============================================================================
interface DerbyRacer {
  id: string;
  name: string;
  species: SpeciesId;
  exotic: boolean;
  progress: number; // 0..100
}

function MeadowDerbyGame({
  sanctuary,
  onFinish,
  onBack,
}: {
  sanctuary: SanctuaryState;
  onFinish: (reward: MiniGameRewardPayload) => void;
  onBack: () => void;
}) {
  const initialRacers = useMemo<DerbyRacer[]>(() => {
    const picked: DerbyRacer[] = sanctuary.enclosures.slice(0, 4).map((enc) => ({
      id: enc.id,
      name: enc.name,
      species: enc.species,
      exotic: enc.variant === 'exotic',
      progress: 0,
    }));
    const guests: Array<{ name: string; species: SpeciesId }> = [
      { name: 'Shelby', species: 'giant_tortoise' },
      { name: 'Sprout', species: 'tree_frog' },
      { name: 'Saffron', species: 'bearded_dragon' },
      { name: 'Pippin', species: 'raccoon' },
    ];
    let g = 0;
    while (picked.length < 4) {
      const guest = guests[g % guests.length];
      picked.push({
        id: `guest-${g}`,
        name: guest.name,
        species: guest.species,
        exotic: false,
        progress: 0,
      });
      g++;
    }
    return picked;
  }, [sanctuary.enclosures]);

  const [phase, setPhase] = useState<'READY' | 'RACING' | 'FINISHED'>('READY');
  const [selectedId, setSelectedId] = useState<string>(initialRacers[0].id);
  const [racers, setRacers] = useState<DerbyRacer[]>(initialRacers);
  const [beatMeter, setBeatMeter] = useState(50);
  const [placement, setPlacement] = useState(1);
  const [boostMsg, setBoostMsg] = useState('Tap Cheer Boost when the pulse is in the green beat zone!');
  const [reward, setReward] = useState<MiniGameRewardPayload | null>(null);

  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const beatRef = useRef(50);

  const startRace = () => {
    soundEngine.playClick();
    setRacers(initialRacers.map((r) => ({ ...r, progress: 0 })));
    setReward(null);
    setBoostMsg('Tap Cheer Boost on the green beat to surge ahead!');
    setPhase('RACING');
  };

  useEffect(() => {
    if (phase !== 'RACING') return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let finished = false;

    const step = (now: number) => {
      if (finished) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      const pulse = 50 + Math.sin(elapsed * 4.4) * 46;
      beatRef.current = pulse;
      setBeatMeter(pulse);

      setRacers((prev) => {
        const next = prev.map((r, idx) => {
          const isPlayer = r.id === selectedRef.current;
          const baseSpeed = isPlayer ? 8.8 : 10.6 + ((idx * 1.3 + Math.sin(elapsed * 2 + idx) * 2.2) % 3.4);
          return { ...r, progress: Math.min(100, r.progress + baseSpeed * dt) };
        });

        const winner = next.find((r) => r.progress >= 100);
        if (winner && !finished) {
          finished = true;
          const sorted = [...next].sort((a, b) => b.progress - a.progress);
          const rank = sorted.findIndex((r) => r.id === selectedRef.current) + 1;
          setPlacement(rank);
          const coins = rank === 1 ? 185 : rank === 2 ? 120 : rank === 3 ? 85 : 60;
          const lanterns = rank === 1 ? 35 : rank === 2 ? 22 : 14;
          const payload: MiniGameRewardPayload = {
            gameTitle: 'Tortoise & Critter Derby',
            coins,
            xp: rank === 1 ? 45 : 26,
            lanternPoints: lanterns,
            resource: rank === 1 ? { id: 'lucky_acorn', qty: 1 } : undefined,
          };
          setReward(payload);
          setPhase('FINISHED');
          soundEngine.playCelebration();
          onFinish(payload);
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      finished = true;
      cancelAnimationFrame(raf);
    };
  }, [phase, onFinish]);

  const handleCheerBoost = () => {
    if (phase !== 'RACING') return;
    const dist = Math.abs(beatRef.current - 50);
    if (dist <= 22) {
      soundEngine.playCoin();
      setBoostMsg('RHYTHM SURGE! Your critter zooms forward!');
      setRacers((prev) =>
        prev.map((r) =>
          r.id === selectedRef.current ? { ...r, progress: Math.min(99.5, r.progress + 7.5) } : r,
        ),
      );
    } else {
      soundEngine.playClick();
      setBoostMsg('Gentle cheer (+2m) — aim for the green center!');
      setRacers((prev) =>
        prev.map((r) =>
          r.id === selectedRef.current ? { ...r, progress: Math.min(99.5, r.progress + 2.2) } : r,
        ),
      );
    }
  };

  if (phase === 'FINISHED' && reward) {
    const pickedName = racers.find((r) => r.id === selectedId)?.name || 'Your racer';
    const ordinal = placement === 1 ? '1st' : placement === 2 ? '2nd' : placement === 3 ? '3rd' : '4th';
    return (
      <RewardBanner
        reward={reward}
        summary={`${pickedName} finished ${ordinal} in the Meadow Derby!`}
        onPlayAgain={startRace}
        onBack={onBack}
      />
    );
  }

  return (
    <div className="space-y-4">
      {phase === 'READY' ? (
        <div className="p-5 rounded-2xl bg-[#F7F1DC] border border-[#9C7624]/25 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-display font-bold text-lg text-[#5C4410]">
              Choose Your Meadow Derby Racer
            </h3>
            <p className="text-xs sm:text-sm text-[#6B5624]">
              Pick a sanctuary critter, then tap Cheer Boost in rhythm to sprint to 1st place!
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {initialRacers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedId(r.id);
                }}
                className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-colors ${
                  selectedId === r.id
                    ? 'bg-white border-[#C93B44] ring-2 ring-[#C93B44]/25'
                    : 'bg-[#FAF6EE] border-[#263129]/12 hover:bg-white'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#EFE7D8] flex items-center justify-center shrink-0">
                  <SpeciesIcon species={r.species} exotic={r.exotic} className="w-7 h-7" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-[#233026] truncate">{r.name}</div>
                  <div className="text-[11px] text-[#5A6B5C] truncate">
                    {SPECIES_CATALOG[r.species].name}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={startRace}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#24573A] text-white text-sm font-semibold cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Sound the Derby Bell!
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-[#E7F5EC] border border-[#2F6E49]/25 space-y-2.5">
            {racers.map((r) => {
              const isMine = r.id === selectedId;
              return (
                <div key={r.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#233026]">
                    <span>
                      {r.name} {isMine ? '(Your Pick)' : ''}
                    </span>
                    <span className="font-mono-num">{Math.round(r.progress)}m</span>
                  </div>
                  <div className="relative h-9 rounded-xl bg-[#CFE8D6] border border-[#2F6E49]/20 overflow-hidden">
                    <div
                      className={`h-full transition-[width] duration-75 ${
                        isMine ? 'bg-[#F5C969]/75' : 'bg-[#8CC99E]/60'
                      }`}
                      style={{ width: `${Math.max(8, r.progress)}%` }}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-[#2F6E49]/40 shadow-sm flex items-center justify-center"
                      style={{ left: `${Math.min(95, Math.max(6, r.progress))}%` }}
                    >
                      <SpeciesIcon species={r.species} exotic={r.exotic} className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="text-center text-xs font-semibold text-[#3C4E40]">{boostMsg}</div>
            <div className="relative h-6 rounded-full bg-[#E3DAC8] overflow-hidden border border-[#263129]/15">
              <div className="absolute inset-y-0 left-[28%] w-[44%] bg-[#47B56E]/65" />
              <div
                className="absolute top-0.5 bottom-0.5 w-4 -translate-x-1/2 rounded-full bg-[#C93B44] border border-white"
                style={{ left: `${beatMeter}%` }}
              />
            </div>
            <button
              type="button"
              onClick={handleCheerBoost}
              className="w-full py-3 rounded-xl bg-[#C93B44] hover:bg-[#AA2E36] text-white font-display font-bold text-base cursor-pointer"
            >
              Cheer Boost!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN WILDGROVE CIRCUS TENT MODAL
// ============================================================================
export function CircusMiniGamesModal({
  sanctuary,
  onClose,
  onClaimReward,
}: CircusMiniGamesModalProps) {
  const [activeGame, setActiveGame] = useState<MiniGameId | null>(null);
  const activeMeta = activeGame ? MINI_GAMES.find((g) => g.id === activeGame) || null : null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-[#19241B]/55"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-[#FAF6EE] border border-[#263129]/15 rounded-3xl shadow-[0_24px_64px_rgba(24,36,26,0.38)] overflow-hidden">
        {/* Carnival Striped Accent Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#C93B44] via-[#D84B4A] to-[#C93B44] text-[#FAF6EE] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {activeGame && (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setActiveGame(null);
                }}
                className="w-9 h-9 rounded-xl bg-white/18 hover:bg-white/28 flex items-center justify-center cursor-pointer shrink-0"
                title="Back to Circus Tent Hub"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg sm:text-xl leading-tight truncate">
                {activeMeta ? activeMeta.title : 'Wildgrove Circus Tent'}
              </h2>
              <p className="text-xs text-[#FFEBD0] truncate">
                {activeMeta
                  ? activeMeta.rewardHint
                  : '6 playable sanctuary mini-games for Coins, XP, rare treats & Lantern Points'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="w-9 h-9 rounded-xl bg-white/18 hover:bg-white/28 flex items-center justify-center cursor-pointer shrink-0"
            aria-label="Close Circus Tent"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">
          {!activeGame ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MINI_GAMES.map((game) => (
                <div
                  key={game.id}
                  className={`p-4 rounded-2xl ${game.accentBg} border ${game.accentBorder} flex flex-col justify-between gap-3`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/90 border border-[#263129]/10 flex items-center justify-center shrink-0">
                      <SpeciesIcon species={game.species} className="w-8 h-8" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className={`font-display font-bold text-sm sm:text-base ${game.accentText}`}>
                        {game.title}
                      </h3>
                      <p className="text-xs text-[#3C4B40] leading-relaxed">{game.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#263129]/10">
                    <span className="text-[11px] font-semibold text-[#516154] truncate">
                      {game.rewardHint}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setActiveGame(game.id);
                      }}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#233026] hover:bg-[#162018] text-[#FAF6EE] text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Play
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : activeGame === 'lilypad_hop' ? (
            <LilypadHopGame onFinish={onClaimReward} onBack={() => setActiveGame(null)} />
          ) : activeGame === 'firefly_catcher' ? (
            <FireflyCatcherGame onFinish={onClaimReward} onBack={() => setActiveGame(null)} />
          ) : activeGame === 'chameleon_match' ? (
            <ChameleonColorMatchGame onFinish={onClaimReward} onBack={() => setActiveGame(null)} />
          ) : activeGame === 'creekside_fishing' ? (
            <CreeksideFishingGame onFinish={onClaimReward} onBack={() => setActiveGame(null)} />
          ) : activeGame === 'kitchen_bakeoff' ? (
            <KitchenBakeOffGame onFinish={onClaimReward} onBack={() => setActiveGame(null)} />
          ) : (
            <MeadowDerbyGame
              sanctuary={sanctuary}
              onFinish={onClaimReward}
              onBack={() => setActiveGame(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
