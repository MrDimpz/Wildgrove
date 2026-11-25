/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChatMessage,
  CommunitySanctuarySummary,
  LeaderboardEntry,
  MarketplaceListing,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from '../types/game';
import { computePrestige } from '../data/catalog';

const STORAGE_KEY = 'wildgrove_sanctuary_save_v1';
const FALLBACK_SANCTUARIES_KEY = 'wildgrove_fallback_sanctuaries_v1';
const FALLBACK_MARKET_KEY = 'wildgrove_fallback_market_v1';
const FALLBACK_CHAT_KEY = 'wildgrove_fallback_chat_v1';

// Detects once per page load whether the Express backend is running (/api/health)
// or if the app is deployed as a static Vite site (dist/ only).
let backendAvailablePromise: Promise<boolean> | null = null;

function isBackendAvailable(): Promise<boolean> {
  if (!backendAvailablePromise) {
    backendAvailablePromise = fetch('/api/health', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return false;
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) return false;
        const body = (await res.json()) as { ok?: boolean };
        return body?.ok === true;
      })
      .catch(() => false);
  }
  return backendAvailablePromise;
}

function createEmptyInventory(overrides: Partial<Record<ResourceId, number>> = {}): Record<ResourceId, number> {
  return {
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
    ...overrides,
  };
}

