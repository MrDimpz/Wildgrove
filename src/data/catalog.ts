import type {
  BondHistoryEntry,
  CropTypeId,
  DailyQuestItem,
  DailyQuestState,
  DecorTypeId,
  DecorationItem,
  EditableItemRef,
  EnclosureItem,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from '../types/game';

export const GRID_SIZE = 12;
export const DEFAULT_GRID_SIZE = 12;
export const MAX_GRID_SIZE = 24;
export const CROP_GROW_DURATION_MS = 600_000; // 10 minutes

export interface PlotExpansionTier {
  fromSize: number;
  targetSize: 18 | 24;
  costCoins: number;
  costGems: number;
  title: string;
  description: string;
}

export const PLOT_EXPANSIONS: PlotExpansionTier[] = [
  {
    fromSize: 12,
    targetSize: 18,
    costCoins: 3500,
    costGems: 20,
    title: 'Expand Meadow to 18×18',
    description: 'Adds 180 fresh meadow tiles around all four borders (324 tiles total).',
  },
  {
    fromSize: 18,
    targetSize: 24,
    costCoins: 10000,
    costGems: 50,
    title: 'Expand Sanctuary to 24×24',
    description: 'Unlocks the full Grand Sanctuary layout (576 buildable tiles).',
  },
];

export function formatMinSec(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function generateDailyQuests(dateStr = todayDateString()): DailyQuestState {
  // Deterministic 3-quest rotation seeded by date so all devices agree
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) % 997;
  }
  const pool: Array<Omit<DailyQuestItem, 'progress' | 'claimed'>> = [
    {
      id: `q-harvest-${dateStr}`,
      type: 'harvest',
      title: 'Harvest 3 Treat Crops',
      target: 3,
      rewardCoins: 140,
      rewardGems: 4,
      rewardLanterns: 20,
    },
    {
      id: `q-care-${dateStr}`,
      type: 'care',
      title: 'Complete 2 Feed or Groom Sessions',
      target: 2,
      rewardCoins: 160,
      rewardGems: 5,
      rewardLanterns: 25,
    },
    {
      id: `q-feedhigh-${dateStr}`,
      type: 'feed_high',
      title: 'Score 110+ in Treat Toss (1 time)',
      target: 1,
      rewardCoins: 180,
      rewardGems: 6,
      rewardLanterns: 30,
    },
    {
      id: `q-visit-${dateStr}`,
      type: 'visit',
      title: 'Visit a Friend & Leave a Care Gift',
      target: 1,
      rewardCoins: 150,
      rewardGems: 5,
      rewardLanterns: 25,
    },
    {
      id: `q-craft-${dateStr}`,
      type: 'craft',
      title: 'Craft 1 Gourmet Treat or Booster',
      target: 1,
      rewardCoins: 170,
      rewardGems: 5,
      rewardLanterns: 25,
    },
  ];
  // Always include harvest & care, plus 1 rotating bonus quest
  const thirdIdx = 2 + (hash % 3);
  const picked = [pool[0], pool[1], pool[thirdIdx]].map((q) => ({
    ...q,
    progress: 0,
    claimed: false,
  }));
  return { date: dateStr, quests: picked };
}

export const SPECIES_SYNERGY_DECOR: Record<SpeciesId, DecorTypeId[]> = {
  raccoon: ['koi_pond', 'willow', 'hay_cart', 'campfire_lounge'],
  gorilla: ['bamboo', 'lantern_post', 'willow', 'greenhouse'],
  butterfly: ['flower_arch', 'fountain', 'gazebo', 'greenhouse'],
  wolf: ['autumn_maple', 'fountain', 'lantern_post', 'campfire_lounge'],
  red_panda: ['bamboo', 'autumn_maple', 'lantern_post', 'wooden_bridge_arch'],
  golden_fox: ['autumn_maple', 'hay_cart', 'flower_arch', 'windmill'],
  snow_leopard: ['fountain', 'lantern_post', 'gazebo', 'wishing_well'],
  river_otter: ['koi_pond', 'willow', 'fountain', 'wooden_bridge_arch'],
  tree_frog: ['koi_pond', 'willow', 'wishing_well', 'wooden_bridge_arch'],
  chameleon: ['greenhouse', 'bamboo', 'flower_arch', 'lantern_post'],
  giant_tortoise: ['keeper_cottage', 'windmill', 'hay_cart', 'wishing_well'],
  bearded_dragon: ['campfire_lounge', 'windmill', 'keeper_cottage', 'lantern_post'],
};

export interface SynergySummary {
  matchedDecorNames: string[];
  bonusPrestige: number;
  happinessBonus: number;
}

export function computeEnclosureSynergy(
  enc: EnclosureItem,
  decorations: DecorationItem[],
): SynergySummary {
  const favorites = new Set<DecorTypeId>([...(SPECIES_SYNERGY_DECOR[enc.species] || []), 'gazebo']);
  const matchedNames: string[] = [];
  for (const dec of decorations) {
    if (!favorites.has(dec.decorType)) continue;
    // Distance from decoration tile to the 2x2 enclosure footprint [enc.gridX..enc.gridX+1, enc.gridZ..enc.gridZ+1]
    const dx =
      dec.gridX < enc.gridX
        ? enc.gridX - dec.gridX
        : dec.gridX > enc.gridX + 1
          ? dec.gridX - (enc.gridX + 1)
          : 0;
    const dz =
      dec.gridZ < enc.gridZ
        ? enc.gridZ - dec.gridZ
        : dec.gridZ > enc.gridZ + 1
          ? dec.gridZ - (enc.gridZ + 1)
          : 0;
    if (Math.max(dx, dz) <= 2) {
      const label = DECOR_CATALOG[dec.decorType]?.name;
      if (label && matchedNames.length < 4) {
        matchedNames.push(label);
      }
    }
  }
  const bonusPrestige = Math.min(100, matchedNames.length * 25);
  const happinessBonus = Math.min(12, matchedNames.length * 3);
  return { matchedDecorNames: matchedNames, bonusPrestige, happinessBonus };
}

export function computePendingIdleCoins(state: SanctuaryState, now = Date.now()): number {
  const lastAt = state.lastIdleCollectedAt || state.updatedAt || now;
  const elapsedMinutes = Math.min(480, Math.max(0, (now - lastAt) / 60_000));
  if (elapsedMinutes < 0.25) return 0;
  let coinsPerMinute = 0;
  for (const enc of state.enclosures) {
    if (enc.happiness < 45) continue;
    const happyMult = enc.happiness >= 80 ? 1.35 : 1.0;
    const exoticMult = enc.variant === 'exotic' ? 1.4 : 1.0;
    const babyMult = enc.isBaby ? 1.2 : 1.0;
    coinsPerMinute += (1.8 + enc.bondLevel * 0.45) * happyMult * exoticMult * babyMult;
  }
  return Math.min(2500, Math.floor(coinsPerMinute * elapsedMinutes));
}

