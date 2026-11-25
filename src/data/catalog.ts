import type {
  CropTypeId,
  DecorTypeId,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from '../types/game';

export const GRID_SIZE = 12;

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
  description: string;
  accentHex: string;
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
};

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
];

export function xpRequiredForLevel(level: number): number {
  return Math.round(120 + (level - 1) * 85 + Math.pow(level - 1, 1.35) * 28);
}

export function computePrestige(state: SanctuaryState): number {
  let score = state.level * 50;
  const speciesSeen = new Set<SpeciesId>();
  for (const enc of state.enclosures) {
    const def = SPECIES_CATALOG[enc.species];
    speciesSeen.add(enc.species);
    score += def.prestigeBase;
    if (enc.variant === 'exotic') score += 160;
    score += Math.round(enc.bondLevel * 35 + enc.happiness * 0.8 + enc.visitorHearts * 12);
  }
  // Species diversity bonus
  score += speciesSeen.size * 65;
  for (const dec of state.decorations) {
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
    },
    dailyReward: {
      streak: 0,
      lastClaimDate: null,
    },
    seasonalEvent: {
      eventId: SEASONAL_EVENT_INFO.id,
      lanternPoints: 35,
      claimedMilestones: [],
    },
    unlockedAchievements: [],
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
): boolean {
  if (gx < 0 || gz < 0 || gx + footprintSize > GRID_SIZE || gz + footprintSize > GRID_SIZE) {
    return true;
  }
  const cells = new Set<string>();
  for (const e of state.enclosures) {
    cells.add(`${e.gridX},${e.gridZ}`);
    cells.add(`${e.gridX + 1},${e.gridZ}`);
    cells.add(`${e.gridX},${e.gridZ + 1}`);
    cells.add(`${e.gridX + 1},${e.gridZ + 1}`);
  }
  for (const c of state.crops) {
    cells.add(`${c.gridX},${c.gridZ}`);
  }
  for (const d of state.decorations) {
    cells.add(`${d.gridX},${d.gridZ}`);
  }
  for (let dx = 0; dx < footprintSize; dx++) {
    for (let dz = 0; dz < footprintSize; dz++) {
      if (cells.has(`${gx + dx},${gz + dz}`)) return true;
    }
  }
  return false;
}