function buildSeedSanctuaries(): Record<string, SanctuaryState> {
  const now = Date.now();
  const list: SanctuaryState[] = [
    {
      syncCode: 'GROVE-LUNA',
      keeperName: 'Maren',
      sanctuaryName: 'Moonpine Wolf Sanctuary',
      avatarSpecies: 'wolf',
      level: 8,
      xp: 420,
      coins: 3420,
      gems: 64,
      prestige: 0,
      enclosures: [
        {
          id: 'maren-e1',
          species: 'wolf',
          name: 'Freya',
          variant: 'exotic',
          gridX: 2,
          gridZ: 2,
          happiness: 96,
          hunger: 92,
          grooming: 95,
          bondLevel: 7,
          lastFedAt: now - 60000,
          lastGroomedAt: now - 90000,
          visitorHearts: 18,
        },
        {
          id: 'maren-e2',
          species: 'snow_leopard',
          name: 'Glacier',
          variant: 'exotic',
          gridX: 7,
          gridZ: 2,
          happiness: 94,
          hunger: 88,
          grooming: 92,
          bondLevel: 6,
          lastFedAt: now - 110000,
          lastGroomedAt: now - 140000,
          visitorHearts: 14,
        },
        {
          id: 'maren-e3',
          species: 'butterfly',
          name: 'Aurelia',
          variant: 'exotic',
          gridX: 2,
          gridZ: 7,
          happiness: 95,
          hunger: 91,
          grooming: 94,
          bondLevel: 6,
          lastFedAt: now - 70000,
          lastGroomedAt: now - 80000,
          visitorHearts: 15,
        },
        {
          id: 'maren-e4',
          species: 'gorilla',
          name: 'Kibo',
          variant: 'classic',
          gridX: 7,
          gridZ: 7,
          happiness: 91,
          hunger: 86,
          grooming: 90,
          bondLevel: 5,
          lastFedAt: now - 120000,
          lastGroomedAt: now - 150000,
          visitorHearts: 11,
        },
      ],
      crops: [
        { id: 'mc1', cropType: 'herb', gridX: 5, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'mc2', cropType: 'ice_fish', gridX: 6, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'mc3', cropType: 'lavender', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'md1', decorType: 'gazebo', gridX: 5, gridZ: 2, rotation: 0 },
        { id: 'md2', decorType: 'fountain', gridX: 5, gridZ: 7, rotation: 0 },
        { id: 'md3', decorType: 'koi_pond', gridX: 6, gridZ: 6, rotation: 0 },
        { id: 'md4', decorType: 'autumn_maple', gridX: 1, gridZ: 5, rotation: 0 },
        { id: 'md5', decorType: 'autumn_maple', gridX: 10, gridZ: 5, rotation: 1 },
        { id: 'md6', decorType: 'lantern_post', gridX: 4, gridZ: 4, rotation: 0 },
        { id: 'md7', decorType: 'lantern_post', gridX: 7, gridZ: 4, rotation: 2 },
        { id: 'md8', decorType: 'flower_arch', gridX: 5, gridZ: 9, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 12,
        mango_treat: 10,
        nectar_treat: 14,
        herb_treat: 16,
        ice_fish_treat: 10,
        lucky_acorn: 5,
        silverback_amber: 4,
        wing_dust: 6,
        moonstone_pelt: 8,
        frost_pelt: 6,
        lantern_charm: 9,
      }),
      dailyReward: { streak: 6, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 340, claimedMilestones: ['m1', 'm2', 'm3'] },
      unlockedAchievements: ['four_species', 'exotic_collector', 'master_caretaker', 'grand_landscape', 'trade_magnate'],
      stats: { totalFeeds: 48, totalGrooms: 44, totalHarvests: 61, totalTrades: 14, friendsVisited: 9 },
      updatedAt: now - 300000,
    },
    {
      syncCode: 'GROVE-FERN',
      keeperName: 'Kenji',
      sanctuaryName: 'Emerald Bamboo Canopy',
      avatarSpecies: 'gorilla',
      level: 7,
      xp: 290,
      coins: 2480,
      gems: 42,
      prestige: 0,
      enclosures: [
        {
          id: 'kenji-e1',
          species: 'gorilla',
          name: 'Taro',
          variant: 'exotic',
          gridX: 2,
          gridZ: 2,
          happiness: 94,
          hunger: 89,
          grooming: 91,
          bondLevel: 6,
          lastFedAt: now - 90000,
          lastGroomedAt: now - 110000,
          visitorHearts: 13,
        },
        {
          id: 'kenji-e2',
          species: 'red_panda',
          name: 'Mochi',
          variant: 'exotic',
          gridX: 7,
          gridZ: 2,
          happiness: 93,
          hunger: 90,
          grooming: 92,
          bondLevel: 5,
          lastFedAt: now - 85000,
          lastGroomedAt: now - 105000,
          visitorHearts: 12,
        },
        {
          id: 'kenji-e3',
          species: 'river_otter',
          name: 'Pebble',
          variant: 'classic',
          gridX: 2,
          gridZ: 7,
          happiness: 91,
          hunger: 87,
          grooming: 90,
          bondLevel: 5,
          lastFedAt: now - 95000,
          lastGroomedAt: now - 120000,
          visitorHearts: 10,
        },
        {
          id: 'kenji-e4',
          species: 'raccoon',
          name: 'Pip',
          variant: 'classic',
          gridX: 7,
          gridZ: 7,
          happiness: 90,
          hunger: 85,
          grooming: 88,
          bondLevel: 4,
          lastFedAt: now - 100000,
          lastGroomedAt: now - 130000,
          visitorHearts: 8,
        },
      ],
      crops: [
        { id: 'kc1', cropType: 'mango', gridX: 5, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'kc2', cropType: 'bamboo_shoot', gridX: 6, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'kc3', cropType: 'river_reed', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'kd1', decorType: 'bamboo', gridX: 1, gridZ: 2, rotation: 0 },
        { id: 'kd2', decorType: 'bamboo', gridX: 1, gridZ: 3, rotation: 1 },
        { id: 'kd3', decorType: 'bamboo', gridX: 10, gridZ: 2, rotation: 2 },
        { id: 'kd4', decorType: 'koi_pond', gridX: 5, gridZ: 6, rotation: 0 },
        { id: 'kd5', decorType: 'gazebo', gridX: 5, gridZ: 2, rotation: 0 },
        { id: 'kd6', decorType: 'lantern_post', gridX: 4, gridZ: 5, rotation: 0 },
        { id: 'kd7', decorType: 'willow', gridX: 9, gridZ: 9, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 8,
        mango_treat: 14,
        bamboo_shoot_treat: 12,
        river_reed_treat: 10,
        lucky_acorn: 6,
        silverback_amber: 7,
        fire_tail_charm: 5,
        river_pearl: 6,
        lantern_charm: 5,
      }),
      dailyReward: { streak: 4, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 210, claimedMilestones: ['m1', 'm2'] },
      unlockedAchievements: ['four_species', 'exotic_collector', 'master_caretaker', 'grand_landscape'],
      stats: { totalFeeds: 29, totalGrooms: 24, totalHarvests: 40, totalTrades: 9, friendsVisited: 6 },
      updatedAt: now - 600000,
    },
    {
      syncCode: 'GROVE-IRIS',
      keeperName: 'Clara',
      sanctuaryName: 'Petal & Wing Conservatory',
      avatarSpecies: 'butterfly',
      level: 6,
      xp: 310,
      coins: 1990,
      gems: 51,
      prestige: 0,
      enclosures: [
        {
          id: 'clara-e1',
          species: 'butterfly',
          name: 'Morpho',
          variant: 'exotic',
          gridX: 2,
          gridZ: 2,
          happiness: 97,
          hunger: 94,
          grooming: 96,
          bondLevel: 6,
          lastFedAt: now - 55000,
          lastGroomedAt: now - 75000,
          visitorHearts: 16,
        },
        {
          id: 'clara-e2',
          species: 'golden_fox',
          name: 'Sol',
          variant: 'exotic',
          gridX: 7,
          gridZ: 2,
          happiness: 95,
          hunger: 90,
          grooming: 93,
          bondLevel: 5,
          lastFedAt: now - 65000,
          lastGroomedAt: now - 85000,
          visitorHearts: 13,
        },
        {
          id: 'clara-e3',
          species: 'raccoon',
          name: 'Clover',
          variant: 'exotic',
          gridX: 2,
          gridZ: 7,
          happiness: 95,
          hunger: 91,
          grooming: 93,
          bondLevel: 5,
          lastFedAt: now - 75000,
          lastGroomedAt: now - 95000,
          visitorHearts: 14,
        },
        {
          id: 'clara-e4',
          species: 'wolf',
          name: 'Bramble',
          variant: 'classic',
          gridX: 7,
          gridZ: 7,
          happiness: 89,
          hunger: 84,
          grooming: 88,
          bondLevel: 4,
          lastFedAt: now - 95000,
          lastGroomedAt: now - 115000,
          visitorHearts: 9,
        },
      ],
      crops: [
        { id: 'cc1', cropType: 'lavender', gridX: 5, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'cc2', cropType: 'fox_berry', gridX: 6, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'cc3', cropType: 'berry', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'cd1', decorType: 'flower_arch', gridX: 5, gridZ: 2, rotation: 0 },
        { id: 'cd2', decorType: 'fountain', gridX: 5, gridZ: 6, rotation: 0 },
        { id: 'cd3', decorType: 'willow', gridX: 1, gridZ: 5, rotation: 0 },
        { id: 'cd4', decorType: 'willow', gridX: 10, gridZ: 5, rotation: 1 },
        { id: 'cd5', decorType: 'hay_cart', gridX: 6, gridZ: 6, rotation: 1 },
        { id: 'cd6', decorType: 'lantern_post', gridX: 4, gridZ: 4, rotation: 0 },
        { id: 'cd7', decorType: 'lantern_post', gridX: 7, gridZ: 4, rotation: 2 },
        { id: 'cd8', decorType: 'autumn_maple', gridX: 5, gridZ: 9, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 9,
        nectar_treat: 18,
        fox_berry_treat: 11,
        wing_dust: 9,
        sun_crystal: 6,
        lantern_charm: 7,
      }),
      dailyReward: { streak: 5, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 265, claimedMilestones: ['m1', 'm2'] },
      unlockedAchievements: ['four_species', 'exotic_collector', 'master_caretaker', 'grand_landscape'],
      stats: { totalFeeds: 35, totalGrooms: 33, totalHarvests: 48, totalTrades: 11, friendsVisited: 7 },
      updatedAt: now - 450000,
    },
    {
      syncCode: 'GROVE-OAK7',
      keeperName: 'Tomas',
      sanctuaryName: 'Acorn Creek Homestead',
      avatarSpecies: 'raccoon',
      level: 4,
      xp: 145,
      coins: 1120,
      gems: 22,
      prestige: 0,
      enclosures: [
        {
          id: 'tomas-e1',
          species: 'raccoon',
          name: 'Bandit',
          variant: 'classic',
          gridX: 2,
          gridZ: 3,
          happiness: 88,
          hunger: 82,
          grooming: 85,
          bondLevel: 4,
          lastFedAt: now - 120000,
          lastGroomedAt: now - 150000,
          visitorHearts: 7,
        },
        {
          id: 'tomas-e2',
          species: 'wolf',
          name: 'Timber',
          variant: 'classic',
          gridX: 7,
          gridZ: 3,
          happiness: 85,
          hunger: 79,
          grooming: 81,
          bondLevel: 3,
          lastFedAt: now - 130000,
          lastGroomedAt: now - 160000,
          visitorHearts: 5,
        },
        {
          id: 'tomas-e3',
          species: 'gorilla',
          name: 'Moss',
          variant: 'classic',
          gridX: 5,
          gridZ: 7,
          happiness: 83,
          hunger: 77,
          grooming: 80,
          bondLevel: 3,
          lastFedAt: now - 140000,
          lastGroomedAt: now - 170000,
          visitorHearts: 4,
        },
      ],
      crops: [
        { id: 'tc1', cropType: 'berry', gridX: 4, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'tc2', cropType: 'herb', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'td1', decorType: 'hay_cart', gridX: 6, gridZ: 5, rotation: 0 },
        { id: 'td2', decorType: 'koi_pond', gridX: 5, gridZ: 2, rotation: 0 },
        { id: 'td3', decorType: 'autumn_maple', gridX: 2, gridZ: 7, rotation: 0 },
        { id: 'td4', decorType: 'lantern_post', gridX: 3, gridZ: 6, rotation: 0 },
        { id: 'td5', decorType: 'willow', gridX: 9, gridZ: 7, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 10,
        herb_treat: 8,
        lucky_acorn: 5,
        lantern_charm: 3,
      }),
      dailyReward: { streak: 3, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 120, claimedMilestones: ['m1'] },
      unlockedAchievements: ['master_caretaker'],
      stats: { totalFeeds: 18, totalGrooms: 14, totalHarvests: 25, totalTrades: 5, friendsVisited: 3 },
      updatedAt: now - 900000,
    },
  ];

  const map: Record<string, SanctuaryState> = {};
  for (const s of list) {
    s.prestige = computePrestige(s);
    map[s.syncCode] = s;
  }
  return map;
}