export function applyCareDecayToState(state: SanctuaryState, now = Date.now()): SanctuaryState {
  const updatedEnclosures = state.enclosures.map((enc) => {
    const minsSinceFed = Math.max(0, (now - (enc.lastFedAt || now)) / 60_000);
    const minsSinceGroomed = Math.max(0, (now - (enc.lastGroomedAt || now)) / 60_000);
    const synergy = computeEnclosureSynergy(enc, state.decorations || []);
    // Gentle real-time decay: ~1 hunger per 6 min, ~1 grooming per 8 min, never below 20%
    const hungerDecay = Math.min(45, Math.floor(minsSinceFed / 6));
    const groomDecay = Math.min(45, Math.floor(minsSinceGroomed / 8));
    const nextHunger = Math.max(20, Math.min(100, enc.hunger - (hungerDecay > 0 ? 1 : 0)));
    const nextGrooming = Math.max(20, Math.min(100, enc.grooming - (groomDecay > 0 ? 1 : 0)));
    const targetHappiness = Math.min(
      100,
      Math.round((nextHunger + nextGrooming) / 2 + synergy.happinessBonus),
    );
    const nextHappiness =
      enc.happiness > targetHappiness ? Math.max(25, enc.happiness - 1) : enc.happiness;
    return {
      ...enc,
      hunger: nextHunger,
      grooming: nextGrooming,
      happiness: nextHappiness,
    };
  });
  return {
    ...state,
    enclosures: updatedEnclosures,
  };
}

export function ensureEnclosureHistory(enc: EnclosureItem): EnclosureItem {
  const now = Date.now();
  const bondLevel = Math.max(1, Math.min(10, Math.round(enc.bondLevel || 1)));
  const lastFedAt = typeof enc.lastFedAt === 'number' && enc.lastFedAt > 0 ? enc.lastFedAt : now;
  const lastGroomedAt =
    typeof enc.lastGroomedAt === 'number' && enc.lastGroomedAt > 0 ? enc.lastGroomedAt : now;
  const latestCareAt = Math.max(lastFedAt, lastGroomedAt);
  const fallbackAdoptedAt = Math.max(
    0,
    Math.min(lastFedAt, lastGroomedAt) - Math.max(1, bondLevel) * 180_000,
  );
  const adoptedAt =
    typeof enc.adoptedAt === 'number' && enc.adoptedAt > 0 ? enc.adoptedAt : fallbackAdoptedAt;

  const timesFed =
    typeof enc.timesFed === 'number' && Number.isFinite(enc.timesFed)
      ? Math.max(0, Math.round(enc.timesFed))
      : Math.max(0, bondLevel - 1);
  const timesGroomed =
    typeof enc.timesGroomed === 'number' && Number.isFinite(enc.timesGroomed)
      ? Math.max(0, Math.round(enc.timesGroomed))
      : Math.max(0, Math.floor(bondLevel / 2));

  const byLevel = new Map<number, BondHistoryEntry>();
  if (Array.isArray(enc.bondHistory)) {
    for (const entry of enc.bondHistory) {
      if (!entry || typeof entry !== 'object') continue;
      const lvl = Math.max(1, Math.min(10, Math.round(entry.level || 1)));
      const src =
        entry.source === 'adopted' ||
        entry.source === 'feed' ||
        entry.source === 'groom' ||
        entry.source === 'exotic' ||
        entry.source === 'gourmet' ||
        entry.source === 'bred'
          ? entry.source
          : lvl === 1
            ? 'adopted'
            : 'feed';
      const reachedAt =
        typeof entry.reachedAt === 'number' && entry.reachedAt > 0 ? entry.reachedAt : adoptedAt;
      if (!byLevel.has(lvl)) {
        byLevel.set(lvl, { level: lvl, reachedAt, source: src });
      }
    }
  }

  if (!byLevel.has(1)) {
    byLevel.set(1, { level: 1, reachedAt: adoptedAt, source: enc.isBaby ? 'bred' : 'adopted' });
  }

  if (bondLevel > 1) {
    const span = Math.max(60_000, latestCareAt - adoptedAt);
    for (let lvl = 2; lvl <= bondLevel; lvl++) {
      if (!byLevel.has(lvl)) {
        const fraction = (lvl - 1) / Math.max(1, bondLevel - 1);
        const reachedAt = Math.round(adoptedAt + span * fraction);
        byLevel.set(lvl, {
          level: lvl,
          reachedAt,
          source: lvl % 2 === 0 ? 'feed' : 'groom',
        });
      }
    }
  }

  const bondHistory = Array.from(byLevel.values()).sort((a, b) => a.level - b.level);

  return {
    ...enc,
    bondLevel,
    lastFedAt,
    lastGroomedAt,
    adoptedAt,
    timesFed,
    timesGroomed,
    bondHistory,
  };
}

export const GENERATED_GROVE_CODES = new Set([
  'GROVE-LUNA',
  'GROVE-FERN',
  'GROVE-IRIS',
  'GROVE-OAK7',
]);

export function normalizeSanctuaryState(state: SanctuaryState): SanctuaryState {
  const validGridSize = state.gridSize === 24 ? 24 : state.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
  const today = todayDateString();
  const existingQuests =
    state.dailyQuests && state.dailyQuests.date === today && Array.isArray(state.dailyQuests.quests)
      ? state.dailyQuests
      : generateDailyQuests(today);

  const inventory: Record<ResourceId, number> = {
    berry_treat: 0,
    mango_treat: 0,
    nectar_treat: 0,
    herb_treat: 0,
    bamboo_shoot_treat: 0,
    fox_berry_treat: 0,
    ice_fish_treat: 0,
    river_reed_treat: 0,
    lucky_acorn: 0,
    silverback_amber: 0,
    wing_dust: 0,
    moonstone_pelt: 0,
    lantern_charm: 0,
    fire_tail_charm: 0,
    sun_crystal: 0,
    frost_pelt: 0,
    river_pearl: 0,
    jade_lily_dew: 0,
    prism_scale: 0,
    ancient_shell_amber: 0,
    sunstone_scale: 0,
    gourmet_treat: 0,
    sunbeam_fertilizer: 0,
    meadow_sprinkler: 0,
    ...(state.inventory as Partial<Record<ResourceId, number>> | undefined),
  };

  const existingForaging =
    state.dailyForaging &&
    state.dailyForaging.date === today &&
    Array.isArray(state.dailyForaging.foundIds)
      ? {
          date: today,
          foundIds: Array.from(
            new Set(
              state.dailyForaging.foundIds.filter(
                (id): id is string =>
                  id === 'forage-0' || id === 'forage-1' || id === 'forage-2',
              ),
            ),
          ),
        }
      : { date: today, foundIds: [] };

  return {
    ...state,
    gridSize: validGridSize,
    enclosures: (state.enclosures || []).map(ensureEnclosureHistory),
    crops: (state.crops || []).map((c) => ({
      ...c,
      growDurationMs: c.fertilized ? Math.round(CROP_GROW_DURATION_MS / 2) : CROP_GROW_DURATION_MS,
    })),
    inventory,
    storageCrate: Array.isArray(state.storageCrate) ? state.storageCrate : [],
    dailyQuests: existingQuests,
    dailyForaging: existingForaging,
    savedFriends: Array.isArray(state.savedFriends)
      ? state.savedFriends.filter((code) => !GENERATED_GROVE_CODES.has(code))
      : [],
    guestbook: Array.isArray(state.guestbook) ? state.guestbook : [],
    blueprints: Array.isArray(state.blueprints) ? state.blueprints : [],
    lastIdleCollectedAt:
      typeof state.lastIdleCollectedAt === 'number' && state.lastIdleCollectedAt > 0
        ? state.lastIdleCollectedAt
        : state.updatedAt || Date.now(),
  };
}

