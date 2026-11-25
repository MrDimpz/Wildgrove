/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveDrawer,
  ChatMessage,
  CommunitySanctuarySummary,
  FloatingFeedback,
  LeaderboardEntry,
  MarketplaceListing,
  PlacementChoice,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from './types/game';
import {
  ACHIEVEMENTS,
  CROP_CATALOG,
  DAILY_REWARDS,
  DECOR_CATALOG,
  RESOURCE_CATALOG,
  SEASONAL_EVENT_INFO,
  SPECIES_CATALOG,
  computePrestige,
  createStarterSanctuary,
  isCellOccupied,
  xpRequiredForLevel,
} from './data/catalog';
import { SanctuaryEngine } from './three/SanctuaryEngine';
import { soundEngine } from './audio/soundEngine';
import {
  SanctuarySocketClient,
  buyMarketplaceListing,
  createMarketplaceListing,
  fetchCommunitySanctuaries,
  fetchLeaderboard,
  fetchMarketplaceListings,
  loadLocalSanctuary,
  pullCloudSave,
  pushCloudSave,
  saveLocalSanctuary,
  sendVisitGift,
} from './services/cloudSync';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { BottomDock } from './components/BottomDock';
import { EnclosureModal } from './components/EnclosureModal';
import { DrawerModals, type TerrainThemeId } from './components/DrawerModals';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function applyProgressionAndAchievements(state: SanctuaryState, gainedXp: number): {
  next: SanctuaryState;
  leveledUp: boolean;
  newAchievements: string[];
} {
  let xp = state.xp + gainedXp;
  let level = state.level;
  let coins = state.coins;
  let gems = state.gems;
  let leveledUp = false;

  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level += 1;
    coins += 120 + level * 25;
    gems += 3;
    leveledUp = true;
  }

  const next: SanctuaryState = {
    ...state,
    level,
    xp,
    coins,
    gems,
    updatedAt: Date.now(),
  };

  const unlocked = new Set(next.unlockedAchievements);
  const newAchievements: string[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (!unlocked.has(ach.id) && ach.check(next)) {
      unlocked.add(ach.id);
      next.gems += ach.rewardGems;
      newAchievements.push(ach.title);
    }
  }
  next.unlockedAchievements = Array.from(unlocked);
  next.prestige = computePrestige(next);
  return { next, leveledUp, newAchievements };
}