function buildSeedMarketplace(): MarketplaceListing[] {
  const now = Date.now();
  return [
    {
      id: 'mkt-1',
      sellerCode: 'GROVE-LUNA',
      sellerName: 'Maren',
      itemType: 'resource',
      itemId: 'moonstone_pelt',
      itemLabel: 'Moonlit Ridge Charm',
      quantity: 2,
      priceCoins: 240,
      priceGems: 0,
      rarity: 'exotic',
      createdAt: now - 420000,
    },
    {
      id: 'mkt-2',
      sellerCode: 'GROVE-IRIS',
      sellerName: 'Clara',
      itemType: 'resource',
      itemId: 'wing_dust',
      itemLabel: 'Iridescent Wing Shimmer',
      quantity: 2,
      priceCoins: 210,
      priceGems: 0,
      rarity: 'exotic',
      createdAt: now - 360000,
    },
    {
      id: 'mkt-3',
      sellerCode: 'GROVE-FERN',
      sellerName: 'Kenji',
      itemType: 'resource',
      itemId: 'silverback_amber',
      itemLabel: 'Canopy Amber Resin',
      quantity: 3,
      priceCoins: 260,
      priceGems: 0,
      rarity: 'rare',
      createdAt: now - 280000,
    },
    {
      id: 'mkt-4',
      sellerCode: 'GROVE-OAK7',
      sellerName: 'Tomas',
      itemType: 'resource',
      itemId: 'lucky_acorn',
      itemLabel: 'Lucky Golden Acorn',
      quantity: 3,
      priceCoins: 195,
      priceGems: 0,
      rarity: 'rare',
      createdAt: now - 210000,
    },
    {
      id: 'mkt-5',
      sellerCode: 'GROVE-LUNA',
      sellerName: 'Maren',
      itemType: 'resource',
      itemId: 'frost_pelt',
      itemLabel: 'Glacial Frost Pelt',
      quantity: 2,
      priceCoins: 290,
      priceGems: 0,
      rarity: 'exotic',
      createdAt: now - 160000,
    },
    {
      id: 'mkt-6',
      sellerCode: 'GROVE-FERN',
      sellerName: 'Kenji',
      itemType: 'resource',
      itemId: 'fire_tail_charm',
      itemLabel: 'Fire-Tail Bamboo Charm',
      quantity: 2,
      priceCoins: 225,
      priceGems: 0,
      rarity: 'rare',
      createdAt: now - 120000,
    },
    {
      id: 'mkt-7',
      sellerCode: 'GROVE-IRIS',
      sellerName: 'Clara',
      itemType: 'resource',
      itemId: 'sun_crystal',
      itemLabel: 'Sunlit Amber Crystal',
      quantity: 2,
      priceCoins: 250,
      priceGems: 0,
      rarity: 'exotic',
      createdAt: now - 95000,
    },
    {
      id: 'mkt-8',
      sellerCode: 'GROVE-FERN',
      sellerName: 'Kenji',
      itemType: 'resource',
      itemId: 'river_pearl',
      itemLabel: 'Creekside River Pearl',
      quantity: 3,
      priceCoins: 205,
      priceGems: 0,
      rarity: 'rare',
      createdAt: now - 60000,
    },
  ];
}