export interface SpeciesDefinition {
  id: SpeciesId;
  name: string;
  exoticName: string;
  habitatTitle: string;
  description: string;
  favoriteTreat: ResourceId;
  rareDrop: ResourceId;
  costCoins: number;
  exoticCostGems: number;
  prestigeBase: number;
  accentHex: string;
  coatHex: string;
  exoticCoatHex: string;
  groomTaskLabel: string;
  groomToolName: string;
  feedVerb: string;
}

export const SPECIES_CATALOG: Record<SpeciesId, SpeciesDefinition> = {
  raccoon: {
    id: 'raccoon',
    name: 'Bandit Raccoon',
    exoticName: 'Sakura Spirit Raccoon',
    habitatTitle: 'Timber Hollow & Creek',
    description:
      'Clever nocturnal foragers who love rinsing sweet wild berries in mossy creek basins.',
    favoriteTreat: 'berry_treat',
    rareDrop: 'lucky_acorn',
    costCoins: 180,
    exoticCostGems: 18,
    prestigeBase: 140,
    accentHex: '#C26D3A',
    coatHex: '#6E6C6A',
    exoticCoatHex: '#D695A3',
    groomTaskLabel: 'Rinse creek mud & comb tail rings',
    groomToolName: 'Cedar Bristle Comb',
    feedVerb: 'Toss Sweet Berries',
  },
  gorilla: {
    id: 'gorilla',
    name: 'Highland Gorilla',
    exoticName: 'Golden Crown Silverback',
    habitatTitle: 'Emerald Jungle Canopy',
    description:
      'Gentle forest guardians who lounge beneath bamboo arches and feast on sun-ripened mangoes.',
    favoriteTreat: 'mango_treat',
    rareDrop: 'silverback_amber',
    costCoins: 340,
    exoticCostGems: 26,
    prestigeBase: 220,
    accentHex: '#2E7D4F',
    coatHex: '#3A3E42',
    exoticCoatHex: '#C59A4B',
    groomTaskLabel: 'Brush vine twigs & soothe shoulders',
    groomToolName: 'Bamboo Soft Brush',
    feedVerb: 'Toss Golden Mangoes',
  },
  butterfly: {
    id: 'butterfly',
    name: 'Monarch Flutter',
    exoticName: 'Sapphire Morpho Swarm',
    habitatTitle: 'Sunlit Nectar Conservatory',
    description:
      'Radiant pollinators dancing inside brass-and-glass garden gazebos bursting with lavender.',
    favoriteTreat: 'nectar_treat',
    rareDrop: 'wing_dust',
    costCoins: 240,
    exoticCostGems: 22,
    prestigeBase: 185,
    accentHex: '#D9822B',
    coatHex: '#EE8322',
    exoticCoatHex: '#2494E8',
    groomTaskLabel: 'Mist warm dew & clear heavy pollen',
    groomToolName: 'Brass Dew Mister',
    feedVerb: 'Offer Nectar Drops',
  },
  wolf: {
    id: 'wolf',
    name: 'Timber Wolf',
    exoticName: 'Moonlit Frost Wolf',
    habitatTitle: 'Alpine Pine Ridge',
    description:
      'Loyal mountain packmates perched beside slate outcrops, whispering pines, and lantern light.',
    favoriteTreat: 'herb_treat',
    rareDrop: 'moonstone_pelt',
    costCoins: 420,
    exoticCostGems: 32,
    prestigeBase: 260,
    accentHex: '#4F6D8A',
    coatHex: '#7A8087',
    exoticCoatHex: '#DCE8F5',
    groomTaskLabel: 'Untangle pine burrs & slick winter ruff',
    groomToolName: 'Silver Slicker Brush',
    feedVerb: 'Toss Alpine Herb Treats',
  },
  red_panda: {
    id: 'red_panda',
    name: 'Red Panda',
    exoticName: 'Sunburst Red Panda',
    habitatTitle: 'Bamboo Glade & Rock',
    description:
      'Playful arboreal acrobats who nimbly scramble across bamboo branches and feast on fresh shoots.',
    favoriteTreat: 'bamboo_shoot_treat',
    rareDrop: 'fire_tail_charm',
    costCoins: 480,
    exoticCostGems: 36,
    prestigeBase: 280,
    accentHex: '#D9532B',
    coatHex: '#B23A1E',
    exoticCoatHex: '#FFA834',
    groomTaskLabel: 'Untangle tail ring fur & dust bamboo leaves',
    groomToolName: 'Soft Bristle Bamboo Card',
    feedVerb: 'Toss Fresh Bamboo Shoots',
  },
  golden_fox: {
    id: 'golden_fox',
    name: 'Golden Fox',
    exoticName: 'Celestial Star Fox',
    habitatTitle: 'Sunlit Meadow Burrow',
    description:
      'Cunning and graceful meadow runners whose amber fur glows warmly under autumn foliage.',
    favoriteTreat: 'fox_berry_treat',
    rareDrop: 'sun_crystal',
    costCoins: 520,
    exoticCostGems: 40,
    prestigeBase: 310,
    accentHex: '#E58A24',
    coatHex: '#C6681E',
    exoticCoatHex: '#FCD152',
    groomTaskLabel: 'Brush tail plume & clear autumn burrs',
    groomToolName: 'Silken Fox Brush',
    feedVerb: 'Offer Sweet Fox Berries',
  },
  snow_leopard: {
    id: 'snow_leopard',
    name: 'Snow Leopard',
    exoticName: 'Glacial Frost Leopard',
    habitatTitle: 'Highland Ridge Cliff',
    description:
      'Elusive majestic mountain cats draped in gorgeous rosettes, thriving along snowy alpine ledges.',
    favoriteTreat: 'ice_fish_treat',
    rareDrop: 'frost_pelt',
    costCoins: 680,
    exoticCostGems: 48,
    prestigeBase: 380,
    accentHex: '#8CA3BF',
    coatHex: '#A2B4C9',
    exoticCoatHex: '#EAF4FF',
    groomTaskLabel: 'Slick silver rosettes & brush frost ruff',
    groomToolName: 'Glacial Steel Slicker',
    feedVerb: 'Feed Glacial Pond Fish',
  },
  river_otter: {
    id: 'river_otter',
    name: 'River Otter',
    exoticName: 'Pearl River Otter',
    habitatTitle: 'Creekside Stone Bank',
    description:
      'Joyful splashing swimmers who juggle river pebbles and glide gleefully along mossy banks.',
    favoriteTreat: 'river_reed_treat',
    rareDrop: 'river_pearl',
    costCoins: 380,
    exoticCostGems: 30,
    prestigeBase: 240,
    accentHex: '#52788F',
    coatHex: '#6D5B4B',
    exoticCoatHex: '#9CC2D9',
    groomTaskLabel: 'Smooth wet whiskered coat & dry pelt',
    groomToolName: 'River Reed Towel',
    feedVerb: 'Toss Tender River Reeds',
  },
  tree_frog: {
    id: 'tree_frog',
    name: 'Emerald Tree Frog',
    exoticName: 'Sapphire Jewel Frog',
    habitatTitle: 'Lilypad Mist Terrarium',
    description:
      'Cheerful amphibious singers who bounce across floating lotus pads and nap in warm creek mist.',
    favoriteTreat: 'river_reed_treat',
    rareDrop: 'jade_lily_dew',
    costCoins: 290,
    exoticCostGems: 24,
    prestigeBase: 205,
    accentHex: '#3DA658',
    coatHex: '#48C45C',
    exoticCoatHex: '#2B9BF0',
    groomTaskLabel: 'Mist cool lotus dew & polish mossy stones',
    groomToolName: 'Lotus Dew Spritzer',
    feedVerb: 'Offer Pond Reeds',
  },
  chameleon: {
    id: 'chameleon',
    name: 'Sunleaf Chameleon',
    exoticName: 'Prism Rainbow Chameleon',
    habitatTitle: 'Tropical Vine Perch',
    description:
      'Curious color-shifting climbers with curly tails who perch among sunlit hibiscus vines.',
    favoriteTreat: 'nectar_treat',
    rareDrop: 'prism_scale',
    costCoins: 440,
    exoticCostGems: 34,
    prestigeBase: 270,
    accentHex: '#35A67A',
    coatHex: '#4EC76B',
    exoticCoatHex: '#C56BF0',
    groomTaskLabel: 'Mist warm canopy droplets & clear shed scales',
    groomToolName: 'Canopy Mist Atomizer',
    feedVerb: 'Offer Nectar Drops',
  },
  giant_tortoise: {
    id: 'giant_tortoise',
    name: 'Meadow Tortoise',
    exoticName: 'Golden Amber Tortoise',
    habitatTitle: 'Sun-Warmed Rockery',
    description:
      'Wise gentle shellbacks who bask peacefully on sun-heated boulders and nibble fragrant meadow herbs.',
    favoriteTreat: 'herb_treat',
    rareDrop: 'ancient_shell_amber',
    costCoins: 460,
    exoticCostGems: 35,
    prestigeBase: 285,
    accentHex: '#94673B',
    coatHex: '#7FA354',
    exoticCoatHex: '#E5B44A',
    groomTaskLabel: 'Buff shell scutes & rinse mossy rim',
    groomToolName: 'Beeswax Shell Buffer',
    feedVerb: 'Serve Alpine Herbs',
  },
  bearded_dragon: {
    id: 'bearded_dragon',
    name: 'Sunbeam Beardie',
    exoticName: 'Citrus Flame Dragon',
    habitatTitle: 'Sandstone Sun Oasis',
    description:
      'Friendly desert sunbathers who love perching on warm red-rock arches and munching sweet berries.',
    favoriteTreat: 'berry_treat',
    rareDrop: 'sunstone_scale',
    costCoins: 510,
    exoticCostGems: 38,
    prestigeBase: 305,
    accentHex: '#D97B34',
    coatHex: '#E0A158',
    exoticCoatHex: '#FF7840',
    groomTaskLabel: 'Brush warm sand & soothe chin ruff',
    groomToolName: 'Soft Sandstone Brush',
    feedVerb: 'Toss Sweet Berries',
  },
};

