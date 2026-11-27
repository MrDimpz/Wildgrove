/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  ActiveDrawer,
  ChatMessage,
  CommunitySanctuarySummary,
  DailyQuestItem,
  DirectTradeOffer,
  EditableItemRef,
  EnclosureItem,
  FloatingFeedback,
  LayoutBlueprint,
  LeaderboardEntry,
  MarketplaceListing,
  PlacementChoice,
  ResourceId,
  SanctuaryState,
  SpeciesId,
  StorageCrateItem,
  TimeOfDayId,
} from './types/game';
import {
  ACHIEVEMENTS,
  CRAFTING_RECIPES,
  CROP_CATALOG,
  CROP_GROW_DURATION_MS,
  DAILY_REWARDS,
  DECOR_CATALOG,
  DEFAULT_GRID_SIZE,
  HYBRID_TRAIT_NAMES,
  PLOT_EXPANSIONS,
  RESOURCE_CATALOG,
  SEASONAL_EVENT_INFO,
  SPECIES_CATALOG,
  applyCareDecayToState,
  computePendingIdleCoins,
  computePrestige,
  createStarterSanctuary,
  ensureEnclosureHistory,
  formatMinSec,
  generateDailyQuests,
  getDecorFootprint,
  isCellOccupied,
  normalizeSanctuaryState,
  todayDateString,
  xpRequiredForLevel,
} from './data/catalog';
import { SanctuaryEngine, type PhotoCameraPreset } from './three/SanctuaryEngine';
import { soundEngine } from './audio/soundEngine';
import {
  SanctuarySocketClient,
  buyMarketplaceListing,
  cancelMarketplaceListing,
  createDirectTrade,
  createMarketplaceListing,
  fetchCommunitySanctuaries,
  fetchDirectTrades,
  fetchLeaderboard,
  fetchMarketplaceListings,
  loadLocalSanctuary,
  pullCloudSave,
  pushCloudSave,
  respondDirectTrade,
  saveLocalSanctuary,
  sendVisitGift,
} from './services/cloudSync';
import { TitleScreen } from './components/TitleScreen';
import { TopHud } from './components/TopHud';
import { BottomDock } from './components/BottomDock';
import { EnclosureModal } from './components/EnclosureModal';
import { DrawerModals, type TerrainThemeId } from './components/DrawerModals';
import { PhotoModeOverlay } from './components/PhotoModeOverlay';
import { CircusMiniGamesModal, type MiniGameRewardPayload } from './components/CircusMiniGamesModal';

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

function advanceDailyQuest(
  state: SanctuaryState,
  questType: DailyQuestItem['type'],
  amount = 1,
): SanctuaryState {
  const today = todayDateString();
  const baseQuests =
    state.dailyQuests && state.dailyQuests.date === today
      ? state.dailyQuests
      : generateDailyQuests(today);

  let changed = false;
  const nextList = baseQuests.quests.map((q) => {
    if (q.type !== questType || q.claimed || q.progress >= q.target) return q;
    changed = true;
    return { ...q, progress: Math.min(q.target, q.progress + amount) };
  });

  if (!changed && state.dailyQuests?.date === today) return state;
  return {
    ...state,
    dailyQuests: { date: today, quests: nextList },
  };
}