function buildSeedChat(): ChatMessage[] {
  const now = Date.now();
  return [
    {
      id: 'chat-seed-1',
      senderCode: 'GROVE-LUNA',
      senderName: 'Maren',
      avatarSpecies: 'wolf',
      text: 'Welcome to Wildgrove Sanctuary! Just listed Moonlit Ridge Charms and Glacial Frost Pelts on the market.',
      tag: 'trade',
      timestamp: now - 540000,
    },
    {
      id: 'chat-seed-2',
      senderCode: 'GROVE-IRIS',
      senderName: 'Clara',
      avatarSpecies: 'butterfly',
      text: 'Come visit Petal & Wing Conservatory anytime — my Sapphire Morpho and Celestial Star Fox love visitors!',
      tag: 'visit',
      timestamp: now - 310000,
    },
    {
      id: 'chat-seed-3',
      senderCode: 'GROVE-FERN',
      senderName: 'Kenji',
      avatarSpecies: 'gorilla',
      text: 'Tip: placing Bamboo and Lantern Posts beside enclosures boosts your Prestige rank fast.',
      tag: 'general',
      timestamp: now - 150000,
    },
  ];
}

// --- Local Persistence Helpers (instant boot + complete static-hosting support) ---
export function loadLocalSanctuary(): SanctuaryState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SanctuaryState;
    if (parsed && parsed.syncCode && Array.isArray(parsed.enclosures)) {
      return parsed;
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function readFallbackMap(): Record<string, SanctuaryState> {
  const seeds = buildSeedSanctuaries();
  try {
    const raw = localStorage.getItem(FALLBACK_SANCTUARIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...seeds, ...(parsed as Record<string, SanctuaryState>) };
      }
    }
  } catch {
    // Ignore
  }
  return seeds;
}