export interface CropDefinition {
  id: CropTypeId;
  name: string;
  yieldResource: ResourceId;
  yieldAmount: number;
  costCoins: number;
  growDurationMs: number; // 10 minutes = 600,000 ms
  xpReward: number;
  bestFor: SpeciesId;
  colorHex: string;
}

export const CROP_CATALOG: Record<CropTypeId, CropDefinition> = {
  berry: {
    id: 'berry',
    name: 'Wild Berry Bush',
    yieldResource: 'berry_treat',
    yieldAmount: 3,
    costCoins: 25,
    growDurationMs: 600000,
    xpReward: 35,
    bestFor: 'raccoon',
    colorHex: '#B63E5B',
  },
  mango: {
    id: 'mango',
    name: 'Golden Mango Tree',
    yieldResource: 'mango_treat',
    yieldAmount: 3,
    costCoins: 45,
    growDurationMs: 600000,
    xpReward: 45,
    bestFor: 'gorilla',
    colorHex: '#E59A24',
  },
  lavender: {
    id: 'lavender',
    name: 'Lavender Nectar Bed',
    yieldResource: 'nectar_treat',
    yieldAmount: 3,
    costCoins: 35,
    growDurationMs: 600000,
    xpReward: 40,
    bestFor: 'butterfly',
    colorHex: '#8465C8',
  },
  herb: {
    id: 'herb',
    name: 'Alpine Herb Patch',
    yieldResource: 'herb_treat',
    yieldAmount: 3,
    costCoins: 55,
    growDurationMs: 600000,
    xpReward: 50,
    bestFor: 'wolf',
    colorHex: '#3B8A72',
  },
  bamboo_shoot: {
    id: 'bamboo_shoot',
    name: 'Bamboo Shoot Bed',
    yieldResource: 'bamboo_shoot_treat',
    yieldAmount: 3,
    costCoins: 60,
    growDurationMs: 600000,
    xpReward: 55,
    bestFor: 'red_panda',
    colorHex: '#589E46',
  },
  fox_berry: {
    id: 'fox_berry',
    name: 'Amber Fox Berry',
    yieldResource: 'fox_berry_treat',
    yieldAmount: 3,
    costCoins: 65,
    growDurationMs: 600000,
    xpReward: 58,
    bestFor: 'golden_fox',
    colorHex: '#D9772B',
  },
  ice_fish: {
    id: 'ice_fish',
    name: 'Glacial Pond Reed',
    yieldResource: 'ice_fish_treat',
    yieldAmount: 3,
    costCoins: 75,
    growDurationMs: 600000,
    xpReward: 65,
    bestFor: 'snow_leopard',
    colorHex: '#5A96C8',
  },
  river_reed: {
    id: 'river_reed',
    name: 'Creekside Reeds',
    yieldResource: 'river_reed_treat',
    yieldAmount: 3,
    costCoins: 50,
    growDurationMs: 600000,
    xpReward: 48,
    bestFor: 'river_otter',
    colorHex: '#4A7C6B',
  },
};