function findFirstOpenSpot(
  state: SanctuaryState,
  footprint: 1 | 2,
): { gx: number; gz: number } | null {
  const size = state.gridSize === 24 ? 24 : state.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
  for (let gz = 0; gz <= size - footprint; gz++) {
    for (let gx = 0; gx <= size - footprint; gx++) {
      if (!isCellOccupied(state, gx, gz, footprint)) {
        return { gx, gz };
      }
    }
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState<'title' | 'playing'>('title');
  const [sanctuary, setSanctuary] = useState<SanctuaryState>(() => {
    const saved = loadLocalSanctuary();
    return saved ? normalizeSanctuaryState(saved) : createStarterSanctuary();
  });
  const [visitingSanctuary, setVisitingSanctuary] = useState<SanctuaryState | null>(null);
  const [activeDrawer, setActiveDrawer] = useState<ActiveDrawer>(null);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedEnclosureId, setSelectedEnclosureId] = useState<string | null>(null);
  const [showCircusModal, setShowCircusModal] = useState(false);
  const [placementChoice, setPlacementChoice] = useState<PlacementChoice | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [movingItem, setMovingItem] = useState<EditableItemRef | null>(null);
  const [showDemolishConfirm, setShowDemolishConfirm] = useState(false);
  const [decorRotation, setDecorRotation] = useState(0);
  const [terrainTheme, setTerrainTheme] = useState<TerrainThemeId>('meadow');
  const [weatherEnabled, setWeatherEnabled] = useState(true);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDayId>('day');
  const [ambienceOn, setAmbienceOn] = useState(false);
  const [photoMode, setPhotoMode] = useState(false);
  const [photoPreset, setPhotoPreset] = useState<PhotoCameraPreset>('iso');
  const [pendingIdleCoins, setPendingIdleCoins] = useState(() =>
    computePendingIdleCoins(sanctuary),
  );

  const [cloudStatus, setCloudStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const [muted, setMuted] = useState(false);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  // Real-time social states
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [directTrades, setDirectTrades] = useState<DirectTradeOffer[]>([]);
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
  const movingItemRef = useRef(movingItem);
  movingItemRef.current = movingItem;
  const decorRotationRef = useRef(decorRotation);
  decorRotationRef.current = decorRotation;
  const activeDrawerRef = useRef(activeDrawer);
  activeDrawerRef.current = activeDrawer;
  const photoModeRef = useRef(photoMode);
  photoModeRef.current = photoMode;

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

  // --- Keep ambience mood synced with terrain & time-of-day ---
  useEffect(() => {
    soundEngine.setAmbienceMood(terrainTheme, timeOfDay);
  }, [terrainTheme, timeOfDay]);

  // --- Periodic Idle Coin counter & gentle real-time animal care decay ---
  useEffect(() => {
    if (screen !== 'playing') return;
    setPendingIdleCoins(computePendingIdleCoins(sanctuaryRef.current));

    const idleInterval = window.setInterval(() => {
      setPendingIdleCoins(computePendingIdleCoins(sanctuaryRef.current));
    }, 15_000);

    const decayInterval = window.setInterval(() => {
      if (visitingRef.current) return;
      setSanctuary((prev) => {
        const decayed = applyCareDecayToState(prev, Date.now());
        const changed = decayed.enclosures.some(
          (e, i) =>
            e.hunger !== prev.enclosures[i]?.hunger ||
            e.grooming !== prev.enclosures[i]?.grooming ||
            e.happiness !== prev.enclosures[i]?.happiness,
        );
        if (!changed) return prev;
        decayed.prestige = computePrestige(decayed);
        saveLocalSanctuary(decayed);
        return decayed;
      });
    }, 60_000);

    return () => {
      window.clearInterval(idleInterval);
      window.clearInterval(decayInterval);
    };
  }, [screen]);

  // --- Collect Passive Idle Coins ---
  const handleCollectIdleCoins = useCallback(() => {
    const earned = computePendingIdleCoins(sanctuaryRef.current);
    if (earned < 1) return;
    soundEngine.playCoin();
    updateSanctuary((prev) => ({
      ...prev,
      coins: prev.coins + earned,
      lastIdleCollectedAt: Date.now(),
    }));
    setPendingIdleCoins(0);
    pushToast(`Collected +${earned} passive Sanctuary Coins!`, 'gold');
  }, [pushToast, updateSanctuary]);

  // --- Crop Harvest Handler (supports fertilized 5:00 & 2× yield) ---
  const handleHarvestCrop = useCallback(
    (cropId: string) => {
      if (visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const crop = cur.crops.find((c) => c.id === cropId);
      if (!crop) return;
      const dur = crop.growDurationMs || CROP_GROW_DURATION_MS;
      const elapsed = Date.now() - crop.plantedAt;
      const ready = elapsed >= dur;
      if (!ready) {
        const remainingMs = Math.max(0, dur - elapsed);
        pushToast(`Still growing — ready in ${formatMinSec(remainingMs)}`, 'sky');
        soundEngine.playClick();
        return;
      }
      const def = CROP_CATALOG[crop.cropType];
      const yieldAmt = crop.fertilized ? def.yieldAmount * 2 : def.yieldAmount;
      soundEngine.playHarvest();
      engineRef.current?.triggerBurstAtGrid(crop.gridX, crop.gridZ, 1, 0xffd559);

      updateSanctuary((prev) => {
        const updatedCrops = prev.crops.map((c) =>
          c.id === cropId
            ? {
                ...c,
                plantedAt: Date.now(),
                growDurationMs: CROP_GROW_DURATION_MS,
                fertilized: false,
              }
            : c,
        );
        const inv = { ...prev.inventory };
        inv[def.yieldResource] = (inv[def.yieldResource] || 0) + yieldAmt;
        const withStats = advanceDailyQuest(
          {
            ...prev,
            crops: updatedCrops,
            inventory: inv,
            coins: prev.coins + 20,
            seasonalEvent: {
              ...prev.seasonalEvent,
              lanternPoints: prev.seasonalEvent.lanternPoints + 8,
            },
            stats: { ...prev.stats, totalHarvests: prev.stats.totalHarvests + 1 },
          },
          'harvest',
          1,
        );
        const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(
          withStats,
          def.xpReward,
        );
        if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
        newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
        return next;
      });

      pushToast(
        `Harvested +${yieldAmt} ${RESOURCE_CATALOG[def.yieldResource].name}${crop.fertilized ? ' (2× Bonus!)' : ''} (+20 Coins)`,
        'emerald',
      );
    },
    [pushToast, updateSanctuary],
  );

  // --- Harvest All Ready Crops ---
  const handleHarvestAll = useCallback(() => {
    if (visitingRef.current) return;
    const now = Date.now();
    const cur = sanctuaryRef.current;
    const readyList = cur.crops.filter((c) => now - c.plantedAt >= (c.growDurationMs || CROP_GROW_DURATION_MS));
    if (readyList.length === 0) {
      pushToast('No crop plots are ready to harvest yet.', 'sky');
      return;
    }
    soundEngine.playHarvest();
    readyList.forEach((c) => {
      engineRef.current?.triggerBurstAtGrid(c.gridX, c.gridZ, 1, 0xffd559);
    });

    const readyIds = new Set(readyList.map((c) => c.id));
    let totalTreats = 0;
    let totalXp = 0;
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      const nextCrops = prev.crops.map((c) => {
        if (!readyIds.has(c.id)) return c;
        const def = CROP_CATALOG[c.cropType];
        const amt = c.fertilized ? def.yieldAmount * 2 : def.yieldAmount;
        inv[def.yieldResource] = (inv[def.yieldResource] || 0) + amt;
        totalTreats += amt;
        totalXp += def.xpReward;
        return {
          ...c,
          plantedAt: now,
          growDurationMs: CROP_GROW_DURATION_MS,
          fertilized: false,
        };
      });
      const base = advanceDailyQuest(
        {
          ...prev,
          crops: nextCrops,
          inventory: inv,
          coins: prev.coins + readyList.length * 20,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + readyList.length * 8,
          },
          stats: { ...prev.stats, totalHarvests: prev.stats.totalHarvests + readyList.length },
        },
        'harvest',
        readyList.length,
      );
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, totalXp);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });

    pushToast(
      `Harvested ${readyList.length} plots! +${totalTreats} treats & +${readyList.length * 20} Coins`,
      'gold',
    );
  }, [pushToast, updateSanctuary]);

  // --- Fertilize & Instant Bloom Crops ---
  const handleFertilizeCrop = useCallback(
    (cropId: string) => {
      if (visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const crop = cur.crops.find((c) => c.id === cropId);
      if (!crop || crop.fertilized) return;
      if ((cur.inventory.sunbeam_fertilizer || 0) < 1) {
        soundEngine.playError();
        pushToast('Craft Sunbeam Compost in the Treat Kitchen first!', 'rose');
        return;
      }
      soundEngine.playPlace();
      engineRef.current?.triggerBurstAtGrid(crop.gridX, crop.gridZ, 1, 0x52d681);
      updateSanctuary((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          sunbeam_fertilizer: Math.max(0, (prev.inventory.sunbeam_fertilizer || 0) - 1),
        },
        crops: prev.crops.map((c) =>
          c.id === cropId
            ? { ...c, fertilized: true, growDurationMs: Math.round(CROP_GROW_DURATION_MS / 2) }
            : c,
        ),
      }));
      pushToast('Applied Sunbeam Compost — 5:00 grow time & 2× harvest yield!', 'emerald');
    },
    [pushToast, updateSanctuary],
  );

  const handleInstantBloomCrop = useCallback(
    (cropId: string) => {
      if (visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const crop = cur.crops.find((c) => c.id === cropId);
      if (!crop) return;
      const hasElixir = (cur.inventory.meadow_sprinkler || 0) > 0;
      if (!hasElixir && cur.gems < 1) {
        soundEngine.playError();
        pushToast('Need 1 Dewdrop Bloom Elixir or 1 Gem to instant-bloom.', 'rose');
        return;
      }
      soundEngine.playCelebration();
      engineRef.current?.triggerBurstAtGrid(crop.gridX, crop.gridZ, 1, 0xffd56b);
      updateSanctuary((prev) => ({
        ...prev,
        gems: hasElixir ? prev.gems : Math.max(0, prev.gems - 1),
        inventory: hasElixir
          ? {
              ...prev.inventory,
              meadow_sprinkler: Math.max(0, (prev.inventory.meadow_sprinkler || 0) - 1),
            }
          : prev.inventory,
        crops: prev.crops.map((c) =>
          c.id === cropId
            ? {
                ...c,
                plantedAt: Date.now() - (c.growDurationMs || CROP_GROW_DURATION_MS) - 1000,
              }
            : c,
        ),
      }));
      pushToast(
        hasElixir
          ? 'Dewdrop Bloom Elixir used — crop is ripe and ready!'
          : 'Instant Bloomed for 1 Gem — ready to harvest!',
        'gold',
      );
    },
    [pushToast, updateSanctuary],
  );

  // --- Treat Kitchen Crafting ---
  const handleCraftRecipe = useCallback(
    (recipeId: string) => {
      const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
      if (!recipe) return;
      const cur = sanctuaryRef.current;
      const hasIngredients = recipe.ingredients.every(
        (ing) => (cur.inventory[ing.resourceId] || 0) >= ing.qty,
      );
      if (!hasIngredients || cur.coins < recipe.coinCost) {
        soundEngine.playError();
        pushToast('Missing ingredients or Coins for this recipe.', 'rose');
        return;
      }
      soundEngine.playCelebration();
      updateSanctuary((prev) => {
        const inv = { ...prev.inventory };
        for (const ing of recipe.ingredients) {
          inv[ing.resourceId] = Math.max(0, (inv[ing.resourceId] || 0) - ing.qty);
        }
        inv[recipe.outputResource] = (inv[recipe.outputResource] || 0) + recipe.outputQty;
        const base = advanceDailyQuest(
          {
            ...prev,
            coins: prev.coins - recipe.coinCost,
            inventory: inv,
            seasonalEvent: {
              ...prev.seasonalEvent,
              lanternPoints: prev.seasonalEvent.lanternPoints + 12,
            },
          },
          'craft',
          1,
        );
        const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 25);
        if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
        newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
        return next;
      });
      pushToast(
        `Crafted +${recipe.outputQty} ${RESOURCE_CATALOG[recipe.outputResource].name}!`,
        'gold',
      );
    },
    [pushToast, updateSanctuary],
  );

  // --- Grid Placement Handler (including Storage Crate free placement) ---
  const handlePlaceAtTile = useCallback(
    (gridX: number, gridZ: number) => {
      const choice = placementRef.current;
      if (!choice || visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const fp: 1 | 2 =
        choice.kind === 'enclosure'
          ? 2
          : choice.kind === 'storage'
            ? choice.footprint
            : choice.kind === 'decor'
              ? getDecorFootprint(choice.decorType)
              : 1;

      if (isCellOccupied(cur, gridX, gridZ, fp)) {
        soundEngine.playError();
        pushToast('That meadow spot is already occupied.', 'rose');
        return;
      }

      if (choice.kind === 'storage') {
        const crate = cur.storageCrate || [];
        const entry = crate[choice.storageIndex];
        if (!entry) {
          setPlacementChoice(null);
          return;
        }
        soundEngine.playPlace();
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, fp, 0x52d681);
        updateSanctuary((prev) => {
          const nextCrate = [...(prev.storageCrate || [])];
          const [popped] = nextCrate.splice(choice.storageIndex, 1);
          if (!popped) return prev;
          if (popped.kind === 'enclosure') {
            return {
              ...prev,
              storageCrate: nextCrate,
              enclosures: [...prev.enclosures, { ...popped.item, gridX, gridZ }],
            };
          }
          if (popped.kind === 'crop') {
            return {
              ...prev,
              storageCrate: nextCrate,
              crops: [...prev.crops, { ...popped.item, gridX, gridZ }],
            };
          }
          return {
            ...prev,
            storageCrate: nextCrate,
            decorations: [
              ...prev.decorations,
              { ...popped.item, gridX, gridZ, rotation: decorRotationRef.current },
            ],
          };
        });
        pushToast(`Placed ${choice.label} from Storage Crate!`, 'emerald');
        setPlacementChoice(null);
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
          tree_frog: ['Sprout', 'Ribbit', 'Puddle', 'Clover'],
          chameleon: ['Pascal', 'Prism', 'Bramble', 'Ziggy'],
          giant_tortoise: ['Shelby', 'Barnaby', 'Moss', 'Toby'],
          bearded_dragon: ['Saffron', 'Ember', 'Sunny', 'Spike'],
        };
        const pool = defaultNames[choice.species];
        const name = pool[cur.enclosures.length % pool.length];

        soundEngine.playPlace();
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, 2, 0x52d681);

        updateSanctuary((prev) => {
          const now = Date.now();
          const added = {
            id: `enc-${now}`,
            species: choice.species,
            name,
            variant: choice.variant,
            gridX,
            gridZ,
            happiness: 85,
            hunger: 80,
            grooming: 80,
            bondLevel: 1,
            lastFedAt: now,
            lastGroomedAt: now,
            visitorHearts: 0,
            adoptedAt: now,
            timesFed: 0,
            timesGroomed: 0,
            bondHistory: [{ level: 1, reachedAt: now, source: 'adopted' as const }],
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
              fertilized: false,
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
        engineRef.current?.triggerBurstAtGrid(gridX, gridZ, fp, 0xf2b84b);
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
              lanternPoints: prev.seasonalEvent.lanternPoints + (choice.decorType === 'circus_tent' ? 40 : 12),
            },
          };
          const { next, newAchievements } = applyProgressionAndAchievements(
            base,
            choice.decorType === 'circus_tent' ? 60 : 15,
          );
          newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
          return next;
        });
        if (choice.decorType === 'circus_tent') {
          setPlacementChoice(null);
          pushToast('Built Wildgrove Circus Tent! Tap the big-top anytime to play 6 mini-games!', 'gold');
        } else {
          pushToast(`Placed ${dDef.name} (+${dDef.prestigeBonus} Prestige)`, 'gold');
        }
      }
    },
    [pushToast, updateSanctuary],
  );

  // --- Edit Mode Rearrange, Store & Sell Handlers ---
  const handleSelectEditItem = useCallback(
    (item: EditableItemRef) => {
      if (visitingRef.current) return;
      const cur = sanctuaryRef.current;
      let label = 'item';
      if (item.kind === 'enclosure') {
        const enc = cur.enclosures.find((e) => e.id === item.id);
        if (!enc) return;
        label = `${enc.name}'s ${SPECIES_CATALOG[enc.species].habitatTitle}`;
      } else if (item.kind === 'crop') {
        const crop = cur.crops.find((c) => c.id === item.id);
        if (!crop) return;
        label = CROP_CATALOG[crop.cropType].name;
      } else {
        const dec = cur.decorations.find((d) => d.id === item.id);
        if (!dec) return;
        label = DECOR_CATALOG[dec.decorType].name;
      }
      soundEngine.playClick();
      setMovingItem(item);
      pushToast(`Selected ${label} — click an open tile, Store, or Sell`, 'sky');
    },
    [pushToast],
  );

  const handleMoveEditItemToTile = useCallback(
    (gridX: number, gridZ: number) => {
      const item = movingItemRef.current;
      if (!item || visitingRef.current) return;
      const cur = sanctuaryRef.current;
      const fp: 1 | 2 =
        item.kind === 'enclosure'
          ? 2
          : item.kind === 'decor'
            ? (() => {
                const dec = cur.decorations.find((d) => d.id === item.id);
                return dec ? getDecorFootprint(dec.decorType) : 1;
              })()
            : 1;

      if (isCellOccupied(cur, gridX, gridZ, fp, item)) {
        soundEngine.playError();
        pushToast('That meadow spot is already occupied.', 'rose');
        return;
      }

      soundEngine.playPlace();
      engineRef.current?.triggerBurstAtGrid(gridX, gridZ, fp, 0xf2b84b);
      updateSanctuary((prev) => {
        if (item.kind === 'enclosure') {
          return {
            ...prev,
            enclosures: prev.enclosures.map((e) =>
              e.id === item.id ? { ...e, gridX, gridZ } : e,
            ),
          };
        }
        if (item.kind === 'crop') {
          return {
            ...prev,
            crops: prev.crops.map((c) => (c.id === item.id ? { ...c, gridX, gridZ } : c)),
          };
        }
        return {
          ...prev,
          decorations: prev.decorations.map((d) =>
            d.id === item.id ? { ...d, gridX, gridZ } : d,
          ),
        };
      });
      setMovingItem(null);
      pushToast('Item moved to its new meadow spot!', 'emerald');
    },
    [pushToast, updateSanctuary],
  );

  const handleRotateMovingDecor = useCallback(() => {
    const item = movingItemRef.current;
    if (!item || item.kind !== 'decor') return;
    soundEngine.playClick();
    updateSanctuary((prev) => ({
      ...prev,
      decorations: prev.decorations.map((d) =>
        d.id === item.id ? { ...d, rotation: (d.rotation + 1) % 4 } : d,
      ),
    }));
  }, [updateSanctuary]);

  const handleStoreMovingItem = useCallback(() => {
    const item = movingItemRef.current;
    if (!item || visitingRef.current) return;
    soundEngine.playPlace();
    updateSanctuary((prev) => {
      const crate: StorageCrateItem[] = [...(prev.storageCrate || [])];
      if (item.kind === 'enclosure') {
        const target = prev.enclosures.find((e) => e.id === item.id);
        if (!target) return prev;
        crate.unshift({ kind: 'enclosure', item: target, storedAt: Date.now() });
        return {
          ...prev,
          enclosures: prev.enclosures.filter((e) => e.id !== item.id),
          storageCrate: crate,
        };
      }
      if (item.kind === 'crop') {
        const target = prev.crops.find((c) => c.id === item.id);
        if (!target) return prev;
        crate.unshift({ kind: 'crop', item: target, storedAt: Date.now() });
        return {
          ...prev,
          crops: prev.crops.filter((c) => c.id !== item.id),
          storageCrate: crate,
        };
      }
      const target = prev.decorations.find((d) => d.id === item.id);
      if (!target) return prev;
      crate.unshift({ kind: 'decor', item: target, storedAt: Date.now() });
      return {
        ...prev,
        decorations: prev.decorations.filter((d) => d.id !== item.id),
        storageCrate: crate,
      };
    });
    setMovingItem(null);
    pushToast('Packed item safely into your Storage Crate (Build → Crate)!', 'sky');
  }, [pushToast, updateSanctuary]);

  const handleSellMovingItem = useCallback(() => {
    const item = movingItemRef.current;
    if (!item || visitingRef.current || item.kind === 'enclosure') return;
    const cur = sanctuaryRef.current;
    let refund = 0;
    let label = 'item';
    if (item.kind === 'crop') {
      const target = cur.crops.find((c) => c.id === item.id);
      if (!target) return;
      const def = CROP_CATALOG[target.cropType];
      refund = Math.max(10, Math.round(def.costCoins * 0.5));
      label = def.name;
    } else {
      const target = cur.decorations.find((d) => d.id === item.id);
      if (!target) return;
      const def = DECOR_CATALOG[target.decorType];
      refund = Math.max(10, Math.round(def.costCoins * 0.5));
      label = def.name;
    }
    soundEngine.playCoin();
    updateSanctuary((prev) => ({
      ...prev,
      coins: prev.coins + refund,
      crops: item.kind === 'crop' ? prev.crops.filter((c) => c.id !== item.id) : prev.crops,
      decorations:
        item.kind === 'decor' ? prev.decorations.filter((d) => d.id !== item.id) : prev.decorations,
    }));
    setMovingItem(null);
    pushToast(`Sold ${label} for +${refund} Coins!`, 'gold');
  }, [pushToast, updateSanctuary]);

  // --- Daily 3D Hide-and-Seek Foraging (#6) & Circus Tent Mini-Games Rewards ---
  const handleCollectForage = useCallback(
    (forageId: string) => {
      if (visitingRef.current || photoModeRef.current) return;
      const today = todayDateString();
      const curForage = sanctuaryRef.current.dailyForaging;
      const alreadyFound =
        curForage && curForage.date === today ? curForage.foundIds : [];
      if (alreadyFound.includes(forageId)) return;

      const nextFound = [...alreadyFound, forageId];
      const completedAll = nextFound.length >= 3;

      if (completedAll) {
        soundEngine.playCelebration();
      } else {
        soundEngine.playCoin();
      }

      updateSanctuary((prev) => {
        const prevFound =
          prev.dailyForaging && prev.dailyForaging.date === today
            ? prev.dailyForaging.foundIds
            : [];
        if (prevFound.includes(forageId)) return prev;
        const updatedFound = [...prevFound, forageId];
        const isComplete = updatedFound.length >= 3;
        const inv = { ...prev.inventory };
        if (isComplete) {
          inv.lucky_acorn = (inv.lucky_acorn || 0) + 1;
        }
        const base: SanctuaryState = {
          ...prev,
          coins: prev.coins + (isComplete ? 180 : 30),
          gems: prev.gems + (isComplete ? 10 : 0),
          inventory: inv,
          dailyForaging: { date: today, foundIds: updatedFound },
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + (isComplete ? 20 : 5),
          },
        };
        const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(
          base,
          isComplete ? 35 : 12,
        );
        if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
        newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
        return next;
      });

      if (completedAll) {
        pushToast(
          'Daily Foraging Complete (3/3)! Opened Gem Chest: +10 Gems, +180 Coins & +1 Golden Acorn!',
          'gold',
        );
      } else {
        pushToast(
          `Found Hidden Meadow Acorn (${nextFound.length}/3)! +30 Coins`,
          'emerald',
        );
      }
    },
    [pushToast, updateSanctuary],
  );

  const handleMiniGameReward = useCallback(
    (reward: MiniGameRewardPayload) => {
      updateSanctuary((prev) => {
        const inv = { ...prev.inventory };
        if (reward.resource) {
          inv[reward.resource.id] = (inv[reward.resource.id] || 0) + reward.resource.qty;
        }
        const base: SanctuaryState = {
          ...prev,
          coins: prev.coins + reward.coins,
          inventory: inv,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + reward.lanternPoints,
          },
        };
        const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(
          base,
          reward.xp,
        );
        if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
        newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
        return next;
      });
      const bonusStr = reward.resource
        ? ` & +${reward.resource.qty} ${RESOURCE_CATALOG[reward.resource.id].name}`
        : '';
      pushToast(`${reward.gameTitle}: +${reward.coins} Coins${bonusStr}!`, 'gold');
    },
    [pushToast, updateSanctuary],
  );

  // --- Mount Isolated Three.js Engine Once ---
  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new SanctuaryEngine(canvasMountRef.current, {
      onSelectEnclosure: (encId) => {
        if (photoModeRef.current) return;
        soundEngine.playClick();
        setSelectedEnclosureId(encId);
        engine.focusEnclosure(encId);
      },
      onHarvestCrop: (cropId) => {
        if (photoModeRef.current) return;
        handleHarvestCrop(cropId);
      },
      onPlaceAtTile: (gx, gz) => handlePlaceAtTile(gx, gz),
      onSelectEditItem: (item) => handleSelectEditItem(item),
      onMoveEditItemToTile: (gx, gz) => handleMoveEditItemToTile(gx, gz),
      onOpenCircusTent: () => {
        if (photoModeRef.current) return;
        if (visitingRef.current) {
          soundEngine.playClick();
          pushToast('Build your own Wildgrove Circus Tent (5,000 Coins) to host mini-games!', 'sky');
          return;
        }
        soundEngine.playCelebration();
        setSelectedEnclosureId(null);
        setActiveDrawer(null);
        setShowCircusModal(true);
      },
      onCollectForage: (forageId) => handleCollectForage(forageId),
      onVisitorTip: (coins) => {
        if (visitingRef.current || photoModeRef.current) return;
        updateSanctuary((prev) => ({ ...prev, coins: prev.coins + coins }));
        pushToast(`A roaming visitor admired your animals and tipped +${coins} Coins!`, 'gold');
      },
    });
    engineRef.current = engine;
    engine.syncSanctuary(sanctuaryRef.current);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [
    handleCollectForage,
    handleHarvestCrop,
    handleMoveEditItemToTile,
    handlePlaceAtTile,
    handleSelectEditItem,
    pushToast,
    updateSanctuary,
  ]);

  // Keep 3D scene synchronized with active sanctuary (home or visiting friend)
  const displayedSanctuary = visitingSanctuary || sanctuary;
  useEffect(() => {
    engineRef.current?.syncSanctuary(displayedSanctuary);
  }, [displayedSanctuary]);

  useEffect(() => {
    engineRef.current?.setTitleMode(screen !== 'playing');
  }, [screen]);

  useEffect(() => {
    engineRef.current?.setPlacementChoice(placementChoice);
  }, [placementChoice]);

  useEffect(() => {
    engineRef.current?.setEditState(editMode, movingItem);
  }, [editMode, movingItem]);

  // --- Photo Mode & Time-of-Day Handlers ---
  const handleChangeTimeOfDay = useCallback(
    (nextTod: TimeOfDayId) => {
      soundEngine.playClick();
      setTimeOfDay(nextTod);
      engineRef.current?.setTimeOfDay(nextTod);
      const label =
        nextTod === 'night'
          ? 'Moonlit Night · Glowing Fireflies'
          : nextTod === 'sunset'
            ? 'Golden Hour Sunset'
            : 'Bright Sunlit Meadow';
      pushToast(`Sky: ${label}`, 'sky');
    },
    [pushToast],
  );

  const handleCycleTimeOfDay = useCallback(() => {
    const order: TimeOfDayId[] = ['day', 'sunset', 'night'];
    const next = order[(order.indexOf(timeOfDay) + 1) % order.length];
    handleChangeTimeOfDay(next);
  }, [timeOfDay, handleChangeTimeOfDay]);

  const handleToggleAmbience = useCallback(() => {
    setAmbienceOn((prev) => {
      const next = !prev;
      if (next && soundEngine.isMuted()) {
        soundEngine.setMuted(false);
        setMuted(false);
      }
      soundEngine.setAmbienceMood(terrainTheme, timeOfDay);
      soundEngine.setAmbienceEnabled(next);
      pushToast(
        next ? 'Meadow Music & Nature Ambience: On' : 'Meadow Music & Ambience: Off',
        'sky',
      );
      return next;
    });
  }, [terrainTheme, timeOfDay, pushToast]);

  const handleEnterPhotoMode = useCallback(() => {
    soundEngine.playClick();
    setActiveDrawer(null);
    setEditMode(false);
    setMovingItem(null);
    setPlacementChoice(null);
    setSelectedEnclosureId(null);
    setPhotoMode(true);
    setPhotoPreset('iso');
    engineRef.current?.setPhotoMode(true);
  }, []);

  const handleExitPhotoMode = useCallback(() => {
    soundEngine.playClick();
    setPhotoMode(false);
    setPhotoPreset('iso');
    engineRef.current?.setPhotoMode(false);
  }, []);

  const handleSelectPhotoPreset = useCallback((preset: PhotoCameraPreset) => {
    soundEngine.playClick();
    setPhotoPreset(preset);
    engineRef.current?.setPhotoPreset(preset);
  }, []);

  const handlePhotoSnapPostcard = useCallback(() => {
    soundEngine.playCelebration();
    const snap = engineRef.current?.captureSnapshot() || null;
    setSnapshotUrl(snap);
    setPhotoMode(false);
    setPhotoPreset('iso');
    engineRef.current?.setPhotoMode(false);
    setActiveDrawer('share');
  }, []);

  // Keyboard shortcuts: H hides dock, P toggles Photo Mode, Esc exits/closes, R rotates decor
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.code === 'KeyP' && screen === 'playing') {
        if (photoModeRef.current) {
          handleExitPhotoMode();
        } else {
          handleEnterPhotoMode();
        }
      } else if (e.code === 'KeyH' && screen === 'playing' && !photoModeRef.current) {
        setDockCollapsed((c) => !c);
      } else if (e.code === 'Escape') {
        if (photoModeRef.current) {
          handleExitPhotoMode();
        } else if (showDemolishConfirm) {
          setShowDemolishConfirm(false);
        } else if (movingItemRef.current) {
          setMovingItem(null);
        } else {
          setEditMode(false);
          setPlacementChoice(null);
          setActiveDrawer(null);
          setSelectedEnclosureId(null);
        }
      } else if (e.code === 'KeyR') {
        if (placementRef.current?.kind === 'decor') {
          setDecorRotation((r) => (r + 1) % 4);
        } else if (movingItemRef.current?.kind === 'decor') {
          handleRotateMovingDecor();
        }
      } else if (e.key === '?' && screen === 'playing' && !photoModeRef.current) {
        setActiveDrawer((prev) => (prev === 'manual' ? null : 'manual'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    screen,
    showDemolishConfirm,
    handleRotateMovingDecor,
    handleEnterPhotoMode,
    handleExitPhotoMode,
  ]);

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
        setChatMessages((prev) =>
          prev.some((c) => c.id === msg.id) ? prev : [...prev.slice(-79), msg],
        );
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

    void (async () => {
      await pushCloudSave(sanctuaryRef.current);
      const [mkt, friends, lb, trades] = await Promise.all([
        fetchMarketplaceListings(),
        fetchCommunitySanctuaries(),
        fetchLeaderboard(),
        fetchDirectTrades(sanctuaryRef.current.syncCode),
      ]);
      if (mkt.length) setListings(mkt);
      if (friends.length) setCommunitySanctuaries(friends);
      if (lb.length) setLeaderboard(lb);
      if (trades.length) setDirectTrades(trades);
    })();

    return () => {
      client.dispose();
      socketRef.current = null;
    };
  }, [pushToast]);

  // --- Animal Rename & Bio Editor ---
  const handleUpdateAnimalDetails = (enclosureId: string, name: string, bio: string) => {
    soundEngine.playClick();
    updateSanctuary((prev) => ({
      ...prev,
      enclosures: prev.enclosures.map((e) =>
        e.id === enclosureId ? { ...e, name, bio: bio || undefined } : e,
      ),
    }));
    pushToast(`Updated ${name}'s keeper profile!`, 'emerald');
  };

  // --- Serve Crafted Gourmet Meadow Tart ---
  const handleServeGourmetTreat = (enclosureId: string) => {
    const enc = sanctuary.enclosures.find((e) => e.id === enclosureId);
    if (!enc) return;
    if ((sanctuary.inventory.gourmet_treat || 0) < 1) {
      soundEngine.playError();
      pushToast('Bake a Gourmet Meadow Tart in the Treat Kitchen first!', 'rose');
      return;
    }
    soundEngine.playCelebration();
    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0xffd56b);
    updateSanctuary((prev) => {
      const now = Date.now();
      const inv = { ...prev.inventory };
      inv.gourmet_treat = Math.max(0, (inv.gourmet_treat || 0) - 1);
      const nextEnclosures = prev.enclosures.map((e) => {
        if (e.id !== enclosureId) return e;
        const normalized = ensureEnclosureHistory(e);
        const nextBond = Math.min(10, normalized.bondLevel + 1);
        const nextHistory = [...(normalized.bondHistory || [])];
        if (nextBond > normalized.bondLevel) {
          nextHistory.push({ level: nextBond, reachedAt: now, source: 'gourmet' });
        }
        return {
          ...normalized,
          hunger: 100,
          happiness: 100,
          bondLevel: nextBond,
          lastFedAt: now,
          timesFed: (normalized.timesFed || 0) + 1,
          bondHistory: nextHistory,
        };
      });
      const base = advanceDailyQuest(
        {
          ...prev,
          coins: prev.coins + 120,
          enclosures: nextEnclosures,
          inventory: inv,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + 25,
          },
          stats: { ...prev.stats, totalFeeds: prev.stats.totalFeeds + 1 },
        },
        'care',
        1,
      );
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 55);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });
    pushToast(`${enc.name} loved the Gourmet Meadow Tart! +1 Bond Level & +120 Coins`, 'gold');
  };

  // --- Sanctuary Nursery Breeding ---
  const handleBreedAnimals = (parentAId: string, parentBId: string, babyName: string) => {
    const pA = sanctuary.enclosures.find((e) => e.id === parentAId);
    const pB = sanctuary.enclosures.find((e) => e.id === parentBId);
    if (!pA || !pB || pA.id === pB.id) return;
    if (pA.bondLevel < 4 || pB.bondLevel < 4) {
      soundEngine.playError();
      pushToast('Both parents must be Bond Level 4 or higher.', 'rose');
      return;
    }
    if (sanctuary.coins < 150) {
      soundEngine.playError();
      pushToast('Need 150 Coins for the Sanctuary Nursery.', 'rose');
      return;
    }

    const chosenSpecies = Math.random() < 0.5 ? pA.species : pB.species;
    const isExotic = (pA.bondLevel >= 6 && pB.bondLevel >= 6) || Math.random() < 0.4;
    const trait = HYBRID_TRAIT_NAMES[Math.floor(Math.random() * HYBRID_TRAIT_NAMES.length)];
    const fallbackNames = ['Pebble', 'Sprout', 'Clover', 'Pip', 'Lumi', 'Sunny', 'Dewdrop'];
    const finalName =
      babyName || fallbackNames[Math.floor(Math.random() * fallbackNames.length)];
    const now = Date.now();
    const openSpot = findFirstOpenSpot(sanctuary, 2);

    const newBaby: EnclosureItem = {
      id: `enc-baby-${now}`,
      species: chosenSpecies,
      name: finalName,
      bio: `Born in the Wildgrove Nursery as a ${trait}.`,
      variant: isExotic ? 'exotic' : 'classic',
      gridX: openSpot ? openSpot.gx : 0,
      gridZ: openSpot ? openSpot.gz : 0,
      happiness: 100,
      hunger: 95,
      grooming: 95,
      bondLevel: 2,
      lastFedAt: now,
      lastGroomedAt: now,
      visitorHearts: 1,
      adoptedAt: now,
      timesFed: 0,
      timesGroomed: 0,
      bondHistory: [
        { level: 1, reachedAt: now, source: 'bred' },
        { level: 2, reachedAt: now, source: 'bred' },
      ],
      isBaby: true,
      hybridTrait: trait,
      parentNames: [pA.name, pB.name],
    };

    soundEngine.playCelebration();
    if (openSpot) {
      engineRef.current?.triggerBurstAtGrid(openSpot.gx, openSpot.gz, 2, 0xffd56b);
    }

    updateSanctuary((prev) => {
      const base: SanctuaryState = {
        ...prev,
        coins: prev.coins - 150,
        enclosures: openSpot ? [...prev.enclosures, newBaby] : prev.enclosures,
        storageCrate: openSpot
          ? prev.storageCrate || []
          : [{ kind: 'enclosure', item: newBaby, storedAt: now }, ...(prev.storageCrate || [])],
        seasonalEvent: {
          ...prev.seasonalEvent,
          lanternPoints: prev.seasonalEvent.lanternPoints + 35,
        },
      };
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 70);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });

    pushToast(
      openSpot
        ? `Welcomed Nursery Baby ${finalName} (${trait}${isExotic ? ' · Exotic!' : ''})!`
        : `Meadow full — ${finalName} (${trait}) is waiting safely in your Storage Crate!`,
      'gold',
    );
  };

  // --- Sanctuary Layout Blueprints (Save & Apply safely) ---
  const handleSaveBlueprint = (slot: 1 | 2 | 3, name: string) => {
    soundEngine.playPlace();
    updateSanctuary((prev) => {
      const bp: LayoutBlueprint = {
        slot,
        name: name || `Blueprint ${slot}`,
        savedAt: Date.now(),
        gridSize: prev.gridSize || DEFAULT_GRID_SIZE,
        enclosures: prev.enclosures.map((e) => ({
          id: e.id,
          species: e.species,
          gridX: e.gridX,
          gridZ: e.gridZ,
        })),
        crops: prev.crops.map((c) => ({
          id: c.id,
          cropType: c.cropType,
          gridX: c.gridX,
          gridZ: c.gridZ,
        })),
        decorations: prev.decorations.map((d) => ({
          id: d.id,
          decorType: d.decorType,
          gridX: d.gridX,
          gridZ: d.gridZ,
          rotation: d.rotation,
        })),
      };
      const existing = (prev.blueprints || []).filter((b) => b.slot !== slot);
      return { ...prev, blueprints: [...existing, bp].sort((a, b) => a.slot - b.slot) };
    });
    pushToast(`Saved layout to Blueprint Slot ${slot}!`, 'emerald');
  };

  const handleLoadBlueprint = (slot: 1 | 2 | 3) => {
    const bp = (sanctuary.blueprints || []).find((b) => b.slot === slot);
    if (!bp) return;
    soundEngine.playCelebration();
    updateSanctuary((prev) => {
      const size = prev.gridSize === 24 ? 24 : prev.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
      const occupied = new Set<string>();
      const claim = (gx: number, gz: number, fp: 1 | 2): boolean => {
        if (gx < 0 || gz < 0 || gx + fp > size || gz + fp > size) return false;
        for (let dx = 0; dx < fp; dx++) {
          for (let dz = 0; dz < fp; dz++) {
            if (occupied.has(`${gx + dx},${gz + dz}`)) return false;
          }
        }
        for (let dx = 0; dx < fp; dx++) {
          for (let dz = 0; dz < fp; dz++) {
            occupied.add(`${gx + dx},${gz + dz}`);
          }
        }
        return true;
      };
      const findFallback = (fp: 1 | 2): { gx: number; gz: number } => {
        for (let z = 0; z <= size - fp; z++) {
          for (let x = 0; x <= size - fp; x++) {
            if (claim(x, z, fp)) return { gx: x, gz: z };
          }
        }
        return { gx: 0, gz: 0 };
      };

      const usedEncBp = new Set<number>();
      const nextEnclosures = prev.enclosures.map((enc) => {
        let idx = bp.enclosures.findIndex((b, i) => !usedEncBp.has(i) && b.id === enc.id);
        if (idx === -1) {
          idx = bp.enclosures.findIndex((b, i) => !usedEncBp.has(i) && b.species === enc.species);
        }
        if (idx !== -1) {
          usedEncBp.add(idx);
          const target = bp.enclosures[idx];
          if (claim(target.gridX, target.gridZ, 2)) {
            return { ...enc, gridX: target.gridX, gridZ: target.gridZ };
          }
        }
        const fb = claim(enc.gridX, enc.gridZ, 2)
          ? { gx: enc.gridX, gz: enc.gridZ }
          : findFallback(2);
        return { ...enc, gridX: fb.gx, gridZ: fb.gz };
      });

      const usedCropBp = new Set<number>();
      const nextCrops = prev.crops.map((crop) => {
        let idx = bp.crops.findIndex((b, i) => !usedCropBp.has(i) && b.id === crop.id);
        if (idx === -1) {
          idx = bp.crops.findIndex((b, i) => !usedCropBp.has(i) && b.cropType === crop.cropType);
        }
        if (idx !== -1) {
          usedCropBp.add(idx);
          const target = bp.crops[idx];
          if (claim(target.gridX, target.gridZ, 1)) {
            return { ...crop, gridX: target.gridX, gridZ: target.gridZ };
          }
        }
        const fb = claim(crop.gridX, crop.gridZ, 1)
          ? { gx: crop.gridX, gz: crop.gridZ }
          : findFallback(1);
        return { ...crop, gridX: fb.gx, gridZ: fb.gz };
      });

      const usedDecBp = new Set<number>();
      const nextDecor = prev.decorations.map((dec) => {
        const fp = getDecorFootprint(dec.decorType);
        let idx = bp.decorations.findIndex((b, i) => !usedDecBp.has(i) && b.id === dec.id);
        if (idx === -1) {
          idx = bp.decorations.findIndex(
            (b, i) => !usedDecBp.has(i) && b.decorType === dec.decorType,
          );
        }
        if (idx !== -1) {
          usedDecBp.add(idx);
          const target = bp.decorations[idx];
          if (claim(target.gridX, target.gridZ, fp)) {
            return { ...dec, gridX: target.gridX, gridZ: target.gridZ, rotation: target.rotation };
          }
        }
        const fb = claim(dec.gridX, dec.gridZ, fp)
          ? { gx: dec.gridX, gz: dec.gridZ }
          : findFallback(fp);
        return { ...dec, gridX: fb.gx, gridZ: fb.gz };
      });

      return {
        ...prev,
        enclosures: nextEnclosures,
        crops: nextCrops,
        decorations: nextDecor,
      };
    });
    pushToast(`Applied layout blueprint "${bp.name}"!`, 'gold');
  };

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
      const now = Date.now();
      const nextEnclosures = prev.enclosures.map((e) => {
        if (e.id !== enclosureId) return e;
        const normalized = ensureEnclosureHistory(e);
        const nextBond = Math.min(10, normalized.bondLevel + (score >= 110 ? 1 : 0));
        const nextHistory = [...(normalized.bondHistory || [])];
        if (nextBond > normalized.bondLevel) {
          nextHistory.push({ level: nextBond, reachedAt: now, source: 'feed' });
        }
        return {
          ...normalized,
          hunger: Math.min(100, normalized.hunger + 28),
          happiness: Math.min(100, normalized.happiness + 18),
          bondLevel: nextBond,
          lastFedAt: now,
          timesFed: (normalized.timesFed || 0) + 1,
          bondHistory: nextHistory,
        };
      });
      let base: SanctuaryState = advanceDailyQuest(
        {
          ...prev,
          coins: prev.coins + coinsWon,
          enclosures: nextEnclosures,
          inventory: inv,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + 16 + combo * 2,
          },
          stats: { ...prev.stats, totalFeeds: prev.stats.totalFeeds + 1 },
        },
        'care',
        1,
      );
      if (score >= 110) {
        base = advanceDailyQuest(base, 'feed_high', 1);
      }
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
      const now = Date.now();
      const nextEnclosures = prev.enclosures.map((e) => {
        if (e.id !== enclosureId) return e;
        const normalized = ensureEnclosureHistory(e);
        const nextBond = Math.min(10, normalized.bondLevel + (cleanlinessPct >= 95 ? 1 : 0));
        const nextHistory = [...(normalized.bondHistory || [])];
        if (nextBond > normalized.bondLevel) {
          nextHistory.push({ level: nextBond, reachedAt: now, source: 'groom' });
        }
        return {
          ...normalized,
          grooming: Math.min(100, normalized.grooming + 35),
          happiness: Math.min(100, normalized.happiness + 20),
          bondLevel: nextBond,
          lastGroomedAt: now,
          timesGroomed: (normalized.timesGroomed || 0) + 1,
          bondHistory: nextHistory,
        };
      });
      const base = advanceDailyQuest(
        {
          ...prev,
          coins: prev.coins + coinsWon,
          enclosures: nextEnclosures,
          inventory: inv,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + 18,
          },
          stats: { ...prev.stats, totalGrooms: prev.stats.totalGrooms + 1 },
        },
        'care',
        1,
      );
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

  // --- Friends Visiting, Pinning & Care Gift + Guestbook ---
  const handleVisitSanctuary = async (syncCode: string) => {
    soundEngine.playClick();
    const target = await pullCloudSave(syncCode);
    if (!target) {
      pushToast('Could not load that sanctuary right now.', 'rose');
      return;
    }
    setPlacementChoice(null);
    setEditMode(false);
    setMovingItem(null);
    setVisitingSanctuary(normalizeSanctuaryState(target));
    engineRef.current?.resetCamera();
    pushToast(`Arrived at ${target.keeperName}'s ${target.sanctuaryName}!`, 'sky');
  };

  const handleSendVisitGift = async (enclosureId: string, guestbookMessage?: string) => {
    if (!visitingSanctuary) return;
    const updatedTarget = await sendVisitGift(
      visitingSanctuary.syncCode,
      sanctuary.keeperName,
      enclosureId,
      guestbookMessage,
      sanctuary.syncCode,
    );
    if (updatedTarget) {
      setVisitingSanctuary(normalizeSanctuaryState(updatedTarget));
    }
    engineRef.current?.triggerCelebrationAtEnclosure(enclosureId, 0xf2849e);
    updateSanctuary((prev) => {
      const base = advanceDailyQuest(
        {
          ...prev,
          coins: prev.coins + 40,
          seasonalEvent: {
            ...prev.seasonalEvent,
            lanternPoints: prev.seasonalEvent.lanternPoints + 15,
          },
          stats: { ...prev.stats, friendsVisited: prev.stats.friendsVisited + 1 },
        },
        'visit',
        1,
      );
      const { next, newAchievements } = applyProgressionAndAchievements(base, 25);
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });
    pushToast(
      guestbookMessage
        ? 'Care Gift & Guestbook note sent! +40 Coins & +15 Lantern Pts.'
        : 'Care Gift sent! Earned +40 Coins & +15 Lantern Points.',
      'emerald',
    );
  };

  const handleTogglePinFriend = (syncCode: string) => {
    const clean = syncCode.trim().toUpperCase();
    soundEngine.playClick();
    updateSanctuary((prev) => {
      const cur = prev.savedFriends || [];
      const exists = cur.includes(clean);
      return {
        ...prev,
        savedFriends: exists ? cur.filter((c) => c !== clean) : [clean, ...cur].slice(0, 30),
      };
    });
  };

  const handleAddFriendCode = async (syncCode: string): Promise<boolean> => {
    const clean = syncCode.trim().toUpperCase();
    if (clean.length < 4 || clean === sanctuary.syncCode) return false;
    const found = await pullCloudSave(clean);
    if (!found) return false;
    soundEngine.playPlace();
    updateSanctuary((prev) => {
      const cur = prev.savedFriends || [];
      if (cur.includes(clean)) return prev;
      return { ...prev, savedFriends: [clean, ...cur].slice(0, 30) };
    });
    void fetchCommunitySanctuaries().then(setCommunitySanctuaries);
    return true;
  };

  // --- Marketplace Buy, List, Cancel & Direct Trades ---
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
    void fetchMarketplaceListings().then(setListings);
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
    void fetchMarketplaceListings().then(setListings);
    pushToast(`Listed ${def.name} ×${quantity} for ${priceCoins} Coins!`, 'gold');
  };

  const handleCancelListing = async (listingId: string) => {
    const res = await cancelMarketplaceListing(listingId, sanctuary.syncCode);
    if (!res.ok || !res.cancelled) {
      soundEngine.playError();
      pushToast(res.error || 'Could not cancel listing.', 'rose');
      return;
    }
    soundEngine.playPlace();
    const refunded = res.cancelled;
    updateSanctuary((prev) => {
      const inv = { ...prev.inventory };
      const rKey = refunded.itemId as ResourceId;
      if (rKey in inv) {
        inv[rKey] = (inv[rKey] || 0) + refunded.quantity;
      }
      return { ...prev, inventory: inv };
    });
    void fetchMarketplaceListings().then(setListings);
    pushToast(`Cancelled listing and reclaimed ${refunded.itemLabel} ×${refunded.quantity}!`, 'sky');
  };

  const handleSendDirectTrade = async (
    toCode: string,
    resourceId: ResourceId,
    qty: number,
    askingCoins: number,
    note: string,
  ): Promise<boolean> => {
    if ((sanctuary.inventory[resourceId] || 0) < qty) return false;
    const def = RESOURCE_CATALOG[resourceId];
    const res = await createDirectTrade({
      fromCode: sanctuary.syncCode,
      fromName: sanctuary.keeperName,
      toCode,
      resourceId,
      itemLabel: def.name,
      quantity: qty,
      askingCoins,
      note: note || undefined,
    });
    if (!res.ok) {
      soundEngine.playError();
      return false;
    }
    soundEngine.playCoin();
    updateSanctuary((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        [resourceId]: Math.max(0, (prev.inventory[resourceId] || 0) - qty),
      },
    }));
    void fetchDirectTrades(sanctuary.syncCode).then(setDirectTrades);
    pushToast(
      askingCoins === 0
        ? `Sent gift of ${def.name} ×${qty} to ${toCode}!`
        : `Sent trade offer to ${toCode}!`,
      'emerald',
    );
    return true;
  };

  const handleRespondDirectTrade = async (offerId: string, action: 'accept' | 'decline') => {
    const offer = directTrades.find((t) => t.id === offerId);
    if (!offer) return;
    const isIncoming = offer.toCode === sanctuary.syncCode;
    if (action === 'accept' && isIncoming && sanctuary.coins < offer.askingCoins) {
      soundEngine.playError();
      pushToast('Not enough Coins to accept this trade.', 'rose');
      return;
    }
    const res = await respondDirectTrade(offerId, sanctuary.syncCode, action);
    if (!res.ok) {
      soundEngine.playError();
      pushToast(res.error || 'Could not update trade offer.', 'rose');
      return;
    }
    if (action === 'accept' && isIncoming) {
      soundEngine.playCelebration();
      updateSanctuary((prev) => ({
        ...prev,
        coins: prev.coins - offer.askingCoins,
        inventory: {
          ...prev.inventory,
          [offer.resourceId]: (prev.inventory[offer.resourceId] || 0) + offer.quantity,
        },
        stats: { ...prev.stats, totalTrades: prev.stats.totalTrades + 1 },
      }));
      pushToast(`Accepted ${offer.itemLabel} ×${offer.quantity} from ${offer.fromName}!`, 'gold');
    } else if (action === 'decline' && !isIncoming) {
      soundEngine.playClick();
      updateSanctuary((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          [offer.resourceId]: (prev.inventory[offer.resourceId] || 0) + offer.quantity,
        },
      }));
      pushToast(`Cancelled trade offer and reclaimed ${offer.itemLabel} ×${offer.quantity}.`, 'sky');
    } else {
      soundEngine.playClick();
      pushToast('Declined direct trade offer.', 'sky');
    }
    void fetchDirectTrades(sanctuary.syncCode).then(setDirectTrades);
  };

  // --- Daily Rewards, Daily Quests & Seasonal Milestones ---
  const canClaimDaily = sanctuary.dailyReward.lastClaimDate !== todayDateString();
  const hasClaimableQuest = (sanctuary.dailyQuests?.quests || []).some(
    (q) => !q.claimed && q.progress >= q.target,
  );

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
          lastClaimDate: todayDateString(),
        },
      };
    });
    pushToast(`Day ${nextDay} Reward: +${tier.coins} Coins & +${tier.gems} Gems!`, 'gold');
  };

  const handleClaimQuest = (questId: string) => {
    const q = (sanctuary.dailyQuests?.quests || []).find((item) => item.id === questId);
    if (!q || q.claimed || q.progress < q.target) return;
    soundEngine.playCelebration();
    updateSanctuary((prev) => {
      const quests = (prev.dailyQuests?.quests || []).map((item) =>
        item.id === questId ? { ...item, claimed: true } : item,
      );
      const base: SanctuaryState = {
        ...prev,
        coins: prev.coins + q.rewardCoins,
        gems: prev.gems + q.rewardGems,
        seasonalEvent: {
          ...prev.seasonalEvent,
          lanternPoints: prev.seasonalEvent.lanternPoints + q.rewardLanterns,
        },
        dailyQuests: {
          date: prev.dailyQuests?.date || todayDateString(),
          quests,
        },
      };
      const { next, leveledUp, newAchievements } = applyProgressionAndAchievements(base, 40);
      if (leveledUp) pushToast(`Level Up! Sanctuary Level ${next.level}`, 'gold');
      newAchievements.forEach((a) => pushToast(`Achievement Unlocked: ${a}`, 'gold'));
      return next;
    });
    pushToast(
      `Quest Complete! +${q.rewardCoins} Coins, +${q.rewardGems} Gems & +${q.rewardLanterns} Lantern Pts`,
      'gold',
    );
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

  // --- Plot Expansion (12x12 -> 18x18 -> 24x24) ---
  const handleExpandPlot = (targetSize: 18 | 24) => {
    if (visitingSanctuary) return;
    const currentGridSize =
      sanctuary.gridSize === 24 ? 24 : sanctuary.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
    const tier = PLOT_EXPANSIONS.find(
      (t) => t.fromSize === currentGridSize && t.targetSize === targetSize,
    );
    if (!tier) return;
    if (sanctuary.coins < tier.costCoins || sanctuary.gems < tier.costGems) {
      soundEngine.playError();
      pushToast('Not enough Coins or Gems for this plot expansion.', 'rose');
      return;
    }

    const shift = Math.floor((targetSize - currentGridSize) / 2);
    soundEngine.playCelebration();
    updateSanctuary((prev) => ({
      ...prev,
      coins: prev.coins - tier.costCoins,
      gems: prev.gems - tier.costGems,
      gridSize: targetSize,
      enclosures: prev.enclosures.map((e) => ({
        ...e,
        gridX: e.gridX + shift,
        gridZ: e.gridZ + shift,
      })),
      crops: prev.crops.map((c) => ({
        ...c,
        gridX: c.gridX + shift,
        gridZ: c.gridZ + shift,
      })),
      decorations: prev.decorations.map((d) => ({
        ...d,
        gridX: d.gridX + shift,
        gridZ: d.gridZ + shift,
      })),
    }));
    setActiveDrawer(null);
    window.setTimeout(() => engineRef.current?.resetCamera(), 80);
    pushToast(`Expanded your sanctuary meadow to ${targetSize}×${targetSize}!`, 'gold');
  };

  // --- Demolish Everything & Start Fresh ---
  const handleConfirmDemolish = () => {
    const fresh = createStarterSanctuary(
      sanctuary.keeperName,
      sanctuary.sanctuaryName,
      sanctuary.syncCode,
    );
    setShowDemolishConfirm(false);
    setEditMode(false);
    setMovingItem(null);
    setPlacementChoice(null);
    setSelectedEnclosureId(null);
    setActiveDrawer(null);
    setVisitingSanctuary(null);
    setSanctuary(fresh);
    setPendingIdleCoins(0);
    saveLocalSanctuary(fresh);
    setCloudStatus('saving');
    void pushCloudSave(fresh).then((res) => {
      setCloudStatus(res.ok ? 'synced' : 'offline');
    });
    soundEngine.playPlace();
    window.setTimeout(() => engineRef.current?.resetCamera(), 80);
    pushToast('Sanctuary demolished! Starting fresh from the beginning.', 'gold');
  };

  const handleLoadSyncCode = async (code: string): Promise<boolean> => {
    const loaded = await pullCloudSave(code);
    if (!loaded) return false;
    const normalized = normalizeSanctuaryState(loaded);
    saveLocalSanctuary(normalized);
    setSanctuary(normalized);
    setVisitingSanctuary(null);
    setEditMode(false);
    setMovingItem(null);
    setScreen('playing');
    setPendingIdleCoins(computePendingIdleCoins(normalized));
    soundEngine.playCelebration();
    pushToast(`Synced ${normalized.sanctuaryName} (${normalized.syncCode})!`, 'emerald');
    return true;
  };

  const handleOpenDrawer = (drawer: ActiveDrawer) => {
    soundEngine.playClick();
    if (drawer !== null) {
      setEditMode(false);
      setMovingItem(null);
    }
    if (drawer === 'chat') setUnreadChatCount(0);
    if (drawer === 'market') {
      void fetchMarketplaceListings().then(setListings);
      void fetchDirectTrades(sanctuary.syncCode).then(setDirectTrades);
    }
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

  const handleToggleEditMode = () => {
    if (visitingSanctuary) return;
    soundEngine.playClick();
    setEditMode((prev) => {
      const next = !prev;
      if (next) {
        setActiveDrawer(null);
        setPlacementChoice(null);
        setSelectedEnclosureId(null);
      } else {
        setMovingItem(null);
      }
      return next;
    });
  };

  const selectedEnclosure = selectedEnclosureId
    ? displayedSanctuary.enclosures.find((e) => e.id === selectedEnclosureId) || null
    : null;

  const placementBanner = placementChoice
    ? placementChoice.kind === 'enclosure'
      ? `${SPECIES_CATALOG[placementChoice.species].habitatTitle} (${placementChoice.variant})`
      : placementChoice.kind === 'crop'
        ? CROP_CATALOG[placementChoice.cropType].name
        : placementChoice.kind === 'storage'
          ? `${placementChoice.label} (from Crate)`
          : DECOR_CATALOG[placementChoice.decorType].name
    : null;

  const movingItemLabel = movingItem
    ? movingItem.kind === 'enclosure'
      ? (() => {
          const enc = sanctuary.enclosures.find((e) => e.id === movingItem.id);
          return enc ? `${enc.name}'s ${SPECIES_CATALOG[enc.species].habitatTitle}` : null;
        })()
      : movingItem.kind === 'crop'
        ? (() => {
            const crop = sanctuary.crops.find((c) => c.id === movingItem.id);
            return crop ? CROP_CATALOG[crop.cropType].name : null;
          })()
        : (() => {
            const dec = sanctuary.decorations.find((d) => d.id === movingItem.id);
            return dec ? DECOR_CATALOG[dec.decorType].name : null;
          })()
    : null;

  const hasReadyCare =
    pendingIdleCoins >= 10 ||
    sanctuary.crops.some(
      (c) => Date.now() - c.plantedAt >= (c.growDurationMs || CROP_GROW_DURATION_MS),
    ) ||
    sanctuary.enclosures.some((e) => e.hunger < 65 || e.grooming < 65);

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

      {/* Playing HUD or Clean Photo Studio Mode */}
      {screen === 'playing' && (
        <>
          {photoMode ? (
            <PhotoModeOverlay
              sanctuaryName={displayedSanctuary.sanctuaryName}
              timeOfDay={timeOfDay}
              activePreset={photoPreset}
              onSelectPreset={handleSelectPhotoPreset}
              onCycleTimeOfDay={handleCycleTimeOfDay}
              onSnapPostcard={handlePhotoSnapPostcard}
              onExit={handleExitPhotoMode}
            />
          ) : (
            <>
              <TopHud
                sanctuary={sanctuary}
                visitingSanctuary={visitingSanctuary}
                cloudStatus={cloudStatus}
                terrainTheme={terrainTheme}
                weatherEnabled={weatherEnabled}
                timeOfDay={timeOfDay}
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
                onCycleTimeOfDay={handleCycleTimeOfDay}
                muted={muted}
                onToggleMute={() => setMuted(soundEngine.toggleMute())}
                ambienceOn={ambienceOn}
                onToggleAmbience={handleToggleAmbience}
                onEnterPhotoMode={handleEnterPhotoMode}
                pendingIdleCoins={pendingIdleCoins}
                onCollectIdleCoins={handleCollectIdleCoins}
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
                editMode={editMode}
                movingItemLabel={movingItemLabel}
                movingItemIsDecor={movingItem?.kind === 'decor'}
                movingItemCanSell={movingItem?.kind === 'crop' || movingItem?.kind === 'decor'}
                onRotateMovingDecor={handleRotateMovingDecor}
                onStoreMovingItem={handleStoreMovingItem}
                onSellMovingItem={handleSellMovingItem}
                onCancelMovingItem={() => setMovingItem(null)}
                onExitEditMode={() => {
                  setEditMode(false);
                  setMovingItem(null);
                }}
                onRequestDemolish={() => {
                  soundEngine.playClick();
                  setShowDemolishConfirm(true);
                }}
                forageFoundCount={
                  sanctuary.dailyForaging && sanctuary.dailyForaging.date === todayDateString()
                    ? sanctuary.dailyForaging.foundIds.length
                    : 0
                }
                onHintForage={() => {
                  soundEngine.playClick();
                  const focused = engineRef.current?.focusNextForageAcorn();
                  if (focused) {
                    pushToast('Look closely near the sunlit meadow border for a shimmering Golden Acorn!', 'emerald');
                  }
                }}
              />

              <BottomDock
                activeDrawer={activeDrawer}
                collapsed={dockCollapsed}
                onToggleCollapse={() => setDockCollapsed((c) => !c)}
                onSelectDrawer={handleOpenDrawer}
                editMode={editMode}
                onToggleEditMode={handleToggleEditMode}
                hasUnclaimedDaily={canClaimDaily || hasClaimableQuest}
                hasReadyCare={hasReadyCare}
                unreadChatCount={unreadChatCount}
                visitingMode={Boolean(visitingSanctuary)}
              />
            </>
          )}

          {/* Subtle Floating Action Toasts */}
          {!photoMode && (
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
          )}

          {/* Enclosure Mini-Game Modal */}
          {selectedEnclosure && !photoMode && (
            <EnclosureModal
              enclosure={selectedEnclosure}
              sanctuary={sanctuary}
              displayedSanctuary={displayedSanctuary}
              isVisiting={Boolean(visitingSanctuary)}
              onClose={() => setSelectedEnclosureId(null)}
              onCompleteFeeding={handleCompleteFeeding}
              onCompleteGrooming={handleCompleteGrooming}
              onServeGourmetTreat={handleServeGourmetTreat}
              onUpdateAnimalDetails={handleUpdateAnimalDetails}
              onUpgradeExotic={handleUpgradeExotic}
              onSendVisitGift={handleSendVisitGift}
            />
          )}

          {/* Circus Tent Carnival Mini-Games Modal */}
          {showCircusModal && !photoMode && !visitingSanctuary && (
            <CircusMiniGamesModal
              sanctuary={sanctuary}
              onClose={() => setShowCircusModal(false)}
              onClaimReward={handleMiniGameReward}
            />
          )}

          {/* Modals & Drawers */}
          {!photoMode && (
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
              timeOfDay={timeOfDay}
              onChangeTimeOfDay={handleChangeTimeOfDay}
              decorRotation={decorRotation}
              onRotateDecor={() => {
                soundEngine.playClick();
                setDecorRotation((r) => (r + 1) % 4);
              }}
              onStartPlacement={(choice) => {
                soundEngine.playClick();
                setEditMode(false);
                setMovingItem(null);
                setPlacementChoice(choice);
              }}
              onExpandPlot={handleExpandPlot}
              onBreedAnimals={handleBreedAnimals}
              onSaveBlueprint={handleSaveBlueprint}
              onLoadBlueprint={handleLoadBlueprint}
              onCraftRecipe={handleCraftRecipe}
              onFertilizeCrop={handleFertilizeCrop}
              onInstantBloomCrop={handleInstantBloomCrop}
              onHarvestAll={handleHarvestAll}
              onHarvestSingle={handleHarvestCrop}
              pendingIdleCoins={pendingIdleCoins}
              onCollectIdleCoins={handleCollectIdleCoins}
              onJumpToEnclosure={(encId) => {
                soundEngine.playClick();
                setSelectedEnclosureId(encId);
                engineRef.current?.focusEnclosure(encId);
              }}
              listings={listings}
              onBuyListing={handleBuyListing}
              onCreateListing={handleCreateListing}
              onCancelListing={handleCancelListing}
              directTrades={directTrades}
              onSendDirectTrade={handleSendDirectTrade}
              onRespondDirectTrade={handleRespondDirectTrade}
              communitySanctuaries={communitySanctuaries}
              onVisitSanctuary={handleVisitSanctuary}
              onRefreshFriends={() => {
                void fetchCommunitySanctuaries().then(setCommunitySanctuaries);
              }}
              onTogglePinFriend={handleTogglePinFriend}
              onAddFriendCode={handleAddFriendCode}
              leaderboard={leaderboard}
              canClaimDaily={canClaimDaily}
              onClaimDaily={handleClaimDaily}
              onClaimMilestone={handleClaimMilestone}
              onClaimQuest={handleClaimQuest}
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
          )}

          {/* Demolish Everything Confirmation Modal */}
          {showDemolishConfirm && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#19241B]/55">
              <div className="w-full max-w-md bg-[#FAF6EE] border border-[#263129]/15 rounded-3xl shadow-[0_24px_64px_rgba(24,36,26,0.35)] overflow-hidden p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#FCE8E8] border border-[#C94B4B]/25 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-[#B53232]" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-display font-bold text-lg text-[#233026]">
                      Demolish Everything &amp; Start Over?
                    </h2>
                    <p className="text-xs sm:text-sm text-[#4D5D50] leading-relaxed">
                      This will clear your current sanctuary layout, plot expansions, coins, gems, inventory, and progress, resetting your meadow back to a brand-new starter sanctuary. This action cannot be undone.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setShowDemolishConfirm(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs sm:text-sm font-semibold text-[#233026] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDemolish}
                    className="px-4 py-2.5 rounded-xl bg-[#B83232] hover:bg-[#9B2727] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                  >
                    Yes, Demolish Everything
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