function writeFallbackMap(map: Record<string, SanctuaryState>): void {
  try {
    localStorage.setItem(FALLBACK_SANCTUARIES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function readFallbackMarketplace(): MarketplaceListing[] {
  try {
    const raw = localStorage.getItem(FALLBACK_MARKET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as MarketplaceListing[];
    }
  } catch {
    // Ignore
  }
  const seeds = buildSeedMarketplace();
  try {
    localStorage.setItem(FALLBACK_MARKET_KEY, JSON.stringify(seeds));
  } catch {
    // Ignore
  }
  return seeds;
}

function writeFallbackMarketplace(listings: MarketplaceListing[]): void {
  try {
    localStorage.setItem(FALLBACK_MARKET_KEY, JSON.stringify(listings));
  } catch {
    // Ignore
  }
}

export function saveLocalSanctuary(state: SanctuaryState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const map = readFallbackMap();
    map[state.syncCode] = { ...state, prestige: computePrestige(state), updatedAt: Date.now() };
    writeFallbackMap(map);
  } catch {
    // Ignore storage quota errors
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T }> {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, status: res.status };
    }
    const data = (await res.json()) as T;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

// --- Cloud Sync REST API (Primary: Express Backend, Seamless Fallback: Local Storage) ---
export async function pushCloudSave(state: SanctuaryState): Promise<{ ok: boolean; updatedAt?: number }> {
  saveLocalSanctuary(state);
  if (!(await isBackendAvailable())) {
    return { ok: true, updatedAt: Date.now() };
  }
  const res = await fetchJson<{ ok?: boolean; sanctuary?: SanctuaryState }>(
    `/api/sync/${encodeURIComponent(state.syncCode)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sanctuary: state }),
    },
  );
  if (res.ok && res.data?.sanctuary) {
    return { ok: true, updatedAt: res.data.sanctuary.updatedAt };
  }
  return { ok: false };
}

export async function pullCloudSave(syncCode: string): Promise<SanctuaryState | null> {
  const clean = syncCode.trim().toUpperCase();
  if (clean.length < 4) return null;

  if (await isBackendAvailable()) {
    const res = await fetchJson<{ sanctuary?: SanctuaryState }>(`/api/sync/${encodeURIComponent(clean)}`);
    if (res.ok && res.data?.sanctuary) {
      return res.data.sanctuary;
    }
  }

  const map = readFallbackMap();
  return map[clean] || null;
}

export async function fetchCommunitySanctuaries(): Promise<CommunitySanctuarySummary[]> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ sanctuaries?: CommunitySanctuarySummary[] }>('/api/sanctuaries');
    if (res.ok && Array.isArray(res.data?.sanctuaries)) {
      return res.data.sanctuaries;
    }
  }

  const map = readFallbackMap();
  return Object.values(map)
    .map((s) => ({
      syncCode: s.syncCode,
      keeperName: s.keeperName,
      sanctuaryName: s.sanctuaryName,
      avatarSpecies: s.avatarSpecies,
      level: s.level,
      prestige: computePrestige(s),
      animalCount: s.enclosures.length,
      decorCount: s.decorations.length,
      updatedAt: s.updatedAt,
    }))
    .sort((a, b) => b.prestige - a.prestige);
}

export async function sendVisitGift(
  targetCode: string,
  visitorName: string,
  enclosureId: string,
): Promise<SanctuaryState | null> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ sanctuary?: SanctuaryState }>(
      `/api/sanctuaries/${encodeURIComponent(targetCode)}/visit-gift`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName, enclosureId }),
      },
    );
    if (res.ok && res.data?.sanctuary) {
      return res.data.sanctuary;
    }
  }

  // Local fallback for static Vite deployments
  const map = readFallbackMap();
  const target = map[targetCode.trim().toUpperCase()];
  if (!target) return null;
  const updatedEnclosures = target.enclosures.map((enc) =>
    enc.id === enclosureId
      ? { ...enc, visitorHearts: (enc.visitorHearts || 0) + 1, happiness: Math.min(100, enc.happiness + 6) }
      : enc,
  );
  const updated: SanctuaryState = {
    ...target,
    enclosures: updatedEnclosures,
    updatedAt: Date.now(),
  };
  updated.prestige = computePrestige(updated);
  map[updated.syncCode] = updated;
  writeFallbackMap(map);
  return updated;
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ listings?: MarketplaceListing[] }>('/api/marketplace');
    if (res.ok && Array.isArray(res.data?.listings)) {
      writeFallbackMarketplace(res.data.listings);
      return res.data.listings;
    }
  }
  return readFallbackMarketplace();
}

export async function createMarketplaceListing(payload: {
  sellerCode: string;
  sellerName: string;
  itemType: 'resource' | 'decor' | 'exotic_license';
  itemId: string;
  itemLabel: string;
  quantity: number;
  priceCoins: number;
  priceGems: number;
  rarity: 'common' | 'rare' | 'exotic';
}): Promise<MarketplaceListing | null> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ listing?: MarketplaceListing }>('/api/marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.data?.listing) {
      return res.data.listing;
    }
  }

  const listing: MarketplaceListing = {
    id: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...payload,
    createdAt: Date.now(),
  };
  const current = readFallbackMarketplace();
  writeFallbackMarketplace([listing, ...current].slice(0, 40));
  return listing;
}

export async function buyMarketplaceListing(
  listingId: string,
  buyerCode: string,
): Promise<{ ok: boolean; purchased?: MarketplaceListing; error?: string }> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ ok?: boolean; purchased?: MarketplaceListing; error?: string }>(
      `/api/marketplace/${encodeURIComponent(listingId)}/buy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerCode }),
      },
    );
    if (res.ok && res.data?.purchased) {
      return { ok: true, purchased: res.data.purchased };
    }
    return { ok: false, error: res.data?.error || 'Unable to reach Sanctuary Trading Post' };
  }

  const listings = readFallbackMarketplace();
  const idx = listings.findIndex((l) => l.id === listingId);
  if (idx === -1) {
    return { ok: false, error: 'Listing already sold or removed' };
  }
  const listing = listings[idx];
  if (listing.sellerCode === buyerCode) {
    return { ok: false, error: 'Cannot buy your own listing' };
  }
  const next = listings.filter((l) => l.id !== listingId);
  if (next.length < 4) {
    const refills = buildSeedMarketplace();
    const pick = refills[Math.floor(Math.random() * refills.length)];
    next.push({ ...pick, id: `mkt-r-${Date.now()}`, createdAt: Date.now() });
  }
  writeFallbackMarketplace(next);
  return { ok: true, purchased: listing };
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ leaderboard?: LeaderboardEntry[] }>('/api/leaderboard');
    if (res.ok && Array.isArray(res.data?.leaderboard)) {
      return res.data.leaderboard;
    }
  }
  const map = readFallbackMap();
  const list = Object.values(map).map((s) => ({
    syncCode: s.syncCode,
    keeperName: s.keeperName,
    sanctuaryName: s.sanctuaryName,
    avatarSpecies: s.avatarSpecies,
    level: s.level,
    prestige: computePrestige(s),
    exoticCount: s.enclosures.filter((e) => e.variant === 'exotic').length,
    animalCount: s.enclosures.length,
  }));
  list.sort((a, b) => b.prestige - a.prestige);
  return list.map((entry, idx) => ({ rank: idx + 1, ...entry }));
}