export default function App() {
  const [screen, setScreen] = useState<'title' | 'playing'>('title');
  const [sanctuary, setSanctuary] = useState<SanctuaryState>(
    () => loadLocalSanctuary() || createStarterSanctuary(),
  );
  const [visitingSanctuary, setVisitingSanctuary] = useState<SanctuaryState | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedEnclosureId, setSelectedEnclosureId] = useState<string | null>(null);
  const [placementChoice, setPlacementChoice] = useState<PlacementChoice | null>(null);
  const [decorRotation, setDecorRotation] = useState(0);
  const [terrainTheme, setTerrainTheme] = useState<TerrainThemeId>('meadow');
  const [weatherEnabled, setWeatherEnabled] = useState(true);

  const [cloudStatus, setCloudStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [muted, setMuted] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Real-time social states
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [communitySanctuaries, setCommunitySanctuaries] = useState<CommunitySanctuarySummary[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Transient floating toast notifications
  const [toasts, setToasts] = useState<FloatingFeedback[]>([]);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<SanctuaryEngine | null>(null);
  const socketRef = useRef<SanctuarySocketClient | null>(null);

  // Refs for stable callbacks inside the WebGL engine without re-mounting
  const sanctuaryRef = useRef(sanctuary);
  sanctuaryRef.current = sanctuary;
  const visitingRef = useRef(visitingSanctuary);
  visitingRef.current = visitingSanctuary;
  const placementRef = useRef(placementChoice);
  placementRef.current = placementChoice;
  const decorRotationRef = useRef(decorRotation);
  decorRotationRef.current = decorRotation;
  const activeDrawerRef = useRef(activeDrawer);
  activeDrawerRef.current = activeDrawer;

  const pushToast = useCallback((text: string, tone: FloatingFeedback['tone'] = 'emerald') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // --- Persist locally + debounced cloud sync ---
  const syncTimerRef = useRef<number | null>(null);
  const updateSanctuary = useCallback(
    (updater: (prev: SanctuaryState) => SanctuaryState) => {
      setSanctuary((prev) => {
        const next = updater(prev);
        next.prestige = computePrestige(next);
        saveLocalSanctuary(next);

        if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
        setCloudStatus('saving');
        syncTimerRef.current = window.setTimeout(async () => {
          const res = await pushCloudSave(next);
          setCloudStatus(res.ok ? 'synced' : 'offline');
        }, 700);
        return next;
      });
    },
    [],
  );

  // --- Crop Harvest Handler ---
  const handleHarvestCrop = useCallback(
    (cropId: string) => {
      if (visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const crop = cur.crops.find((c) => c.id === cropId);
      if (!crop) return;
      const ready = Date.now() - crop.plantedAt >= crop.growDurationMs;
      if (!ready) {
        const secsLeft = Math.ceil((crop.growDurationMs - (Date.now() - crop.plantedAt)) / 1000);
        pushToast(`Still growing — ready in ${secsLeft}s`, 'sky');
        soundEngine.playClick();
        return;
      }
      const def = CROP_CATALOG[crop.cropType];
      soundEngine.playHarvest();
      engineRef.current?.triggerBurstAtGrid(crop.gridX, crop.gridZ, 1, 0xffd559);

      updateSanctuary((prev) => {
        const updatedCrops = prev.crops.map((c) =>
          c.id === cropId ? { ...c, plantedAt: Date.now() } : c,
        );
        const inv = { ...prev.inventory };
        inv[def.yieldResource] = (inv[def.yieldResource] || 0) + def.yieldAmount;
        const withStats: SanctuaryState = {
          ...prev,
          crops: updatedCrops,
          inventory: inv,
          coins: prev.coins + 20,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + 8,
          },
          stats: { ...prev.stats, totalHarvests: prev.stats.totalHarvests + 1 },
        };
        const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(withStats, def.xpReward);
        if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
        newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
        return next;
      });

      pushToast(
        `Harvested +${def.yieldAmount} ${RESOURCE_CATALOG[def.yieldResource].name} (+20 Coins)`,
        'emerald',
      );
    },
    [pushToast, updateSanctuary],
  );

  // --- Grid Placement Handler ---
  const handlePlaceAtTile = useCallback(
    (gridX: number, gridZ: number) => {
      const choice = placementRef.current;
      if (!choice || visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const fp: 1 | 2 = choice.kind === 'enclosure' ? 2 : 1;

      if (isCellOccupied(cur, gridX, gridZ, fp)) {
        soundEngine.playError();
        pushToast('That meadow spot is already occupied.', 'rose');
        return;
      }

      if (choice.kind === 'enclosure') {
        const sp = SPECIES_CATALOG[choice.species];
        const useGems = choice.variant === 'exotic';
        if (useGems && cur.gems < sp.exoticCostGems) {
          soundEngine.playError();
          pushToast('Not enough Gems for this Exotic habitat.', 'rose');
          return;
        }
        if (!useGems && cur.coins < sp.costCoins) {
          soundEngine.playError();
          pushToast('Not enough Coins for this enclosure.', 'rose');
          return;
        }

        const defaultNames: Record<SpeciesId, string[]> = {
          raccoon: ['Pippin', 'Maple', 'Rusty', 'Acorn'],
          gorilla: ['Bramble', 'Kongo', 'Taro', 'Cedar'],
          butterfly: ['Aurelia', 'Zephyr', 'Marigold', 'Iris'],
          wolf: ['Koda', 'Freya', 'Aspen', 'Timber'],
          red_panda: ['Ginger', 'Cinnamon', 'Copper', 'Pabu'],
          golden_fox: ['Aurelia', 'Vixen', 'Sol', 'Flash'],
          snow_leopard: ['Blizzard', 'Frost', 'Yeti', 'Nova'],
          river_otter: ['Splash', 'Ripple', 'Pebble', 'Dash'],
        };
        const pool = defaultNames[choice.species];
        const name = pool[cur.enclosures.length % pool.length];

        soundEngine.playPlace();
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, 2, 0x52d681);

        updateSanctuary((prev) => {
          const added = {
            id: `enc-${Date.now()}`,
            species: choice.species,
            name,
            variant: choice.variant,
            gridX,
            gridZ,
            happiness: 85,
            hunger: 80,
            grooming: 80,
            bondLevel: 1,
            lastFedAt: Date.now(),
            lastGroomedAt: Date.now(),
            visitorHearts: 0,
          };
          const base: SanctuaryState = {
            ...prev,
            coins: useGems ? prev.coins : prev.coins - sp.costCoins,
            gems: useGems ? prev.gems - sp.exoticCostGems : prev.gems,
            enclosures: [...prev.enclosures, added],
            seasonalEvent: {
              ...prev.seasonalEvent,
              lanternPoints: prev.seasonalEvent.lanternPoints + 25,
            },
          };
          const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 45);
          if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
          newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
          return next;
        });

        pushToast(`Welcomed ${name} to a new ${sp.habitatTitle}!`, 'emerald');
        setPlacementChoice(null);
      } else if (choice.kind === 'crop') {
        const cDef = CROP_CATALOG[choice.cropType];
        if (cur.coins < cDef.costCoins) {
          soundEngine.playError();
          pushToast('Not enough Coins to plant this crop.', 'rose');
          return;
        }
        soundEngine.playPlace();
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, 1, 0x62d980);
        updateSanctuary((prev) => ({
          ...prev,
          coins: prev.coins - cDef.costCoins,
          crops: [
            ...prev.crops,
            {
              id: `crop-${Date.now()}`,
              cropType: choice.cropType,
              gridX,
              gridZ,
              plantedAt: Date.now(),
              growDurationMs: cDef.growDurationMs,
            },
          ],
        }));
        pushToast(`Planted ${cDef.name}!`, 'emerald');
      } else {
        const dDef = DECOR_CATALOG[choice.decorType];
        if (cur.coins < dDef.costCoins || cur.gems < dDef.costGems) {
          soundEngine.playError();
          pushToast('Not enough Coins or Gems for this decor.', 'rose');
          return;
        }
        soundEngine.playPlace();
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, 1, 0xf2b84b);
        updateSanctuary((prev) => {
          const base: SanctuaryState = {
            ...prev,
            coins: prev.coins - dDef.costCoins,
            gems: prev.gems - dDef.costGems,
            decorations: [
              ...prev.decorations,
              {
                id: `dec-${Date.now()}`,
                decorType: choice.decorType,
                gridX,
                gridZ,
                rotation: decorRotationRef.current,
              },
            ],
            seasonalEvent: {
              ...prev.seasonalEvent,
              lanternPoints: prev.seasonalEvent.lanternPoints + 12,
            },
          };
          const { next, newAchievements } = applyProgressionAndAchievements(base, 15);
          newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
          return next;
        });
        pushToast(`Placed ${dDef.name} (+${dDef.prestigeBonus} Prestige)`, 'gold');
      }
    },
    [pushToast, updateSanctuary],
  );

  // --- Mount Isolated Three.js Engine Once ---
  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new SanctuaryEngine(canvasMountRef.current, {
      onSelectEnclosure: (encId) => {
        soundEngine.playClick();
        setSelectedEnclosureId(encId);
        engine.focusEnclosure(encId);
      },
      onHarvestCrop: (cropId) => handleHarvestCrop(cropId),
      onPlaceAtTile: (gx, gz) => handlePlaceAtTile(gx, gz),
    });
    engineRef.current = engine;
    engine.syncSanctuary(sanctuaryRef.current);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [handleHarvestCrop, handlePlaceAtTile]);

  // Keep 3D scene synchronized with active sanctuary (home or visiting friend)
  const displayedSanctuary = visitingSanctuary || sanctuary;
  useEffect(() => {
    engineRef.current?.syncSanctuary(displayedSanctuary);
  }, [displayedSanctuary]);

  useEffect(() => {
    engineRef.current?.setTitleMode(screen === 'title');
  }, [screen]);

  useEffect(() => {
    engineRef.current?.setPlacementChoice(placementChoice);
  }, [placementChoice]);

  // Keyboard shortcuts: H hides/shows dock, Esc closes drawer/placement, R rotates decor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyH' && screen === 'playing') {
        setDockCollapsed((c) => !c);
      } else if (e.code === 'Escape') {
        setPlacementChoice(null);
        setActiveDrawer(null);
        setSelectedEnclosureId(null);
      } else if (e.code === 'KeyR' && placementRef.current?.kind === 'decor') {
        setDecorRotation((r) => (r + 1) % 4);
      } else if (e.key === '?' && screen === 'playing') {
        setActiveDrawer((prev) => (prev === 'manual' ? null : 'manual'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen]);

  // Automatic randomized weather transitions (30s minimum to 5 minutes maximum)
  useEffect(() => {
    if (screen !== 'playing' || !weatherEnabled) return;
    const minMs = 30_000;
    const maxMs = 300_000;
    const delayMs = minMs + Math.floor(Math.random() * (maxMs - minMs));

    const timer = window.setTimeout(() => {
      const themes: TerrainThemeId[] = ['meadow', 'autumn', 'clover', 'alpine'];
      const candidates = themes.filter((t) => t !== terrainTheme);
      const next = candidates[Math.floor(Math.random() * candidates.length)];
      setTerrainTheme(next);
      engineRef.current?.setTerrainTheme(next);
      const labels: Record<TerrainThemeId, string> = {
        meadow: 'Weather Shift: Sunlit Meadow & Pollen',
        autumn: 'Weather Shift: Falling Autumn Leaves',
        clover: 'Weather Shift: Gentle Sunshower Rain',
        alpine: 'Weather Shift: Soft Mountain Snowfall',
      };
      pushToast(labels[next], 'sky');
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [screen, weatherEnabled, terrainTheme, pushToast]);

  // --- Connect Real-Time WebSocket & Initial Cloud Sync ---
  useEffect(() => {
    const client = new SanctuarySocketClient({
      onPresence: (count) => setOnlineCount(Math.max(1, count)),
      onChatInit: (msgs) => setChatMessages(msgs),
      onChatMessage: (msg) => {
        setChatMessages((prev) => (prev.some((c) => c.id === msg.id) ? prev : [...prev.slice(-79), msg]));
        if (activeDrawerRef.current !== 'chat' && msg.senderCode !== sanctuaryRef.current.syncCode) {
          setUnreadChatCount((c) => c + 1);
        }
      },
      onMarketplaceUpdate: (list) => setListings(list),
      onLeaderboardUpdate: (lb) => setLeaderboard(lb),
      onSanctuaryGift: (targetCode, visitorName, enclosureName) => {
        if (targetCode === sanctuaryRef.current.syncCode) {
          pushToast(`${visitorName} left a Care Gift for ${enclosureName}!`, 'gold');
        }
      },
    });
    socketRef.current = client;

    // Initial REST hydration + push starter save to server
    void (async () => {
      await pushCloudSave(sanctuaryRef.current);
      const [mkt, friends, lb] = await Promise.all([
        fetchMarketplaceListings(),
        fetchCommunitySanctuaries(),
        fetchLeaderboard(),
      ]);
      if (mkt.length) setListings(mkt);
      if (friends.length) setCommunitySanctuaries(friends);
      if (lb.length) setLeaderboard(lb);
    })();

    return () => {
      client.dispose();
      socketRef.current = null;
    };
  }, [pushToast]);

  // --- Feeding Mini-Game Completion ---
  const handleCompleteFeeding = (enclosureId: string, score: number, combo: number) => {
    const enc = sanctuary.enclosures.find((e) => e.id === enclosureId);
    if (!enc) return;
    const sp = SPECIES_CATALOG[enc.species];
    const coinsWon = 35 + Math.round(score * 0.65);
    const earnedRare = score >= 90 || Math.random() < 0.45;

    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0xffd559);
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      inv[sp.favoriteTreat] = Math.max(0, (inv[sp.favoriteTreat] || 1) - 1);
      if (earnedRare) {
        inv[sp.rareDrop] = (inv[sp.rareDrop] || 0) + 1;
      }
      const nextEnclosures = prev.enclosures.map((e) =>
        e.id === enclosureId
          ? {
              ...e,
              hunger: Math.min(100, e.hunger + 28),
              happiness: Math.min(100, e.happiness + 18),
              bondLevel: Math.min(10, e.bondLevel + (score >= 110 ? 1 : 0)),
              lastFedAt: Date.now(),
            }
          : e,
      );
      const base: SanctuaryState = {
        ...prev,
        coins: prev.coins + coinsWon,
        enclosures: nextEnclosures,
        inventory: inv,
        seasonalEvent: {
          ...prev.seasonalEvent,
          lanternPoints: prev.seasonalEvent.lanternPoints + 16 + combo * 2,
        },
        stats: { ...prev.stats, totalFeeds: prev.stats.totalFeeds + 1 },
      };
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 36);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });

    pushToast(
      `Fed ${enc.name}! +${coinsWon} Coins${earnedRare ? ` & +1 ${RESOURCE_CATALOG[sp.rareDrop].name}` : ''}`,
      'emerald',
    );
  };

  // --- Grooming Mini-Game Completion ---
  const handleCompleteGrooming = (enclosureId: string, cleanlinessPct: number) => {
    const enc = sanctuary.enclosures.find((e) => e.id === enclosureId);
    if (!enc) return;
    const sp = SPECIES_CATALOG[enc.species];
    const coinsWon = 40 + Math.round(cleanlinessPct * 0.45);
    const gotRare = cleanlinessPct >= 88;

    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0x67d8f7);
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      if (gotRare) {
        inv[sp.rareDrop] = (inv[sp.rareDrop] || 0) + 1;
      }
      const nextEnclosures = prev.enclosures.map((e) =>
        e.id === enclosureId
          ? {
              ...e,
              grooming: Math.min(100, e.grooming + 35),
              happiness: Math.min(100, e.happiness + 20),
              bondLevel: Math.min(10, e.bondLevel + (cleanlinessPct >= 95 ? 1 : 0)),
              lastGroomedAt: Date.now(),
            }
          : e,
      );
      const base: SanctuaryState = {
        ...prev,
        coins: prev.coins + coinsWon,
        enclosures: nextEnclosures,
        inventory: inv,
        seasonalEvent: {
          ...prev.seasonalEvent,
          lanternPoints: prev.seasonalEvent.lanternPoints + 18,
        },
        stats: { ...prev.stats, totalGrooms: prev.stats.totalGrooms + 1 },
      };
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 40);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });

    pushToast(
      `Groomed ${enc.name} (${cleanlinessPct}%)! +${coinsWon} Coins${gotRare ? ` & +1 ${RESOURCE_CATALOG[sp.rareDrop].name}` : ''}`,
      'sky',
    );
  };

  // --- Exotic Variant Upgrade ---
  const handleUpgradeExotic = (enclosureId: string) => {
    const enc = sanctuary.enclosures.find((e) => e.id === enclosureId);
    if (!enc || enc.variant === 'exotic') return;
    const sp = SPECIES_CATALOG[enc.species];
    if (sanctuary.gems < sp.exoticCostGems) return;

    soundEngine.playCelebration();
    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0xffd56b);
    updateSanctuary((prev) => {
      const base: SanctuaryState = {
        ...prev,
        gems: prev.gems - sp.exoticCostGems,
        enclosures: prev.enclosures.map((e) =>
          e.id === enclosureId ? { ...e, variant: 'exotic', happiness: 100 } : e,
        ),
      };
      const { next, newAchievements } = applyProgressionAndAchievements(base, 80);
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });
    pushToast(`${enc.name} awakened as ${sp.exoticName}!`, 'gold');
  };

  // --- Friends Visiting & Care Gift ---
  const handleVisitSanctuary = async (syncCode: string) => {
    soundEngine.playClick();
    const target = await pullCloudSave(syncCode);
    if (!target) {
      pushToast('Could not load that sanctuary right now.', 'rose');
      return;
    }
    setPlacementChoice(null);
    setVisitingSanctuary(target);
    engineRef.current?.resetCamera();
    pushToast(`Arrived at ${target.keeperName}'s ${target.sanctuaryName}!`, 'sky');
  };

  const handleSendVisitGift = async (enclosureId: string) => {
    if (!visitingSanctuary) return;
    const updatedTarget = await sendVisitGift(
      visitingSanctuary.syncCode,
      sanctuary.keeperName,
      enclosureId,
    );
    if (updatedTarget) {
      setVisitingSanctuary(updatedTarget);
    }
    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0xf2849e);
    updateSanctuary((prev) => {
      const base: SanctuaryState = {
        ...prev,
        coins: prev.coins + 40,
        seasonalEvent: {
          ...prev.seasonalEvent,
          lanternPoints: prev.seasonalEvent.lanternPoints + 15,
        },
        stats: { ...prev.stats, friendsVisited: prev.stats.friendsVisited + 1 },
      };
      const { next, newAchievements } = applyProgressionAndAchievements(base, 25);
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });
    pushToast('Care Gift sent! Earned +40 Coins & +15 Lantern Points.', 'emerald');
  };

  // --- Marketplace Buy & List ---
  const handleBuyListing = async (listingId: string) => {
    const item = listings.find((l) => l.id === listingId);
    if (!item) return;
    if (sanctuary.coins < item.priceCoins || sanctuary.gems < item.priceGems) {
      soundEngine.playError();
      pushToast('Not enough Coins or Gems.', 'rose');
      return;
    }
    const res = await buyMarketplaceListing(listingId, sanctuary.syncCode);
    if (!res.ok || !res.purchased) {
      soundEngine.playError();
      pushToast(res.error || 'Item no longer available.', 'rose');
      return;
    }
    soundEngine.playCoin();
    const bought = res.purchased;
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      const rKey = bought.itemId as ResourceId;
      if (rKey in inv) {
        inv[rKey] = (inv[rKey] || 0) + bought.quantity;
      }
      return {
        ...prev,
        coins: prev.coins - bought.priceCoins,
        gems: prev.gems - bought.priceGems,
        inventory: inv,
        stats: { ...prev.stats, totalTrades: prev.stats.totalTrades + 1 },
      };
    });
    pushToast(`Purchased ${bought.itemLabel} ×${bought.quantity}!`, 'emerald');
  };

  const handleCreateListing = async (resourceId: ResourceId, quantity: number, priceCoins: number) => {
    if ((sanctuary.inventory[resourceId] || 0) < quantity) return;
    const def = RESOURCE_CATALOG[resourceId];
    const created = await createMarketplaceListing({
      sellerCode: sanctuary.syncCode,
      sellerName: sanctuary.keeperName,
      itemType: 'resource',
      itemId: resourceId,
      itemLabel: def.name,
      quantity,
      priceCoins,
      priceGems: 0,
      rarity: def.rarity,
    });
    if (!created) {
      soundEngine.playError();
      pushToast('Could not post listing.', 'rose');
      return;
    }
    soundEngine.playCoin();
    updateSanctuary((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [resourceId]: Math.max(0, (prev.inventory[resourceId] || 0) - quantity),
      },
    }));
    pushToast(`Listed ${def.name} ×${quantity} for ${priceCoins} Coins!`, 'gold');
  };

  // --- Daily Rewards & Seasonal Milestones ---
  const canClaimDaily = sanctuary.dailyReward.lastClaimDate !== todayIsoDate();

  const handleClaimDaily = () => {
    if (!canClaimDaily) return;
    const nextDay = (sanctuary.dailyReward.streak % 7) + 1;
    const tier = DAILY_REWARDS[nextDay - 1];
    soundEngine.playCelebration();
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      if (tier.resource) {
        inv[tier.resource.id] = (inv[tier.resource.id] || 0) + tier.resource.qty;
      }
      return {
        ...prev,
        coins: prev.coins + tier.coins,
        gems: prev.gems + tier.gems,
        inventory: inv,
        dailyReward: {
          streak: nextDay,
          lastClaimDate: todayIsoDate(),
        },
      };
    });
    pushToast(`Day ${nextDay} Reward: +${tier.coins} Coins & +${tier.gems} Gems!`, 'gold');
  };

  const handleClaimMilestone = (milestoneId: string) => {
    const m = SEASONAL_EVENT_INFO.milestones.find((x) => x.id === milestoneId);
    if (!m || sanctuary.seasonalEvent.claimedMilestones.includes(milestoneId)) return;
    if (sanctuary.seasonalEvent.lanternPoints < m.pointsRequired) return;

    soundEngine.playCelebration();
    updateSanctuary((prev) => ({
      ...prev,
      coins: prev.coins + m.rewardCoins,
      gems: prev.gems + m.rewardGems,
      seasonalEvent: {
        ...prev.seasonalEvent,
        claimedMilestones: [...prev.seasonalEvent.claimedMilestones, milestoneId],
      },
    }));
    pushToast(`Claimed ${m.title}! +${m.rewardCoins} Coins & +${m.rewardGems} Gems`, 'gold');
  };

  // --- Chat & Cloud Sync ---
  const handleSendChat = (text: string, tag: 'general' | 'trade' | 'visit' | 'milestone') => {
    const sent = socketRef.current?.sendChat({
      id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      senderCode: sanctuary.syncCode,
      senderName: sanctuary.keeperName,
      avatarSpecies: sanctuary.avatarSpecies,
      text,
      tag,
    });
    if (sent) {
      soundEngine.playClick();
    }
  };

  const handleLoadSyncCode = async (code: string): Promise<boolean> => {
    const loaded = await pullCloudSave(code);
    if (!loaded) return false;
    saveLocalSanctuary(loaded);
    setSanctuary(loaded);
    setVisitingSanctuary(null);
    setScreen('playing');
    soundEngine.playCelebration();
    pushToast(`Synced ${loaded.sanctuaryName} (${loaded.syncCode})!`, 'emerald');
    return true;
  };

  const handleOpenDrawer = (drawer: ActiveDrawer) => {
    soundEngine.playClick();
    if (drawer === 'chat') setUnreadChatCount(0);
    if (drawer === 'friends') {
      void fetchCommunitySanctuaries().then(setCommunitySanctuaries);
    }
    if (drawer === 'leaderboard') {
      void fetchLeaderboard().then(setLeaderboard);
    }
    if (drawer === 'share') {
      const snap = engineRef.current?.captureSnapshot() || null;
      setSnapshotUrl(snap);
    }
    setActiveDrawer(drawer);
  };

  const selectedEnclosure = selectedEnclosureId
    ? displayedSanctuary.enclosures.find((e) => e.id === selectedEnclosureId) || null
    : null;

  const placementBanner = placementChoice
    ? placementChoice.kind === 'enclosure'
      ? `${SPECIES_CATALOG[placementChoice.species].habitatTitle} (${placementChoice.variant})`
      : placementChoice.kind === 'crop'
        ? CROP_CATALOG[placementChoice.cropType].name
        : DECOR_CATALOG[placementChoice.decorType].name
    : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#cce6f4]">
      {/* Isolated Full-Viewport 3D WebGL Canvas Mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen */}
      {screen === 'title' && (
        <TitleScreen
          existingSyncCode={sanctuary.syncCode}
          onStart={() => {
            soundEngine.playCelebration();
            setScreen('playing');
          }}
          onLoadSyncCode={handleLoadSyncCode}
        />
      )}

      {/* Playing HUD */}
      {screen === 'playing' && (
        <>
          <TopHud
            sanctuary={sanctuary}
            visitingSanctuary={visitingSanctuary}
            cloudStatus={cloudStatus}
            terrainTheme={terrainTheme}
            weatherEnabled={weatherEnabled}
            onCycleTheme={() => {
              const order: TerrainThemeId[] = ['meadow', 'autumn', 'clover', 'alpine'];
              const labels: Record<TerrainThemeId, string> = {
                meadow: 'Sunlit Meadow · Drifting Pollen',
                autumn: 'Harvest Loam · Falling Maple Leaves',
                clover: 'Riverbank Clover · Gentle Rain',
                alpine: 'Alpine Moss · Soft Snowfall',
              };
              const next = order[(order.indexOf(terrainTheme) + 1) % order.length];
              soundEngine.playPlace();
              setTerrainTheme(next);
              setWeatherEnabled(true);
              engineRef.current?.setWeatherEnabled(true);
              engineRef.current?.setTerrainTheme(next);
              pushToast(labels[next], 'sky');
            }}
            muted={muted}
            onToggleMute={() => setMuted(soundEngine.toggleMute())}
            onResetCamera={() => {
              soundEngine.playClick();
              engineRef.current?.resetCamera();
            }}
            onOpenDrawer={handleOpenDrawer}
            onReturnHome={() => {
              soundEngine.playClick();
              setVisitingSanctuary(null);
              setSelectedEnclosureId(null);
              engineRef.current?.resetCamera();
            }}
            placementBanner={placementBanner}
            onCancelPlacement={() => setPlacementChoice(null)}
          />

          <BottomDock
            activeDrawer={activeDrawer}
            collapsed={dockCollapsed}
            onToggleCollapse={() => setDockCollapsed((c) => !c)}
            onSelectDrawer={handleOpenDrawer}
            hasUnclaimedDaily={canClaimDaily}
            unreadChatCount={unreadChatCount}
            visitingMode={Boolean(visitingSanctuary)}
          />

          {/* Subtle Floating Action Toasts */}
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-md border ${
                  t.tone === 'gold'
                    ? 'bg-[#FDF1D6] text-[#5C3A0E] border-[#C9851E]/35'
                    : t.tone === 'rose'
                      ? 'bg-[#FCE8E8] text-[#7D2626] border-[#C94B4B]/30'
                      : t.tone === 'sky'
                        ? 'bg-[#E5F2FA] text-[#1F4A66] border-[#2A6F97]/30'
                        : 'bg-[#E6F3EA] text-[#1D4B2F] border-[#2F6E49]/30'
                }`}
              >
                {t.text}
              </div>
            ))}
          </div>

          {/* Enclosure Mini-Game Modal */}
          {selectedEnclosure && (
            <EnclosureModal
              enclosure={selectedEnclosure}
              sanctuary={sanctuary}
              isVisiting={Boolean(visitingSanctuary)}
              onClose={() => setSelectedEnclosureId(null)}
              onCompleteFeeding={handleCompleteFeeding}
              onCompleteGrooming={handleCompleteGrooming}
              onUpgradeExotic={handleUpgradeExotic}
              onSendVisitGift={handleSendVisitGift}
            />
          )}

          {/* Modals & Drawers */}
          <DrawerModals
            activeDrawer={activeDrawer}
            onClose={() => setActiveDrawer(null)}
            sanctuary={sanctuary}
            terrainTheme={terrainTheme}
            onChangeTerrainTheme={(theme) => {
              soundEngine.playPlace();
              setTerrainTheme(theme);
              engineRef.current?.setTerrainTheme(theme);
              const weatherNote: Record<TerrainThemeId, string> = {
                meadow: 'Sunlit pollen & petals',
                autumn: 'Falling autumn maple leaves',
                alpine: 'Soft mountain snowfall',
                clover: 'Gentle sunshower rain',
              };
              pushToast(`Atmosphere: ${weatherNote[theme]}`, 'emerald');
            }}
            weatherEnabled={weatherEnabled}
            onToggleWeather={() => {
              soundEngine.playClick();
              setWeatherEnabled((prev) => {
                const next = !prev;
                engineRef.current?.setWeatherEnabled(next);
                return next;
              });
            }}
            decorRotation={decorRotation}
            onRotateDecor={() => {
              soundEngine.playClick();
              setDecorRotation((r) => (r + 1) % 4);
            }}
            onStartPlacement={(choice) => {
              soundEngine.playClick();
              setPlacementChoice(choice);
            }}
            listings={listings}
            onBuyListing={handleBuyListing}
            onCreateListing={handleCreateListing}
            communitySanctuaries={communitySanctuaries}
            onVisitSanctuary={handleVisitSanctuary}
            onRefreshFriends={() => {
              void fetchCommunitySanctuaries().then(setCommunitySanctuaries);
            }}
            leaderboard={leaderboard}
            canClaimDaily={canClaimDaily}
            onClaimDaily={handleClaimDaily}
            onClaimMilestone={handleClaimMilestone}
            chatMessages={chatMessages}
            onlineCount={onlineCount}
            onSendChat={handleSendChat}
            onUpdateProfile={(keeperName, sanctuaryName, avatarSpecies) => {
              updateSanctuary((prev) => ({
                ...prev,
                keeperName: keeperName.trim() || prev.keeperName,
                sanctuaryName: sanctuaryName.trim() || prev.sanctuaryName,
                avatarSpecies,
              }));
            }}
            onSyncNow={async () => {
              const res = await pushCloudSave(sanctuary);
              setCloudStatus(res.ok ? 'synced' : 'offline');
              return res.ok;
            }}
            onLoadSyncCode={handleLoadSyncCode}
            snapshotUrl={snapshotUrl}
            onCaptureSnapshot={() => {
              soundEngine.playClick();
              setSnapshotUrl(engineRef.current?.captureSnapshot() || null);
            }}
            onShareMilestoneToChat={(msg) => {
              handleSendChat(msg, 'milestone');
              pushToast('Shared sanctuary postcard highlight to Community Chat!', 'gold');
            }}
          />
        </>
      )}
    </div>
  );
}