export interface DecorDefinition {
  id: DecorTypeId;
  name: string;
  category: 'foliage' | 'water' | 'cozy' | 'seasonal';
  costCoins: number;
  costGems: number;
  prestigeBonus: number;
  footprint?: 1 | 2;
  description: string;
  accentHex: string;
}

export function getDecorFootprint(decorType: DecorTypeId): 1 | 2 {
  return DECOR_CATALOG[decorType]?.footprint ?? 1;
}

export const DECOR_CATALOG: Record<DecorTypeId, DecorDefinition> = {
  willow: {
    id: 'willow',
    name: 'Weeping Willow',
    category: 'foliage',
    costCoins: 75,
    costGems: 0,
    prestigeBonus: 35,
    description: 'Graceful trailing meadow boughs that shade nearby animals.',
    accentHex: '#5B8C4A',
  },
  autumn_maple: {
    id: 'autumn_maple',
    name: 'Autumn Maple',
    category: 'seasonal',
    costCoins: 110,
    costGems: 0,
    prestigeBonus: 55,
    description: 'Crimson-amber harvest foliage glowing in golden sunlight.',
    accentHex: '#C9522B',
  },
  bamboo: {
    id: 'bamboo',
    name: 'Emerald Bamboo',
    category: 'foliage',
    costCoins: 65,
    costGems: 0,
    prestigeBonus: 30,
    description: 'Swaying green stalks prized by highland gorillas.',
    accentHex: '#4E9A4E',
  },
  koi_pond: {
    id: 'koi_pond',
    name: 'Tranquil Koi Pond',
    category: 'water',
    costCoins: 150,
    costGems: 0,
    prestigeBonus: 70,
    description: 'Stone-rimmed pond with shimmering water and lily pads.',
    accentHex: '#3A8FB7',
  },
  fountain: {
    id: 'fountain',
    name: 'Carved Stone Fountain',
    category: 'water',
    costCoins: 220,
    costGems: 0,
    prestigeBonus: 95,
    description: 'Tiered meadow limestone fountain with gentle mist.',
    accentHex: '#7A9AA8',
  },
  lantern_post: {
    id: 'lantern_post',
    name: 'Harvest Paper Lantern',
    category: 'seasonal',
    costCoins: 90,
    costGems: 0,
    prestigeBonus: 60,
    description: 'Warm glowing cedar lantern celebrating the Autumn Festival.',
    accentHex: '#E0922F',
  },
  flower_arch: {
    id: 'flower_arch',
    name: 'Blossom Arbor Arch',
    category: 'cozy',
    costCoins: 130,
    costGems: 0,
    prestigeBonus: 65,
    description: 'Timber garden arch woven with climbing roses and nectar vines.',
    accentHex: '#D16D88',
  },
  gazebo: {
    id: 'gazebo',
    name: 'Keeper Tea Gazebo',
    category: 'cozy',
    costCoins: 260,
    costGems: 4,
    prestigeBonus: 140,
    description: 'Octagonal timber pavilion where visiting friends gather.',
    accentHex: '#9C6644',
  },
  cobble_path: {
    id: 'cobble_path',
    name: 'Cobblestone Stepping',
    category: 'cozy',
    costCoins: 20,
    costGems: 0,
    prestigeBonus: 12,
    description: 'Warm hand-laid stones linking sanctuary trails.',
    accentHex: '#9E978B',
  },
  hay_cart: {
    id: 'hay_cart',
    name: 'Meadow Harvest Cart',
    category: 'cozy',
    costCoins: 95,
    costGems: 0,
    prestigeBonus: 45,
    description: 'Rustic wooden farm cart stacked with golden bales.',
    accentHex: '#C79642',
  },
  keeper_cottage: {
    id: 'keeper_cottage',
    name: 'Cozy Keeper Cottage',
    category: 'cozy',
    costCoins: 380,
    costGems: 0,
    prestigeBonus: 165,
    description: 'Storybook cream-and-terracotta keeper lodge with glowing windows and hearth smoke.',
    accentHex: '#D46646',
  },
  windmill: {
    id: 'windmill',
    name: 'Meadow Windmill',
    category: 'cozy',
    costCoins: 340,
    costGems: 0,
    prestigeBonus: 150,
    description: 'Charming timber-and-stone windmill with gently turning canvas sails.',
    accentHex: '#C48A47',
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Botanical Glasshouse',
    category: 'foliage',
    costCoins: 320,
    costGems: 4,
    prestigeBonus: 175,
    description: 'Sunlit glass conservatory filled with tropical ferns and blooming blossoms.',
    accentHex: '#52A878',
  },
  wooden_bridge_arch: {
    id: 'wooden_bridge_arch',
    name: 'Garden Moon Bridge',
    category: 'water',
    costCoins: 180,
    costGems: 0,
    prestigeBonus: 85,
    description: 'Arched cedar footbridge spanning a sparkling turquoise stepping creek.',
    accentHex: '#B8643E',
  },
  wishing_well: {
    id: 'wishing_well',
    name: 'Stone Wishing Well',
    category: 'water',
    costCoins: 160,
    costGems: 0,
    prestigeBonus: 80,
    description: 'Mossy pebble wishing well with a cedar shingle roof and hanging bucket.',
    accentHex: '#6E95A8',
  },
  campfire_lounge: {
    id: 'campfire_lounge',
    name: 'Campfire Rest Nook',
    category: 'seasonal',
    costCoins: 145,
    costGems: 0,
    prestigeBonus: 75,
    description: 'Glowing stone hearth with flickering cartoon flames and cozy log benches.',
    accentHex: '#E87E2A',
  },
  circus_tent: {
    id: 'circus_tent',
    name: 'Wildgrove Circus Tent',
    category: 'cozy',
    costCoins: 5000,
    costGems: 0,
    prestigeBonus: 320,
    footprint: 2,
    description:
      '4-square (2×2) carnival big-top! Tap anytime to play 6 meadow mini-games for Coins, XP & rare treats.',
    accentHex: '#D93B44',
  },
};

export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  rarity: 'common' | 'rare' | 'exotic';
  baseCoinValue: number;
  description: string;
}