// --- Real-Time WebSocket Client (Express mode) + Zero-Error Static Mode ---
export interface RealtimeListeners {
  onPresence: (count: number) => void;
  onChatInit: (messages: ChatMessage[]) => void;
  onChatMessage: (message: ChatMessage) => void;
  onMarketplaceUpdate: (listings: MarketplaceListing[]) => void;
  onLeaderboardUpdate: (leaderboard: LeaderboardEntry[]) => void;
  onSanctuaryGift: (targetCode: string, visitorName: string, enclosureName: string) => void;
}

export class SanctuarySocketClient {
  private ws: WebSocket | null = null;
  private listeners: RealtimeListeners;
  private closed = false;
  private reconnectTimer: number | null = null;
  private reconnectDelay = 3000;
  private consecutiveFailures = 0;
  private pendingChatQueue: Array<Record<string, unknown>> = [];

  constructor(listeners: RealtimeListeners) {
    this.listeners = listeners;
    this.hydrateCachedChat();
    void this.initTransport();
  }

  private async initTransport(): Promise<void> {
    const hasBackend = await isBackendAvailable();
    if (this.closed) return;
    if (!hasBackend) {
      // Running as a static Vite deployment (e.g. Hostinger dist/): hydrate local data
      // cleanly without opening failing WebSocket connections.
      this.listeners.onPresence(1);
      this.listeners.onMarketplaceUpdate(readFallbackMarketplace());
      const lb = await fetchLeaderboard();
      if (!this.closed) {
        this.listeners.onLeaderboardUpdate(lb);
      }
      return;
    }
    this.connect();
  }

