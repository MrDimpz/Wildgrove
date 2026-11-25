export type SpeciesId =
  | 'raccoon'
  | 'gorilla'
  | 'butterfly'
  | 'wolf'
  | 'red_panda'
  | 'golden_fox'
  | 'snow_leopard'
  | 'river_otter';

export type AnimalVariant = 'classic' | 'exotic';

export type CropTypeId = 'berry' | 'mango' | 'lavender' | 'herb' | 'bamboo_shoot' | 'fox_berry' | 'ice_fish' | 'river_reed';

export type DecorTypeId =
  | 'willow'
  | 'autumn_maple'
  | 'bamboo'
  | 'koi_pond'
  | 'fountain'
  | 'lantern_post'
  | 'flower_arch'
  | 'gazebo'
  | 'cobble_path'
  | 'hay_cart';

export type ResourceId =
  | 'berry_treat'
  | 'mango_treat'
  | 'nectar_treat'
  | 'herb_treat'
  | 'bamboo_shoot_treat'
  | 'fox_berry_treat'
  | 'ice_fish_treat'
  | 'river_reed_treat'
  | 'lucky_acorn'
  | 'silverback_amber'
  | 'wing_dust'
  | 'moonstone_pelt'
  | 'lantern_charm'
  | 'fire_tail_charm'
  | 'sun_crystal'
  | 'frost_pelt'
  | 'river_pearl';

export interface EnclosureItem {
  id: string;
  species: SpeciesId;
  name: string;
  variant: AnimalVariant;
  gridX: number; // 0..10 (2x2 footprint: [gridX..gridX+1, gridZ..gridZ+1])
  gridZ: number;
  happiness: number; // 0..100
  hunger: number; // 0..100 (100 = full)
  grooming: number; // 0..100 (100 = gleaming)
  bondLevel: number; // 1..10
  lastFedAt: number;
  lastGroomedAt: number;
  visitorHearts: number;
}

export interface CropPlotItem {
  id: string;
  cropType: CropTypeId;
  gridX: number; // 0..11
  gridZ: number; // 0..11
  plantedAt: number;
  growDurationMs: number;
}

export interface DecorationItem {
  id: string;
  decorType: DecorTypeId;
  gridX: number; // 0..11
  gridZ: number; // 0..11
  rotation: number; // 0..3 (multiples of 90 deg)
}

export interface DailyRewardState {
  streak: number; // 0..7
  lastClaimDate: string | null; // YYYY-MM-DD
}

export interface SeasonalEventState {
  eventId: string;
  lanternPoints: number;
  claimedMilestones: string[];
}

export interface SanctuaryState {
  syncCode: string;
  keeperName: string;
  sanctuaryName: string;
  avatarSpecies: SpeciesId;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  prestige: number;
  enclosures: EnclosureItem[];
  crops: CropPlotItem[];
  decorations: DecorationItem[];
  inventory: Record<ResourceId, number>;
  dailyReward: DailyRewardState;
  seasonalEvent: SeasonalEventState;
  unlockedAchievements: string[];
  stats: {
    totalFeeds: number;
    totalGrooms: number;
    totalHarvests: number;
    totalTrades: number;
    friendsVisited: number;
  };
  updatedAt: number;
}

export interface MarketplaceListing {
  id: string;
  sellerCode: string;
  sellerName: string;
  itemType: 'resource' | 'decor' | 'exotic_license';
  itemId: string;
  itemLabel: string;
  quantity: number;
  priceCoins: number;
  priceGems: number;
  rarity: 'common' | 'rare' | 'exotic';
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  senderCode: string;
  senderName: string;
  avatarSpecies: SpeciesId;
  text: string;
  tag?: 'general' | 'trade' | 'visit' | 'milestone';
  timestamp: number;
}

export interface CommunitySanctuarySummary {
  syncCode: string;
  keeperName: string;
  sanctuaryName: string;
  avatarSpecies: SpeciesId;
  level: number;
  prestige: number;
  animalCount: number;
  decorCount: number;
  updatedAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  syncCode: string;
  keeperName: string;
  sanctuaryName: string;
  avatarSpecies: SpeciesId;
  level: number;
  prestige: number;
  exoticCount: number;
  animalCount: number;
}

export type PlacementChoice =
  | { kind: 'enclosure'; species: SpeciesId; variant: AnimalVariant }
  | { kind: 'crop'; cropType: CropTypeId }
  | { kind: 'decor'; decorType: DecorTypeId };

export type ActiveDrawer =
  | null
  | 'build'
  | 'crops'
  | 'market'
  | 'friends'
  | 'leaderboard'
  | 'events'
  | 'chat'
  | 'sync'
  | 'share'
  | 'manual';

export interface FloatingFeedback {
  id: string;
  text: string;
  tone: 'gold' | 'emerald' | 'rose' | 'sky';
}