export const RESOURCE_CATALOG: Record<ResourceId, ResourceDefinition> = {
  berry_treat: {
    id: 'berry_treat',
    name: 'Wild Berries',
    rarity: 'common',
    baseCoinValue: 18,
    description: 'Crisp forest berries loved by Bandit Raccoons.',
  },
  mango_treat: {
    id: 'mango_treat',
    name: 'Golden Mangoes',
    rarity: 'common',
    baseCoinValue: 28,
    description: 'Juicy canopy fruit loved by Highland Gorillas.',
  },
  nectar_treat: {
    id: 'nectar_treat',
    name: 'Lavender Nectar',
    rarity: 'common',
    baseCoinValue: 22,
    description: 'Fragrant blossoms cherished by Conservatory Butterflies.',
  },
  herb_treat: {
    id: 'herb_treat',
    name: 'Alpine Herbs',
    rarity: 'common',
    baseCoinValue: 32,
    description: 'Savory mountain botanicals loved by Timber Wolves.',
  },
  bamboo_shoot_treat: {
    id: 'bamboo_shoot_treat',
    name: 'Bamboo Shoots',
    rarity: 'common',
    baseCoinValue: 30,
    description: 'Tender crisp bamboo favorite of Red Pandas.',
  },
  fox_berry_treat: {
    id: 'fox_berry_treat',
    name: 'Amber Fox Berries',
    rarity: 'common',
    baseCoinValue: 34,
    description: 'Sweet luminous meadow berries loved by Golden Foxes.',
  },
  ice_fish_treat: {
    id: 'ice_fish_treat',
    name: 'Glacial Pond Fish',
    rarity: 'common',
    baseCoinValue: 40,
    description: 'Fresh shimmering pond catch prized by Snow Leopards.',
  },
  river_reed_treat: {
    id: 'river_reed_treat',
    name: 'Creekside Reeds',
    rarity: 'common',
    baseCoinValue: 26,
    description: 'Tender marsh shoots loved by River Otters.',
  },
  lucky_acorn: {
    id: 'lucky_acorn',
    name: 'Lucky Golden Acorn',
    rarity: 'rare',
    baseCoinValue: 85,
    description: 'A polished keepsake gifted by delighted Raccoons.',
  },
  silverback_amber: {
    id: 'silverback_amber',
    name: 'Canopy Amber Resin',
    rarity: 'rare',
    baseCoinValue: 115,
    description: 'Sunlit tree amber uncovered by contented Gorillas.',
  },
  wing_dust: {
    id: 'wing_dust',
    name: 'Iridescent Wing Shimmer',
    rarity: 'exotic',
    baseCoinValue: 135,
    description: 'Prismatic conservatory shimmer shed during happy flights.',
  },
  moonstone_pelt: {
    id: 'moonstone_pelt',
    name: 'Moonlit Ridge Charm',
    rarity: 'exotic',
    baseCoinValue: 155,
    description: 'Silvery pine-scented charm shared by bonded Wolves.',
  },
  lantern_charm: {
    id: 'lantern_charm',
    name: 'Autumn Lantern Charm',
    rarity: 'exotic',
    baseCoinValue: 120,
    description: 'Seasonal harvest token earned during the Moonlit Harvest Festival.',
  },
  fire_tail_charm: {
    id: 'fire_tail_charm',
    name: 'Fire Tail Keepsake',
    rarity: 'rare',
    baseCoinValue: 125,
    description: 'Warm fluffy keepsake gifted by joyous Red Pandas.',
  },
  sun_crystal: {
    id: 'sun_crystal',
    name: 'Solar Fox Crystal',
    rarity: 'rare',
    baseCoinValue: 140,
    description: 'Gleaming crystal shard uncovered by Golden Foxes.',
  },
  frost_pelt: {
    id: 'frost_pelt',
    name: 'Glacial Rosette Charm',
    rarity: 'exotic',
    baseCoinValue: 180,
    description: 'Icy patterned amulet left by Snow Leopards.',
  },
  river_pearl: {
    id: 'river_pearl',
    name: 'Creekside River Pearl',
    rarity: 'rare',
    baseCoinValue: 110,
    description: 'Lustrous polished pearl juggled by River Otters.',
  },
  jade_lily_dew: {
    id: 'jade_lily_dew',
    name: 'Jade Lily Dewdrop',
    rarity: 'rare',
    baseCoinValue: 105,
    description: 'Sparkling emerald dew crystal gifted by singing Tree Frogs.',
  },
  prism_scale: {
    id: 'prism_scale',
    name: 'Prismatic Scale Charm',
    rarity: 'exotic',
    baseCoinValue: 145,
    description: 'Color-shifting iridescent charm shed by happy Chameleons.',
  },
  ancient_shell_amber: {
    id: 'ancient_shell_amber',
    name: 'Ancient Shell Relic',
    rarity: 'rare',
    baseCoinValue: 150,
    description: 'Warm polished amber stone treasured by Meadow Tortoises.',
  },
  sunstone_scale: {
    id: 'sunstone_scale',
    name: 'Sunstone Crest Gem',
    rarity: 'exotic',
    baseCoinValue: 165,
    description: 'Radiant desert quartz warmed by lounging Sunbeam Beardies.',
  },
  gourmet_treat: {
    id: 'gourmet_treat',
    name: 'Gourmet Meadow Tart',
    rarity: 'exotic',
    baseCoinValue: 190,
    description: 'Hand-crafted delicacy that guarantees +1 Bond Level and 2× Coins when served!',
  },
  sunbeam_fertilizer: {
    id: 'sunbeam_fertilizer',
    name: 'Sunbeam Compost',
    rarity: 'rare',
    baseCoinValue: 75,
    description: 'Halves a crop plot grow time (to 5:00) and doubles its next harvest yield.',
  },
  meadow_sprinkler: {
    id: 'meadow_sprinkler',
    name: 'Dewdrop Bloom Elixir',
    rarity: 'exotic',
    baseCoinValue: 115,
    description: 'Instantly matures any growing crop plot for immediate harvesting.',
  },
};

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  outputResource: ResourceId;
  outputQty: number;
  ingredients: Array<{ resourceId: ResourceId; qty: number }>;
  coinCost: number;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  {
    id: 'craft-berry-tart',
    name: 'Gourmet Berry Tart',
    description: 'Guarantees +1 Bond Level & +120 Coins when fed to any animal.',
    outputResource: 'gourmet_treat',
    outputQty: 1,
    ingredients: [
      { resourceId: 'berry_treat', qty: 2 },
      { resourceId: 'lucky_acorn', qty: 1 },
    ],
    coinCost: 40,
  },
  {
    id: 'craft-canopy-feast',
    name: 'Golden Canopy Feast',
    description: 'Bakes 2 Gourmet Meadow Tarts from mangoes and amber resin.',
    outputResource: 'gourmet_treat',
    outputQty: 2,
    ingredients: [
      { resourceId: 'mango_treat', qty: 2 },
      { resourceId: 'silverback_amber', qty: 1 },
    ],
    coinCost: 65,
  },
  {
    id: 'craft-fertilizer',
    name: 'Sunbeam Compost (×2)',
    description: 'Cuts a crop timer by 50% and doubles its harvest yield.',
    outputResource: 'sunbeam_fertilizer',
    outputQty: 2,
    ingredients: [
      { resourceId: 'herb_treat', qty: 1 },
      { resourceId: 'nectar_treat', qty: 1 },
    ],
    coinCost: 30,
  },
  {
    id: 'craft-sprinkler',
    name: 'Dewdrop Bloom Elixir',
    description: 'Instantly ripens any planted crop plot to 100% ready.',
    outputResource: 'meadow_sprinkler',
    outputQty: 1,
    ingredients: [
      { resourceId: 'river_reed_treat', qty: 1 },
      { resourceId: 'river_pearl', qty: 1 },
    ],
    coinCost: 45,
  },
];

