export type SpeciesId =
  | 'raccoon'
  | 'gorilla'
  | 'butterfly'
  | 'wolf'
  | 'red_panda'
  | 'golden_fox'
  | 'snow_leopard'
  | 'river_otter'
  | 'tree_frog'
  | 'chameleon'
  | 'giant_tortoise'
  | 'bearded_dragon';

export type AnimalVariant = 'classic' | 'exotic';

export type CropTypeId =
  | 'berry'
  | 'mango'
  | 'lavender'
  | 'herb'
  | 'bamboo_shoot'
  | 'fox_berry'
  | 'ice_fish'
  | 'river_reed';

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
  | 'hay_cart'
  | 'keeper_cottage'
  | 'windmill'
  | 'greenhouse'
  | 'wooden_bridge_arch'
  | 'wishing_well'
  | 'campfire_lounge'
  | 'circus_tent';

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
  | 'river_pearl'
  | 'jade_lily_dew'
  | 'prism_scale'
  | 'ancient_shell_amber'
  | 'sunstone_scale'
  | 'gourmet_treat'
  | 'sunbeam_fertilizer'
  | 'meadow_sprinkler';

export type TimeOfDayId = 'day' | 'sunset' | 'night';

export type BondMilestoneSource = 'adopted' | 'feed' | 'groom' | 'exotic' | 'gourmet' | 'bred';

export interface BondHistoryEntry {
  level: number; // 1..10
  reachedAt: number; // epoch ms
  source: BondMilestoneSource;
}

export interface EnclosureItem {
  id: string;
  species: SpeciesId;
  name: string;
  bio?: string;
  variant: AnimalVariant;
  gridX: number; // 0..(gridSize-2) (2x2 footprint)
  gridZ: number;
  happiness: number; // 0..100
  hunger: number; // 0..100 (100 = full)
  grooming: number; // 0..100 (100 = gleaming)
  bondLevel: number; // 1..10
  lastFedAt: number;
  lastGroomedAt: number;
  visitorHearts: number;
  adoptedAt?: number;
  timesFed?: number;
  timesGroomed?: number;
  bondHistory?: BondHistoryEntry[];
  isBaby?: boolean;
  hybridTrait?: string;
  parentNames?: [string, string];
}

export interface CropPlotItem {
  id: string;
  cropType: CropTypeId;
  gridX: number;
  gridZ: number;
  plantedAt: number;
  growDurationMs: number;
  fertilized?: boolean;
}

export interface DecorationItem {
  id: string;
  decorType: DecorTypeId;
  gridX: number;
  gridZ: number;
  rotation: number; // 0..3 (multiples of 90 deg)
}

export type StorageCrateItem =
  | { kind: 'enclosure'; item: EnclosureItem; storedAt: number }
  | { kind: 'crop'; item: CropPlotItem; storedAt: number }
  | { kind: 'decor'; item: DecorationItem; storedAt: number };

export interface DailyQuestItem {
  id: string;
  type: 'harvest' | 'care' | 'feed_high' | 'visit' | 'craft';
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  rewardLanterns: number;
  claimed: boolean;
}

export interface DailyQuestState {
  date: string; // YYYY-MM-DD
  quests: DailyQuestItem[];
}

export interface DailyForagingState {
  date: string; // YYYY-MM-DD
  foundIds: string[]; // 'forage-0' | 'forage-1' | 'forage-2'
}

export interface GuestbookEntry {
  id: string;
  authorName: string;
  authorCode: string;
  message: string;
  timestamp: number;
}

export interface LayoutBlueprint {
  slot: 1 | 2 | 3;
  name: string;
  savedAt: number;
  gridSize: number;
  enclosures: Array<{ id: string; species: SpeciesId; gridX: number; gridZ: number }>;
  crops: Array<{ id: string; cropType: CropTypeId; gridX: number; gridZ: number }>;
  decorations: Array<{ id: string; decorType: DecorTypeId; gridX: number; gridZ: number; rotation: number }>;
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
  gridSize?: number; // 12, 18, or 24
  enclosures: EnclosureItem[];
  crops: CropPlotItem[];
  decorations: DecorationItem[];
  storageCrate?: StorageCrateItem[];
  inventory: Record<ResourceId, number>;
  dailyReward: DailyRewardState;
  dailyQuests?: DailyQuestState;
  dailyForaging?: DailyForagingState;
  seasonalEvent: SeasonalEventState;
  unlockedAchievements: string[];
  savedFriends?: string[];
  guestbook?: GuestbookEntry[];
  blueprints?: LayoutBlueprint[];
  lastIdleCollectedAt?: number;
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

export interface DirectTradeOffer {
  id: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  resourceId: ResourceId;
  itemLabel: string;
  quantity: number;
  askingCoins: number; // 0 = free gift
  note?: string;
  status: 'pending' | 'accepted' | 'declined';
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
  | { kind: 'decor'; decorType: DecorTypeId }
  | { kind: 'storage'; storageIndex: number; label: string; footprint: 1 | 2 };

export type EditableItemRef =
  | { kind: 'enclosure'; id: string }
  | { kind: 'crop'; id: string }
  | { kind: 'decor'; id: string };

export type ActiveDrawer =
  | null
  | 'build'
  | 'crops'
  | 'summary'
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