  private hydrateCachedChat(): void {
    try {
      const raw = localStorage.getItem(FALLBACK_CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.listeners.onChatInit(parsed as ChatMessage[]);
          return;
        }
      }
    } catch {
      // Ignore
    }
    const seeds = buildSeedChat();
    this.cacheChat(seeds);
    this.listeners.onChatInit(seeds);
  }

  private cacheChat(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(FALLBACK_CHAT_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // Ignore
    }
  }

  private appendLocalChat(message: ChatMessage): void {
    try {
      const raw = localStorage.getItem(FALLBACK_CHAT_KEY);
      const list: ChatMessage[] = raw ? (JSON.parse(raw) as ChatMessage[]) : buildSeedChat();
      if (!list.some((m) => m.id === message.id)) {
        list.push(message);
        this.cacheChat(list);
      }
    } catch {
      // Ignore
    }
  }

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer !== null) return;
    const delay = this.consecutiveFailures >= 5 ? 60000 : this.reconnectDelay;
    this.reconnectDelay = Math.min(30000, Math.round(this.reconnectDelay * 1.8));
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      if (typeof document !== 'undefined' && document.hidden) {
        this.scheduleReconnect();
        return;
      }
      this.connect();
    }, delay);
  }

  private connect(): void {
    if (this.closed || typeof window === 'undefined') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        this.reconnectDelay = 3000;
        this.consecutiveFailures = 0;
        while (this.pendingChatQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
          const queued = this.pendingChatQueue.shift();
          if (queued) ws.send(JSON.stringify(queued));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data));
          if (data.type === 'init') {
            if (typeof data.onlineCount === 'number') this.listeners.onPresence(data.onlineCount);
            if (Array.isArray(data.chat)) {
              this.cacheChat(data.chat);
              this.listeners.onChatInit(data.chat);
            }
            if (Array.isArray(data.marketplace)) this.listeners.onMarketplaceUpdate(data.marketplace);
            if (Array.isArray(data.leaderboard)) this.listeners.onLeaderboardUpdate(data.leaderboard);
          } else if (data.type === 'presence' && typeof data.onlineCount === 'number') {
            this.listeners.onPresence(data.onlineCount);
          } else if (data.type === 'chat:message' && data.message) {
            this.appendLocalChat(data.message);
            this.listeners.onChatMessage(data.message);
          } else if (data.type === 'marketplace:updated' && Array.isArray(data.listings)) {
            this.listeners.onMarketplaceUpdate(data.listings);
          } else if (data.type === 'leaderboard:updated' && Array.isArray(data.leaderboard)) {
            this.listeners.onLeaderboardUpdate(data.leaderboard);
          } else if (data.type === 'sanctuary:gift') {
            this.listeners.onSanctuaryGift(data.targetCode, data.visitorName, data.enclosureName);
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (!opened) {
          this.consecutiveFailures += 1;
        }
        if (!this.closed) {
          this.scheduleReconnect();
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.consecutiveFailures += 1;
      this.scheduleReconnect();
    }
  }

  public sendChat(payload: {
    id: string;
    senderCode: string;
    senderName: string;
    avatarSpecies: SpeciesId;
    text: string;
    tag?: 'general' | 'trade' | 'visit' | 'milestone';
  }): boolean {
    const frame = { type: 'chat:send', ...payload };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
      return true;
    }

    const msg: ChatMessage = { ...payload, timestamp: Date.now() };
    this.appendLocalChat(msg);
    this.pendingChatQueue.push(frame);
    if (this.pendingChatQueue.length > 10) this.pendingChatQueue.shift();
    this.listeners.onChatMessage(msg);
    return true;
  }

  public dispose(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