export const HYBRID_TRAIT_NAMES = [
  'Sunlit Meadowborn',
  'Starlight Cub',
  'Blossom Spirit',
  'Golden Dawn',
  'Moonbeam Kin',
  'Emerald Whisper',
];

export interface DailyRewardTier {
  day: number;
  label: string;
  coins: number;
  gems: number;
  resource?: { id: ResourceId; qty: number };
}

export const DAILY_REWARDS: DailyRewardTier[] = [
  { day: 1, label: 'Welcome Basket', coins: 120, gems: 2, resource: { id: 'berry_treat', qty: 4 } },
  { day: 2, label: 'Canopy Treats', coins: 160, gems: 3, resource: { id: 'mango_treat', qty: 4 } },
  { day: 3, label: 'Nectar Dewdrops', coins: 200, gems: 4, resource: { id: 'nectar_treat', qty: 5 } },
  { day: 4, label: 'Festival Lanterns', coins: 240, gems: 5, resource: { id: 'lantern_charm', qty: 2 } },
  { day: 5, label: 'Rare Keepers Pouch', coins: 300, gems: 6, resource: { id: 'lucky_acorn', qty: 2 } },
  { day: 6, label: 'Prismatic Shimmer', coins: 380, gems: 8, resource: { id: 'wing_dust', qty: 2 } },
  { day: 7, label: 'Grand Sanctuary Chest', coins: 600, gems: 15, resource: { id: 'frost_pelt', qty: 2 } },
];

export interface SeasonalMilestone {
  id: string;
  pointsRequired: number;
  title: string;
  rewardCoins: number;
  rewardGems: number;
  rewardDecor?: DecorTypeId;
}

export const SEASONAL_EVENT_INFO = {
  id: 'autumn-lantern-harvest-2026',
  title: 'Moonlit Harvest Festival',
  subtitle: 'Feed, groom, and harvest to earn Lantern Points and unlock seasonal glowing decor.',
  endsLabel: 'Ends Dec 15',
  milestones: [
    {
      id: 'm1',
      pointsRequired: 50,
      title: 'Lantern Lighter',
      rewardCoins: 180,
      rewardGems: 4,
    },
    {
      id: 'm2',
      pointsRequired: 150,
      title: 'Maple Grove Keeper',
      rewardCoins: 320,
      rewardGems: 8,
      rewardDecor: 'autumn_maple' as DecorTypeId,
    },
    {
      id: 'm3',
      pointsRequired: 320,
      title: 'Moonlit Sanctuary Legend',
      rewardCoins: 650,
      rewardGems: 18,
      rewardDecor: 'lantern_post' as DecorTypeId,
    },
  ] as SeasonalMilestone[],
};

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rewardGems: number;
  check: (s: SanctuaryState) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'four_species',
    title: 'Harmony of Four',
    description: 'Shelter 4 different animal species in your sanctuary.',
    rewardGems: 12,
    check: (s) => {
      const set = new Set(s.enclosures.map((e) => e.species));
      return set.size >= 4;
    },
  },
  {
    id: 'eight_species',
    title: 'Grand Menagerie',
    description: 'Shelter all 8 animal species in your sanctuary.',
    rewardGems: 25,
    check: (s) => {
      const set = new Set(s.enclosures.map((e) => e.species));
      return set.size >= 8;
    },
  },
  {
    id: 'exotic_collector',
    title: 'Rare Morph Guardian',
    description: 'Adopt or evolve an Exotic Variant species.',
    rewardGems: 10,
    check: (s) => s.enclosures.some((e) => e.variant === 'exotic'),
  },
  {
    id: 'master_caretaker',
    title: 'Gentle Hands',
    description: 'Complete 5 feeding or grooming care sessions.',
    rewardGems: 8,
    check: (s) => s.stats.totalFeeds + s.stats.totalGrooms >= 5,
  },
  {
    id: 'social_butterfly',
    title: 'Friendly Neighbor',
    description: 'Visit a fellow keeper sanctuary and leave a Care Gift.',
    rewardGems: 6,
    check: (s) => s.stats.friendsVisited >= 1,
  },
  {
    id: 'grand_landscape',
    title: 'Botanical Architect',
    description: 'Place at least 8 habitat decorations across your meadow.',
    rewardGems: 10,
    check: (s) => s.decorations.length >= 8,
  },
  {
    id: 'reptile_guardian',
    title: 'Terrarium Keeper',
    description: 'Adopt a Frog, Chameleon, Tortoise, or Bearded Dragon into your sanctuary.',
    rewardGems: 15,
    check: (s) =>
      s.enclosures.some((e) =>
        ['tree_frog', 'chameleon', 'giant_tortoise', 'bearded_dragon'].includes(e.species),
      ),
  },
];

export function xpRequiredForLevel(level: number): number {
  return Math.round(120 + (level - 1) * 85 + Math.pow(level - 1, 1.35) * 28);
}

export function computePrestige(state: SanctuaryState): number {
  let score = state.level * 50;
  const speciesSeen = new Set<SpeciesId>();
  const decorations = state.decorations || [];
  for (const enc of state.enclosures) {
    const def = SPECIES_CATALOG[enc.species];
    speciesSeen.add(enc.species);
    score += def.prestigeBase;
    if (enc.variant === 'exotic') score += 160;
    if (enc.isBaby) score += 120;
    score += computeEnclosureSynergy(enc, decorations).bonusPrestige;
    score += Math.round(enc.bondLevel * 35 + enc.happiness * 0.8 + enc.visitorHearts * 12);
  }
  // Species diversity bonus
  score += speciesSeen.size * 65;
  for (const dec of decorations) {
    score += DECOR_CATALOG[dec.decorType]?.prestigeBonus ?? 20;
  }
  score += state.crops.length * 14;
  return Math.round(score);
}

export function generateSyncCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `GROVE-${suffix}`;
}

export function createStarterSanctuary(
  keeperName = 'Meadow Keeper',
  sanctuaryName = 'Sunlit Wildgrove',
  syncCode = generateSyncCode(),
): SanctuaryState {
  const now = Date.now();
  const base: SanctuaryState = {
    syncCode,
    keeperName,
    sanctuaryName,
    avatarSpecies: 'raccoon',
    level: 1,
    xp: 25,
    coins: 750,
    gems: 35,
    prestige: 0,
    gridSize: DEFAULT_GRID_SIZE,
    enclosures: [
      {
        id: 'enc-starter-raccoon',
        species: 'raccoon',
        name: 'Pippin',
        variant: 'classic',
        gridX: 2,
        gridZ: 2,
        happiness: 78,
        hunger: 68,
        grooming: 62,
        bondLevel: 2,
        lastFedAt: now - 120000,
        lastGroomedAt: now - 180000,
        visitorHearts: 2,
        adoptedAt: now - 720000,
        timesFed: 2,
        timesGroomed: 1,
        bondHistory: [
          { level: 1, reachedAt: now - 720000, source: 'adopted' },
          { level: 2, reachedAt: now - 120000, source: 'feed' },
        ],
      },
      {
        id: 'enc-starter-butterfly',
        species: 'butterfly',
        name: 'Aurelia',
        variant: 'classic',
        gridX: 7,
        gridZ: 2,
        happiness: 84,
        hunger: 74,
        grooming: 70,
        bondLevel: 2,
        lastFedAt: now - 90000,
        lastGroomedAt: now - 140000,
        visitorHearts: 3,
        adoptedAt: now - 660000,
        timesFed: 2,
        timesGroomed: 2,
        bondHistory: [
          { level: 1, reachedAt: now - 660000, source: 'adopted' },
          { level: 2, reachedAt: now - 140000, source: 'groom' },
        ],
      },
      {
        id: 'enc-starter-redpanda',
        species: 'red_panda',
        name: 'Rusty',
        variant: 'classic',
        gridX: 2,
        gridZ: 7,
        happiness: 82,
        hunger: 72,
        grooming: 68,
        bondLevel: 2,
        lastFedAt: now - 100000,
        lastGroomedAt: now - 150000,
        visitorHearts: 2,
        adoptedAt: now - 600000,
        timesFed: 1,
        timesGroomed: 2,
        bondHistory: [
          { level: 1, reachedAt: now - 600000, source: 'adopted' },
          { level: 2, reachedAt: now - 100000, source: 'feed' },
        ],
      },
      {
        id: 'enc-starter-wolf',
        species: 'wolf',
        name: 'Koda',
        variant: 'classic',
        gridX: 7,
        gridZ: 7,
        happiness: 80,
        hunger: 70,
        grooming: 60,
        bondLevel: 1,
        lastFedAt: now - 110000,
        lastGroomedAt: now - 170000,
        visitorHearts: 2,
        adoptedAt: now - 480000,
        timesFed: 1,
        timesGroomed: 1,
        bondHistory: [{ level: 1, reachedAt: now - 480000, source: 'adopted' }],
      },
    ],
    crops: [
      {
        id: 'crop-starter-1',
        cropType: 'berry',
        gridX: 5,
        gridZ: 4,
        plantedAt: now - 650000, // Ready to harvest right away!
        growDurationMs: CROP_CATALOG.berry.growDurationMs,
      },
      {
        id: 'crop-starter-2',
        cropType: 'bamboo_shoot',
        gridX: 6,
        gridZ: 4,
        plantedAt: now - 650000, // Ready to harvest right away!
        growDurationMs: CROP_CATALOG.bamboo_shoot.growDurationMs,
      },
      {
        id: 'crop-starter-3',
        cropType: 'mango',
        gridX: 5,
        gridZ: 5,
        plantedAt: now - 100000,
        growDurationMs: CROP_CATALOG.mango.growDurationMs,
      },
    ],
    decorations: [
      { id: 'dec-s1', decorType: 'koi_pond', gridX: 5, gridZ: 2, rotation: 0 },
      { id: 'dec-s2', decorType: 'autumn_maple', gridX: 1, gridZ: 5, rotation: 1 },
      { id: 'dec-s3', decorType: 'lantern_post', gridX: 4, gridZ: 4, rotation: 0 },
      { id: 'dec-s4', decorType: 'lantern_post', gridX: 7, gridZ: 5, rotation: 2 },
      { id: 'dec-s5', decorType: 'flower_arch', gridX: 5, gridZ: 7, rotation: 0 },
      { id: 'dec-s6', decorType: 'willow', gridX: 10, gridZ: 5, rotation: 0 },
      { id: 'dec-s7', decorType: 'cobble_path', gridX: 5, gridZ: 6, rotation: 0 },
      { id: 'dec-s8', decorType: 'cobble_path', gridX: 6, gridZ: 6, rotation: 0 },
    ],
    inventory: {
      berry_treat: 6,
      mango_treat: 4,
      nectar_treat: 5,
      herb_treat: 4,
      bamboo_shoot_treat: 6,
      fox_berry_treat: 4,
      ice_fish_treat: 4,
      river_reed_treat: 4,
      lucky_acorn: 3,
      silverback_amber: 1,
      wing_dust: 1,
      moonstone_pelt: 1,
      lantern_charm: 2,
      fire_tail_charm: 2,
      sun_crystal: 1,
      frost_pelt: 1,
      river_pearl: 2,
      jade_lily_dew: 0,
      prism_scale: 0,
      ancient_shell_amber: 0,
      sunstone_scale: 0,
      gourmet_treat: 1,
      sunbeam_fertilizer: 2,
      meadow_sprinkler: 1,
    },
    storageCrate: [],
    dailyReward: {
      streak: 0,
      lastClaimDate: null,
    },
    dailyQuests: generateDailyQuests(),
    dailyForaging: { date: todayDateString(), foundIds: [] },
    seasonalEvent: {
      eventId: SEASONAL_EVENT_INFO.id,
      lanternPoints: 35,
      claimedMilestones: [],
    },
    unlockedAchievements: [],
    savedFriends: [],
    guestbook: [],
    blueprints: [],
    lastIdleCollectedAt: now,
    stats: {
      totalFeeds: 0,
      totalGrooms: 0,
      totalHarvests: 0,
      totalTrades: 0,
      friendsVisited: 0,
    },
    updatedAt: now,
  };
  base.prestige = computePrestige(base);
  return base;
}

export function isCellOccupied(
  state: SanctuaryState,
  gx: number,
  gz: number,
  footprintSize: 1 | 2,
  ignoreItem?: EditableItemRef | null,
): boolean {
  const gridSize = state.gridSize === 24 ? 24 : state.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
  if (gx < 0 || gz < 0 || gx + footprintSize > gridSize || gz + footprintSize > gridSize) {
    return true;
  }
  const cells = new Set<string>();
  for (const e of state.enclosures) {
    if (ignoreItem?.kind === 'enclosure' && ignoreItem.id === e.id) continue;
    cells.add(`${e.gridX},${e.gridZ}`);
    cells.add(`${e.gridX + 1},${e.gridZ}`);
    cells.add(`${e.gridX},${e.gridZ + 1}`);
    cells.add(`${e.gridX + 1},${e.gridZ + 1}`);
  }
  for (const c of state.crops) {
    if (ignoreItem?.kind === 'crop' && ignoreItem.id === c.id) continue;
    cells.add(`${c.gridX},${c.gridZ}`);
  }
  for (const d of state.decorations) {
    if (ignoreItem?.kind === 'decor' && ignoreItem.id === d.id) continue;
    const fp = getDecorFootprint(d.decorType);
    for (let dx = 0; dx < fp; dx++) {
      for (let dz = 0; dz < fp; dz++) {
        cells.add(`${d.gridX + dx},${d.gridZ + dz}`);
      }
    }
  }
  for (let dx = 0; dx < footprintSize; dx++) {
    for (let dz = 0; dz < footprintSize; dz++) {
      if (cells.has(`${gx + dx},${gz + dz}`)) return true;
    }
  }
  return false;
}
