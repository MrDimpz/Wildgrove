/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { MysqlSanctuaryStore } from './mysqlStore.js';
import { createAdminAuthManager } from './adminAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DATA_DIR = path.resolve(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'sanctuary-db.json');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

const VALID_SPECIES = new Set([
  'raccoon',
  'gorilla',
  'butterfly',
  'wolf',
  'red_panda',
  'golden_fox',
  'snow_leopard',
  'river_otter',
]);

const VALID_CROPS = new Set([
  'berry',
  'mango',
  'lavender',
  'herb',
  'bamboo_shoot',
  'fox_berry',
  'ice_fish',
  'river_reed',
]);

const VALID_DECORS = new Set([
  'willow',
  'autumn_maple',
  'bamboo',
  'koi_pond',
  'fountain',
  'lantern_post',
  'flower_arch',
  'gazebo',
  'cobble_path',
  'hay_cart',
]);

const VALID_RESOURCES = new Set([
  'berry_treat',
  'mango_treat',
  'nectar_treat',
  'herb_treat',
  'bamboo_shoot_treat',
  'fox_berry_treat',
  'ice_fish_treat',
  'river_reed_treat',
  'lucky_acorn',
  'silverback_amber',
  'wing_dust',
  'moonstone_pelt',
  'lantern_charm',
  'fire_tail_charm',
  'sun_crystal',
  'frost_pelt',
  'river_pearl',
  'gourmet_treat',
  'sunbeam_fertilizer',
  'meadow_sprinkler',
]);

const VALID_BOND_SOURCES = new Set(['adopted', 'feed', 'groom', 'exotic', 'gourmet', 'bred']);

const SPECIES_PRESTIGE = {
  raccoon: 140,
  gorilla: 220,
  butterfly: 185,
  wolf: 260,
  red_panda: 280,
  golden_fox: 310,
  snow_leopard: 380,
  river_otter: 240,
};

const DECOR_PRESTIGE = {
  willow: 65,
  autumn_maple: 75,
  bamboo: 50,
  koi_pond: 120,
  fountain: 145,
  lantern_post: 45,
  flower_arch: 95,
  gazebo: 180,
  cobble_path: 15,
  hay_cart: 55,
};

function clampInt(val, min, max, fallback = min) {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function sanitizeCode(code) {
  return String(code || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 16);
}

function sanitizeText(val, maxLen, fallback = '') {
  const s = String(val ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
  return s || fallback;
}

function createEmptyInventory(overrides = {}) {
  const inv = {};
  for (const key of VALID_RESOURCES) {
    inv[key] = clampInt(overrides[key], 0, 9999, 0);
  }
  return inv;
}

function computePrestige(state) {
  const level = clampInt(state?.level, 1, 999, 1);
  let score = level * 50;
  const speciesSeen = new Set();

  const enclosures = Array.isArray(state?.enclosures) ? state.enclosures : [];
  for (const enc of enclosures) {
    const sp = VALID_SPECIES.has(enc?.species) ? enc.species : 'raccoon';
    speciesSeen.add(sp);
    score += SPECIES_PRESTIGE[sp] ?? 140;
    if (enc?.variant === 'exotic') score += 160;
    const bond = clampInt(enc?.bondLevel, 1, 10, 1);
    const happy = clampInt(enc?.happiness, 0, 100, 75);
    const hearts = clampInt(enc?.visitorHearts, 0, 10000, 0);
    score += Math.round(bond * 35 + happy * 0.8 + hearts * 12);
  }

  score += speciesSeen.size * 65;

  const decorations = Array.isArray(state?.decorations) ? state.decorations : [];
  for (const dec of decorations) {
    score += DECOR_PRESTIGE[dec?.decorType] ?? 20;
  }

  const crops = Array.isArray(state?.crops) ? state.crops : [];
  score += crops.length * 14;
  return Math.round(score);
}

function sanitizeSanctuary(code, incoming) {
  const now = Date.now();
  const gridSize = incoming.gridSize === 24 ? 24 : incoming.gridSize === 18 ? 18 : 12;
  const maxEncCoord = Math.max(0, gridSize - 2);
  const maxTileCoord = Math.max(0, gridSize - 1);

  const rawEnclosures = Array.isArray(incoming.enclosures) ? incoming.enclosures.slice(0, 96) : [];
  const enclosures = rawEnclosures
    .filter((e) => e && typeof e === 'object')
    .map((e, idx) => {
      const lastFedAt = clampInt(e.lastFedAt, 0, now + 86400000, now);
      const lastGroomedAt = clampInt(e.lastGroomedAt, 0, now + 86400000, now);
      const adoptedAt = clampInt(
        e.adoptedAt,
        0,
        now + 86400000,
        Math.min(lastFedAt, lastGroomedAt),
      );
      const bondHistory = Array.isArray(e.bondHistory)
        ? e.bondHistory
            .filter((b) => b && typeof b === 'object')
            .slice(0, 16)
            .map((b) => ({
              level: clampInt(b.level, 1, 10, 1),
              reachedAt: clampInt(b.reachedAt, 0, now + 86400000, adoptedAt),
              source: VALID_BOND_SOURCES.has(b.source) ? b.source : 'feed',
            }))
        : undefined;

      const parentNames =
        Array.isArray(e.parentNames) && e.parentNames.length === 2
          ? [sanitizeText(e.parentNames[0], 28, 'Parent'), sanitizeText(e.parentNames[1], 28, 'Parent')]
          : undefined;

      return {
        id: sanitizeText(e.id, 48, `enc-${idx}-${now}`),
        species: VALID_SPECIES.has(e.species) ? e.species : 'raccoon',
        name: sanitizeText(e.name, 28, 'Companion'),
        ...(typeof e.bio === 'string' && e.bio.trim() ? { bio: sanitizeText(e.bio, 120) } : {}),
        variant: e.variant === 'exotic' ? 'exotic' : 'classic',
        gridX: clampInt(e.gridX, 0, maxEncCoord, 0),
        gridZ: clampInt(e.gridZ, 0, maxEncCoord, 0),
        happiness: clampInt(e.happiness, 0, 100, 80),
        hunger: clampInt(e.hunger, 0, 100, 80),
        grooming: clampInt(e.grooming, 0, 100, 80),
        bondLevel: clampInt(e.bondLevel, 1, 10, 1),
        lastFedAt,
        lastGroomedAt,
        visitorHearts: clampInt(e.visitorHearts, 0, 100000, 0),
        adoptedAt,
        timesFed: clampInt(e.timesFed, 0, 1000000, 0),
        timesGroomed: clampInt(e.timesGroomed, 0, 1000000, 0),
        ...(bondHistory && bondHistory.length > 0 ? { bondHistory } : {}),
        ...(e.isBaby ? { isBaby: true } : {}),
        ...(typeof e.hybridTrait === 'string' && e.hybridTrait.trim()
          ? { hybridTrait: sanitizeText(e.hybridTrait, 36) }
          : {}),
        ...(parentNames ? { parentNames } : {}),
      };
    });

  const rawCrops = Array.isArray(incoming.crops) ? incoming.crops.slice(0, 200) : [];
  const crops = rawCrops
    .filter((c) => c && typeof c === 'object')
    .map((c, idx) => {
      const fertilized = Boolean(c.fertilized);
      return {
        id: sanitizeText(c.id, 48, `crop-${idx}-${now}`),
        cropType: VALID_CROPS.has(c.cropType) ? c.cropType : 'berry',
        gridX: clampInt(c.gridX, 0, maxTileCoord, 0),
        gridZ: clampInt(c.gridZ, 0, maxTileCoord, 0),
        plantedAt: clampInt(c.plantedAt, 0, now + 86400000, now),
        growDurationMs: fertilized ? 300000 : 600000,
        ...(fertilized ? { fertilized: true } : {}),
      };
    });

  const rawDecors = Array.isArray(incoming.decorations) ? incoming.decorations.slice(0, 350) : [];
  const decorations = rawDecors
    .filter((d) => d && typeof d === 'object')
    .map((d, idx) => ({
      id: sanitizeText(d.id, 48, `dec-${idx}-${now}`),
      decorType: VALID_DECORS.has(d.decorType) ? d.decorType : 'lantern_post',
      gridX: clampInt(d.gridX, 0, maxTileCoord, 0),
      gridZ: clampInt(d.gridZ, 0, maxTileCoord, 0),
      rotation: clampInt(d.rotation, 0, 3, 0),
    }));

  const rawStorage = Array.isArray(incoming.storageCrate) ? incoming.storageCrate.slice(0, 120) : [];
  const storageCrate = rawStorage
    .filter((s) => s && typeof s === 'object' && s.item && typeof s.item === 'object')
    .map((s) => ({
      kind: s.kind === 'enclosure' || s.kind === 'crop' ? s.kind : 'decor',
      item: s.item,
      storedAt: clampInt(s.storedAt, 0, now + 86400000, now),
    }));

  const rawQuests = incoming.dailyQuests && typeof incoming.dailyQuests === 'object' ? incoming.dailyQuests : null;
  const dailyQuests =
    rawQuests && typeof rawQuests.date === 'string' && Array.isArray(rawQuests.quests)
      ? {
          date: sanitizeText(rawQuests.date, 16, new Date().toISOString().slice(0, 10)),
          quests: rawQuests.quests.slice(0, 6).map((q, i) => ({
            id: sanitizeText(q?.id, 40, `q-${i}`),
            type: ['harvest', 'care', 'feed_high', 'visit', 'craft'].includes(q?.type) ? q.type : 'care',
            title: sanitizeText(q?.title, 64, 'Daily Quest'),
            target: clampInt(q?.target, 1, 50, 1),
            progress: clampInt(q?.progress, 0, 50, 0),
            rewardCoins: clampInt(q?.rewardCoins, 10, 2000, 120),
            rewardGems: clampInt(q?.rewardGems, 0, 50, 4),
            rewardLanterns: clampInt(q?.rewardLanterns, 0, 200, 20),
            claimed: Boolean(q?.claimed),
          })),
        }
      : undefined;

  const savedFriends = Array.isArray(incoming.savedFriends)
    ? Array.from(new Set(incoming.savedFriends.slice(0, 40).map((f) => sanitizeCode(f)).filter((f) => f.length >= 4)))
    : [];

  const guestbook = Array.isArray(incoming.guestbook)
    ? incoming.guestbook
        .filter((g) => g && typeof g === 'object' && g.message)
        .slice(0, 40)
        .map((g, idx) => ({
          id: sanitizeText(g.id, 48, `gb-${idx}-${now}`),
          authorName: sanitizeText(g.authorName, 28, 'Keeper'),
          authorCode: sanitizeCode(g.authorCode || 'GUEST') || 'GUEST',
          message: sanitizeText(g.message, 140, 'Lovely sanctuary!'),
          timestamp: clampInt(g.timestamp, 0, now + 86400000, now),
        }))
    : [];

  const blueprints = Array.isArray(incoming.blueprints)
    ? incoming.blueprints
        .filter((b) => b && typeof b === 'object' && (b.slot === 1 || b.slot === 2 || b.slot === 3))
        .slice(0, 3)
        .map((b) => ({
          slot: b.slot,
          name: sanitizeText(b.name, 32, `Layout ${b.slot}`),
          savedAt: clampInt(b.savedAt, 0, now + 86400000, now),
          gridSize: b.gridSize === 24 ? 24 : b.gridSize === 18 ? 18 : 12,
          enclosures: Array.isArray(b.enclosures) ? b.enclosures.slice(0, 96) : [],
          crops: Array.isArray(b.crops) ? b.crops.slice(0, 200) : [],
          decorations: Array.isArray(b.decorations) ? b.decorations.slice(0, 350) : [],
        }))
    : [];

  const rawInv = incoming.inventory && typeof incoming.inventory === 'object' ? incoming.inventory : {};
  const rawDaily = incoming.dailyReward && typeof incoming.dailyReward === 'object' ? incoming.dailyReward : {};
  const rawEvent = incoming.seasonalEvent && typeof incoming.seasonalEvent === 'object' ? incoming.seasonalEvent : {};
  const rawStats = incoming.stats && typeof incoming.stats === 'object' ? incoming.stats : {};

  const sanitized = {
    syncCode: code,
    keeperName: sanitizeText(incoming.keeperName, 28, 'Meadow Keeper'),
    sanctuaryName: sanitizeText(incoming.sanctuaryName, 36, 'Sunlit Wildgrove'),
    avatarSpecies: VALID_SPECIES.has(incoming.avatarSpecies) ? incoming.avatarSpecies : 'raccoon',
    level: clampInt(incoming.level, 1, 999, 1),
    xp: clampInt(incoming.xp, 0, 1000000, 0),
    coins: clampInt(incoming.coins, 0, 10000000, 750),
    gems: clampInt(incoming.gems, 0, 1000000, 35),
    prestige: 0,
    gridSize,
    enclosures,
    crops,
    decorations,
    storageCrate,
    inventory: createEmptyInventory(rawInv),
    dailyReward: {
      streak: clampInt(rawDaily.streak, 0, 7, 0),
      lastClaimDate:
        typeof rawDaily.lastClaimDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDaily.lastClaimDate)
          ? rawDaily.lastClaimDate
          : null,
    },
    ...(dailyQuests ? { dailyQuests } : {}),
    seasonalEvent: {
      eventId: sanitizeText(rawEvent.eventId, 48, 'autumn-lantern-harvest-2026'),
      lanternPoints: clampInt(rawEvent.lanternPoints, 0, 1000000, 0),
      claimedMilestones: Array.isArray(rawEvent.claimedMilestones)
        ? rawEvent.claimedMilestones.slice(0, 12).map((m) => sanitizeText(m, 24)).filter(Boolean)
        : [],
    },
    unlockedAchievements: Array.isArray(incoming.unlockedAchievements)
      ? incoming.unlockedAchievements.slice(0, 32).map((a) => sanitizeText(a, 40)).filter(Boolean)
      : [],
    savedFriends,
    guestbook,
    blueprints,
    lastIdleCollectedAt: clampInt(incoming.lastIdleCollectedAt, 0, now + 86400000, now),
    stats: {
      totalFeeds: clampInt(rawStats.totalFeeds, 0, 1000000, 0),
      totalGrooms: clampInt(rawStats.totalGrooms, 0, 1000000, 0),
      totalHarvests: clampInt(rawStats.totalHarvests, 0, 1000000, 0),
      totalTrades: clampInt(rawStats.totalTrades, 0, 1000000, 0),
      friendsVisited: clampInt(rawStats.friendsVisited, 0, 1000000, 0),
    },
    updatedAt: now,
  };

  sanitized.prestige = computePrestige(sanitized);
  return sanitized;
}

const GENERATED_GROVE_CODES = new Set([
  'GROVE-LUNA',
  'GROVE-FERN',
  'GROVE-IRIS',
  'GROVE-OAK7',
]);

function buildSeedSanctuaries() {
  return {};
}

function buildSeedMarketplace() {
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

function buildSeedChat() {
  return [];
}

function purgeGeneratedGroves(database) {
  if (!database || !database.sanctuaries) return;
  for (const code of GENERATED_GROVE_CODES) {
    delete database.sanctuaries[code];
  }
  for (const s of Object.values(database.sanctuaries)) {
    if (s && Array.isArray(s.savedFriends)) {
      s.savedFriends = s.savedFriends.filter((code) => !GENERATED_GROVE_CODES.has(code));
    }
  }
  if (Array.isArray(database.chat)) {
    database.chat = database.chat.filter(
      (msg) => !msg || !String(msg.id || '').startsWith('chat-seed-'),
    );
  }
}

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sanctuaries && Array.isArray(parsed.marketplace) && Array.isArray(parsed.chat)) {
        // Normalize inventories, gridSize, and 10-minute crop grow times on loaded saves
        for (const [code, s] of Object.entries(parsed.sanctuaries)) {
          if (GENERATED_GROVE_CODES.has(code)) {
            delete parsed.sanctuaries[code];
            continue;
          }
          if (s && typeof s === 'object') {
            s.gridSize = s.gridSize === 24 ? 24 : s.gridSize === 18 ? 18 : 12;
            if (Array.isArray(s.crops)) {
              s.crops = s.crops.map((c) => (c && typeof c === 'object' ? { ...c, growDurationMs: 600000 } : c));
            }
            s.inventory = createEmptyInventory(s.inventory || {});
            s.prestige = computePrestige(s);
            parsed.sanctuaries[code] = s;
          }
        }
        if (!Array.isArray(parsed.directTrades)) parsed.directTrades = [];
        if (!Array.isArray(parsed.adminAuditLog)) parsed.adminAuditLog = [];
        purgeGeneratedGroves(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not load sanctuary-db.json, initializing fresh database:', err);
  }
  return {
    sanctuaries: buildSeedSanctuaries(),
    marketplace: buildSeedMarketplace(),
    chat: buildSeedChat(),
    directTrades: [],
    adminAuth: null,
    adminAuditLog: [],
  };
}

let db = loadDatabase();
let saveTimer = null;

function flushDatabaseNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH);
  } catch (err) {
    console.warn('Database disk persistence skipped (using in-memory store):', err?.message || err);
  }
}

function persistDatabase() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    flushDatabaseNow();
  }, 250);
  if (typeof saveTimer.unref === 'function') {
    saveTimer.unref();
  }
}

function buildLeaderboard() {
  const list = Object.values(db.sanctuaries)
    .filter((s) => s && !GENERATED_GROVE_CODES.has(s.syncCode))
    .map((s) => ({
      syncCode: s.syncCode,
      keeperName: s.keeperName,
      sanctuaryName: s.sanctuaryName,
      avatarSpecies: VALID_SPECIES.has(s.avatarSpecies) ? s.avatarSpecies : 'raccoon',
      level: s.level,
      prestige: computePrestige(s),
      exoticCount: Array.isArray(s.enclosures) ? s.enclosures.filter((e) => e.variant === 'exotic').length : 0,
      animalCount: Array.isArray(s.enclosures) ? s.enclosures.length : 0,
    }));
  list.sort((a, b) => b.prestige - a.prestige);
  return list.slice(0, 30).map((entry, idx) => ({
    rank: idx + 1,
    ...entry,
  }));
}

function buildCommunitySummaries() {
  return Object.values(db.sanctuaries)
    .filter((s) => s && !GENERATED_GROVE_CODES.has(s.syncCode))
    .map((s) => ({
      syncCode: s.syncCode,
      keeperName: s.keeperName,
      sanctuaryName: s.sanctuaryName,
      avatarSpecies: VALID_SPECIES.has(s.avatarSpecies) ? s.avatarSpecies : 'raccoon',
      level: s.level,
      prestige: computePrestige(s),
      animalCount: Array.isArray(s.enclosures) ? s.enclosures.length : 0,
      decorCount: Array.isArray(s.decorations) ? s.decorations.length : 0,
      updatedAt: s.updatedAt || Date.now(),
    }))
    .sort((a, b) => b.prestige - a.prestige)
    .slice(0, 24);
}

export async function startServer() {
  const serverStartedAt = Date.now();
  let mysqlStore = null;
  if (MysqlSanctuaryStore.hasConfig()) {
    try {
      mysqlStore = await MysqlSanctuaryStore.create();
      if (mysqlStore) {
        const loaded = await mysqlStore.loadAll(
          buildSeedSanctuaries(),
          buildSeedMarketplace(),
          buildSeedChat(),
        );
        db = {
          ...loaded,
          directTrades: Array.isArray(db.directTrades) ? db.directTrades : [],
          adminAuth: null,
          adminAuditLog: [],
        };
        purgeGeneratedGroves(db);
        console.log('Wildgrove Sanctuary connected to MySQL database (wg_* tables ready).');
      }
    } catch (err) {
      if (mysqlStore) {
        await mysqlStore.close().catch(() => {});
      }
      const code = err?.code || err?.message || 'unreachable';
      console.log(
        `Wildgrove Sanctuary: MySQL unavailable (${code}); using local JSON store (data/sanctuary-db.json).`,
      );
      mysqlStore = null;
    }
  }

  const adminAuth = createAdminAuthManager({
    getStoredAuth: async () => {
      if (mysqlStore) {
        try {
          return await mysqlStore.getAdminConfig('auth');
        } catch (err) {
          console.warn('MySQL admin auth read error:', err?.code || err?.message);
          return null;
        }
      }
      return db.adminAuth || null;
    },
    saveStoredAuth: async (authRecord) => {
      if (mysqlStore) {
        await mysqlStore.saveAdminConfig('auth', authRecord);
      } else {
        db.adminAuth = authRecord;
        flushDatabaseNow();
      }
    },
  });

  if (!Array.isArray(db.adminAuditLog)) db.adminAuditLog = [];
  if (mysqlStore) {
    try {
      const savedLog = await mysqlStore.getAdminConfig('audit_log');
      if (Array.isArray(savedLog)) {
        db.adminAuditLog = savedLog.slice(0, 60);
      }
    } catch {
      // Ignore optional audit load error
    }
  }

  const recordAdminAudit = async (actor, action, detail) => {
    const entry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      actor: sanitizeText(actor, 32, 'Admin'),
      action: sanitizeText(action, 48, 'action'),
      detail: sanitizeText(detail, 180, ''),
    };
    if (!Array.isArray(db.adminAuditLog)) db.adminAuditLog = [];
    db.adminAuditLog.unshift(entry);
    db.adminAuditLog = db.adminAuditLog.slice(0, 60);
    if (mysqlStore) {
      try {
        await mysqlStore.saveAdminConfig('audit_log', db.adminAuditLog);
      } catch {
        // Non-blocking audit persistence
      }
    } else {
      persistDatabase();
    }
    return entry;
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '512kb' }));

  const server = http.createServer(app);
  server.keepAliveTimeout = 15000;
  server.headersTimeout = 20000;

  const MAX_WS_CLIENTS = 100;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
  });

  server.on('upgrade', (request, socket, head) => {
    try {
      const pathname = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`).pathname;
      if (pathname === '/ws') {
        if (wss.clients.size >= MAX_WS_CLIENTS) {
          socket.write('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((client) => {
      if (client.isAlive === false) {
        client.terminate();
        return;
      }
      client.isAlive = false;
      try {
        client.ping();
      } catch {
        client.terminate();
      }
    });
  }, 30000);
  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }

  const broadcast = (payload) => {
    const encoded = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    });
  };

  wss.on('connection', (ws) => {
    let lastChatAt = 0;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.send(
      JSON.stringify({
        type: 'init',
        onlineCount: wss.clients.size,
        chat: db.chat.slice(-50),
        marketplace: db.marketplace,
        leaderboard: buildLeaderboard(),
      }),
    );

    broadcast({ type: 'presence', onlineCount: wss.clients.size });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg && msg.type === 'chat:send' && typeof msg.text === 'string') {
          const now = Date.now();
          if (now - lastChatAt < 350) return;
          lastChatAt = now;

          const cleanText = sanitizeText(msg.text, 220);
          if (!cleanText) return;

          const chatMsg = {
            id:
              typeof msg.id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(msg.id)
                ? msg.id
                : `chat-${now}-${Math.random().toString(36).slice(2, 6)}`,
            senderCode: sanitizeCode(msg.senderCode || 'GUEST') || 'GUEST',
            senderName: sanitizeText(msg.senderName, 28, 'Keeper'),
            avatarSpecies: VALID_SPECIES.has(msg.avatarSpecies) ? msg.avatarSpecies : 'raccoon',
            text: cleanText,
            tag: ['general', 'trade', 'visit', 'milestone'].includes(msg.tag) ? msg.tag : 'general',
            timestamp: now,
          };

          if (!db.chat.some((c) => c.id === chatMsg.id)) {
            db.chat.push(chatMsg);
            if (db.chat.length > 80) db.chat = db.chat.slice(-80);
            if (mysqlStore) {
              mysqlStore.insertChat(chatMsg).catch((err) => {
                console.warn('MySQL chat write error:', err?.code || err?.message);
              });
            } else {
              persistDatabase();
            }
            broadcast({ type: 'chat:message', message: chatMsg });
          }
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      broadcast({ type: 'presence', onlineCount: wss.clients.size });
    });
  });

  // --- Healthcheck ---
  app.get('/api/health', (_req, res) => {
    return res.json({
      ok: true,
      service: 'wildgrove-sanctuary',
      storage: mysqlStore ? 'mysql' : 'file',
      online: wss.clients.size,
      sanctuaries: Object.keys(db.sanctuaries).length,
    });
  });

  // --- Cloud Sync API ---
  app.get('/api/sync/:code', async (req, res) => {
    const code = sanitizeCode(req.params.code);
    if (code.length < 4 || GENERATED_GROVE_CODES.has(code)) {
      return res.status(404).json({ error: 'Sanctuary sync code not found' });
    }
    let record = db.sanctuaries[code] || null;
    if (mysqlStore) {
      try {
        const fresh = await mysqlStore.getSanctuary(code);
        if (fresh) {
          record = fresh;
          db.sanctuaries[code] = fresh;
        }
      } catch (err) {
        console.warn('MySQL sync read error:', err?.code || err?.message);
      }
    }
    if (!record) {
      return res.status(404).json({ error: 'Sanctuary sync code not found' });
    }
    return res.json({ sanctuary: record });
  });

  app.put('/api/sync/:code', async (req, res) => {
    const code = sanitizeCode(req.params.code);
    if (code.length < 4) {
      return res.status(400).json({ error: 'Invalid sync code' });
    }
    const incoming = req.body?.sanctuary;
    if (!incoming || typeof incoming !== 'object' || !Array.isArray(incoming.enclosures) || !Array.isArray(incoming.decorations)) {
      return res.status(400).json({ error: 'Invalid sanctuary payload' });
    }
    const sanitized = sanitizeSanctuary(code, incoming);
    db.sanctuaries[code] = sanitized;
    if (mysqlStore) {
      try {
        await mysqlStore.upsertSanctuary(sanitized);
      } catch (err) {
        console.warn('MySQL sync write error:', err?.code || err?.message);
      }
    } else {
      persistDatabase();
    }
    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    return res.json({ ok: true, sanctuary: sanitized });
  });

  // --- Community & Visiting Sanctuaries API ---
  app.get('/api/sanctuaries', (_req, res) => {
    return res.json({ sanctuaries: buildCommunitySummaries() });
  });

  app.post('/api/sanctuaries/:code/visit-gift', async (req, res) => {
    const code = sanitizeCode(req.params.code);
    const visitorName = sanitizeText(req.body?.visitorName, 28, 'A Fellow Keeper');
    const visitorCode = sanitizeCode(req.body?.visitorCode || 'GUEST') || 'GUEST';
    const enclosureId = sanitizeText(req.body?.enclosureId, 64, '');
    const guestbookMessage = sanitizeText(req.body?.guestbookMessage || '', 140, '');
    const target = db.sanctuaries[code];
    if (!target) {
      return res.status(404).json({ error: 'Sanctuary not found' });
    }
    const enc = target.enclosures.find((e) => e.id === enclosureId) || target.enclosures[0];
    if (enc) {
      enc.visitorHearts = (enc.visitorHearts || 0) + 1;
      enc.happiness = Math.min(100, (enc.happiness || 80) + 6);
    }
    if (guestbookMessage) {
      if (!Array.isArray(target.guestbook)) target.guestbook = [];
      target.guestbook.unshift({
        id: `gb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        authorName: visitorName,
        authorCode: visitorCode,
        message: guestbookMessage,
        timestamp: Date.now(),
      });
      target.guestbook = target.guestbook.slice(0, 40);
    }
    target.prestige = computePrestige(target);
    target.updatedAt = Date.now();
    if (mysqlStore) {
      try {
        await mysqlStore.upsertSanctuary(target);
      } catch (err) {
        console.warn('MySQL visit-gift write error:', err?.code || err?.message);
      }
    } else {
      persistDatabase();
    }

    broadcast({
      type: 'sanctuary:gift',
      targetCode: code,
      visitorName,
      enclosureName: enc?.name || 'your animals',
    });
    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    return res.json({ ok: true, sanctuary: target });
  });

  // --- Marketplace API ---
  app.get('/api/marketplace', (_req, res) => {
    return res.json({ listings: db.marketplace });
  });

  app.post('/api/marketplace', async (req, res) => {
    const { sellerCode, sellerName, itemType, itemId, itemLabel, quantity, priceCoins, priceGems, rarity } = req.body || {};
    const cleanSeller = sanitizeCode(sellerCode);
    const cleanItemId = sanitizeText(itemId, 48);
    const cleanLabel = sanitizeText(itemLabel, 48);
    if (cleanSeller.length < 4 || !cleanItemId || !cleanLabel) {
      return res.status(400).json({ error: 'Missing required listing fields' });
    }
    if (itemType === 'resource' && !VALID_RESOURCES.has(cleanItemId)) {
      return res.status(400).json({ error: 'Unknown resource item' });
    }

    const listing = {
      id: `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sellerCode: cleanSeller,
      sellerName: sanitizeText(sellerName, 28, 'Keeper'),
      itemType: itemType === 'decor' || itemType === 'exotic_license' ? itemType : 'resource',
      itemId: cleanItemId,
      itemLabel: cleanLabel,
      quantity: clampInt(quantity, 1, 20, 1),
      priceCoins: clampInt(priceCoins, 10, 10000, 50),
      priceGems: clampInt(priceGems, 0, 200, 0),
      rarity: rarity === 'rare' || rarity === 'exotic' ? rarity : 'common',
      createdAt: Date.now(),
    };

    db.marketplace.unshift(listing);
    if (db.marketplace.length > 40) db.marketplace = db.marketplace.slice(0, 40);
    if (mysqlStore) {
      try {
        await mysqlStore.upsertListing(listing);
      } catch (err) {
        console.warn('MySQL marketplace write error:', err?.code || err?.message);
      }
    } else {
      persistDatabase();
    }

    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, listing });
  });

  app.post('/api/marketplace/:id/buy', async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const buyerCode = sanitizeCode(req.body?.buyerCode || '');
    const idx = db.marketplace.findIndex((l) => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Listing already sold or removed' });
    }
    const listing = db.marketplace[idx];
    if (buyerCode && listing.sellerCode === buyerCode) {
      return res.status(400).json({ error: 'Cannot buy your own listing' });
    }
    db.marketplace.splice(idx, 1);

    const seller = db.sanctuaries[listing.sellerCode];
    if (seller) {
      seller.coins = (seller.coins || 0) + listing.priceCoins;
      seller.gems = (seller.gems || 0) + listing.priceGems;
      if (seller.stats) {
        seller.stats.totalTrades = (seller.stats.totalTrades || 0) + 1;
      }
    }

    let refillListing = null;
    if (db.marketplace.length < 4) {
      const refills = buildSeedMarketplace();
      const pick = refills[Math.floor(Math.random() * refills.length)];
      refillListing = { ...pick, id: `mkt-r-${Date.now()}`, createdAt: Date.now() };
      db.marketplace.push(refillListing);
    }

    if (mysqlStore) {
      try {
        await mysqlStore.deleteListing(listing.id);
        if (seller) await mysqlStore.upsertSanctuary(seller);
        if (refillListing) await mysqlStore.upsertListing(refillListing);
      } catch (err) {
        console.warn('MySQL marketplace buy error:', err?.code || err?.message);
      }
    } else {
      persistDatabase();
    }
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, purchased: listing });
  });

  app.delete('/api/marketplace/:id', async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const sellerCode = sanitizeCode(req.query?.sellerCode || req.body?.sellerCode || '');
    const idx = db.marketplace.findIndex((l) => l.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    const listing = db.marketplace[idx];
    if (!sellerCode || listing.sellerCode !== sellerCode) {
      return res.status(403).json({ error: 'Only the seller can cancel this listing' });
    }
    db.marketplace.splice(idx, 1);
    if (mysqlStore) {
      try {
        await mysqlStore.deleteListing(listing.id);
      } catch (err) {
        console.warn('MySQL marketplace delete error:', err?.code || err?.message);
      }
    } else {
      persistDatabase();
    }
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, cancelled: listing });
  });

  // --- Direct Player-to-Player Trade Offers ---
  app.get('/api/trades/:code', (req, res) => {
    const code = sanitizeCode(req.params.code);
    if (!Array.isArray(db.directTrades)) db.directTrades = [];
    const list = db.directTrades.filter(
      (t) => t.status === 'pending' && (t.toCode === code || t.fromCode === code),
    );
    return res.json({ trades: list });
  });

  app.post('/api/trades', (req, res) => {
    const { fromCode, fromName, toCode, resourceId, itemLabel, quantity, askingCoins, note } = req.body || {};
    const cleanFrom = sanitizeCode(fromCode);
    const cleanTo = sanitizeCode(toCode);
    const cleanRes = sanitizeText(resourceId, 48);
    if (cleanFrom.length < 4 || cleanTo.length < 4 || cleanFrom === cleanTo || !VALID_RESOURCES.has(cleanRes)) {
      return res.status(400).json({ error: 'Invalid direct trade parameters' });
    }
    if (!Array.isArray(db.directTrades)) db.directTrades = [];
    const offer = {
      id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromCode: cleanFrom,
      fromName: sanitizeText(fromName, 28, 'Keeper'),
      toCode: cleanTo,
      resourceId: cleanRes,
      itemLabel: sanitizeText(itemLabel, 48, cleanRes),
      quantity: clampInt(quantity, 1, 20, 1),
      askingCoins: clampInt(askingCoins, 0, 10000, 0),
      note: sanitizeText(note || '', 100),
      status: 'pending',
      createdAt: Date.now(),
    };
    db.directTrades.unshift(offer);
    if (db.directTrades.length > 100) db.directTrades = db.directTrades.slice(0, 100);
    persistDatabase();
    return res.json({ ok: true, offer });
  });

  app.post('/api/trades/:id/respond', async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const responderCode = sanitizeCode(req.body?.responderCode || '');
    const action = req.body?.action === 'accept' ? 'accept' : 'decline';
    if (!Array.isArray(db.directTrades)) db.directTrades = [];
    const offer = db.directTrades.find((t) => t.id === id && t.status === 'pending');
    if (!offer) {
      return res.status(404).json({ error: 'Trade offer not found or already resolved' });
    }
    if (offer.toCode !== responderCode && !(action === 'decline' && offer.fromCode === responderCode)) {
      return res.status(403).json({ error: 'Not authorized for this trade offer' });
    }
    offer.status = action === 'accept' ? 'accepted' : 'declined';
    if (action === 'accept' && offer.askingCoins > 0) {
      const sender = db.sanctuaries[offer.fromCode];
      if (sender) {
        sender.coins = (sender.coins || 0) + offer.askingCoins;
        if (mysqlStore) {
          mysqlStore.upsertSanctuary(sender).catch(() => {});
        }
      }
    }
    persistDatabase();
    return res.json({ ok: true, offer });
  });

  // --- Leaderboard & Chat REST Fallbacks ---
  app.get('/api/leaderboard', (_req, res) => {
    return res.json({ leaderboard: buildLeaderboard() });
  });

  app.get('/api/chat', (_req, res) => {
    return res.json({ messages: db.chat.slice(-50) });
  });

  // =========================================================================
  // --- Backend Admin API (/api/admin/*) ---
  // =========================================================================
  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
  });

  app.get('/api/admin/status', async (_req, res) => {
    const status = await adminAuth.getStatus();
    return res.json(status);
  });

  app.post('/api/admin/setup', async (req, res) => {
    const { username, password } = req.body || {};
    const result = await adminAuth.claimInitialAdmin(username, password);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    await recordAdminAudit(result.username, 'admin.setup', 'Initial admin credentials configured on server');
    return res.json({
      ok: true,
      token: result.token,
      username: result.username,
      authMode: 'claimed',
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    const result = await adminAuth.authenticate(req, username, password);
    if (!result.ok) {
      return res.status(result.status || 401).json({ error: result.error });
    }
    await recordAdminAudit(result.username, 'admin.login', 'Signed in to Admin Console');
    return res.json({
      ok: true,
      token: result.token,
      username: result.username,
      authMode: result.authMode,
      expiresAt: result.expiresAt,
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    adminAuth.revokeBearerToken(req.headers.authorization);
    return res.json({ ok: true });
  });

  app.get('/api/admin/session', adminAuth.requireAdminAuth, async (req, res) => {
    const status = await adminAuth.getStatus();
    return res.json({
      ok: true,
      username: req.adminUser.username,
      authMode: status.authMode,
      expiresAt: req.adminUser.expiresAt,
    });
  });

  app.post('/api/admin/change-password', adminAuth.requireAdminAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const result = await adminAuth.rotatePassword(currentPassword, newPassword);
    if (!result.ok) {
      return res.status(result.status || 400).json({ error: result.error });
    }
    await recordAdminAudit(req.adminUser.username, 'admin.password_changed', 'Rotated admin password and refreshed sessions');
    return res.json({
      ok: true,
      token: result.token,
      username: result.username,
      expiresAt: result.expiresAt,
    });
  });

  app.get('/api/admin/overview', adminAuth.requireAdminAuth, async (_req, res) => {
    const sanctuariesList = Object.values(db.sanctuaries || {}).filter(
      (s) => s && !GENERATED_GROVE_CODES.has(s.syncCode),
    );
    let totalAnimals = 0;
    let totalCrops = 0;
    let totalDecorations = 0;
    let totalCoins = 0;
    let totalGems = 0;
    for (const s of sanctuariesList) {
      totalAnimals += Array.isArray(s.enclosures) ? s.enclosures.length : 0;
      totalCrops += Array.isArray(s.crops) ? s.crops.length : 0;
      totalDecorations += Array.isArray(s.decorations) ? s.decorations.length : 0;
      totalCoins += Number(s.coins || 0);
      totalGems += Number(s.gems || 0);
    }
    const status = await adminAuth.getStatus();
    return res.json({
      storage: mysqlStore ? 'mysql' : 'file',
      authMode: status.authMode,
      uptimeSec: Math.floor((Date.now() - serverStartedAt) / 1000),
      onlineClients: wss.clients.size,
      sanctuaryCount: sanctuariesList.length,
      totalAnimals,
      totalCrops,
      totalDecorations,
      totalCoins,
      totalGems,
      marketplaceCount: Array.isArray(db.marketplace) ? db.marketplace.length : 0,
      directTradeCount: Array.isArray(db.directTrades)
        ? db.directTrades.filter((t) => t && t.status === 'pending').length
        : 0,
      chatCount: Array.isArray(db.chat) ? db.chat.length : 0,
      auditLog: Array.isArray(db.adminAuditLog) ? db.adminAuditLog.slice(0, 30) : [],
    });
  });

  app.get('/api/admin/sanctuaries', adminAuth.requireAdminAuth, (_req, res) => {
    const list = Object.values(db.sanctuaries || {})
      .filter((s) => s && !GENERATED_GROVE_CODES.has(s.syncCode))
      .map((s) => ({
        syncCode: s.syncCode,
        keeperName: s.keeperName,
        sanctuaryName: s.sanctuaryName,
        avatarSpecies: s.avatarSpecies || 'raccoon',
        level: clampInt(s.level, 1, 999, 1),
        xp: clampInt(s.xp, 0, 1000000, 0),
        coins: clampInt(s.coins, 0, 10000000, 0),
        gems: clampInt(s.gems, 0, 1000000, 0),
        prestige: computePrestige(s),
        gridSize: s.gridSize === 24 ? 24 : s.gridSize === 18 ? 18 : 12,
        animalCount: Array.isArray(s.enclosures) ? s.enclosures.length : 0,
        cropCount: Array.isArray(s.crops) ? s.crops.length : 0,
        decorCount: Array.isArray(s.decorations) ? s.decorations.length : 0,
        updatedAt: s.updatedAt || 0,
        stats: s.stats || {
          totalFeeds: 0,
          totalGrooms: 0,
          totalHarvests: 0,
          totalTrades: 0,
          friendsVisited: 0,
        },
      }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return res.json({ sanctuaries: list });
  });

  app.get('/api/admin/sanctuaries/:code', adminAuth.requireAdminAuth, (req, res) => {
    const code = sanitizeCode(req.params.code);
    const target = db.sanctuaries[code];
    if (!target) {
      return res.status(404).json({ error: 'Sanctuary not found.' });
    }
    return res.json({ sanctuary: target });
  });

  app.patch('/api/admin/sanctuaries/:code', adminAuth.requireAdminAuth, async (req, res) => {
    const code = sanitizeCode(req.params.code);
    const target = db.sanctuaries[code];
    if (!target) {
      return res.status(404).json({ error: 'Sanctuary not found.' });
    }
    const body = req.body || {};
    const changes = [];
    if (typeof body.keeperName === 'string' && body.keeperName.trim()) {
      target.keeperName = sanitizeText(body.keeperName, 28, target.keeperName);
      changes.push(`keeper=${target.keeperName}`);
    }
    if (typeof body.sanctuaryName === 'string' && body.sanctuaryName.trim()) {
      target.sanctuaryName = sanitizeText(body.sanctuaryName, 36, target.sanctuaryName);
      changes.push(`name=${target.sanctuaryName}`);
    }
    if (body.coins !== undefined) {
      target.coins = clampInt(body.coins, 0, 10000000, target.coins);
      changes.push(`coins=${target.coins}`);
    }
    if (body.gems !== undefined) {
      target.gems = clampInt(body.gems, 0, 1000000, target.gems);
      changes.push(`gems=${target.gems}`);
    }
    if (body.level !== undefined) {
      target.level = clampInt(body.level, 1, 999, target.level);
      changes.push(`level=${target.level}`);
    }
    if (body.resetDailyTasks === true) {
      delete target.dailyQuests;
      changes.push('resetDailyTasks');
    }
    target.prestige = computePrestige(target);
    target.updatedAt = Date.now();

    if (mysqlStore) {
      await mysqlStore.upsertSanctuary(target);
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(
      req.adminUser.username,
      'sanctuary.update',
      `Updated ${code}${changes.length ? ` (${changes.join(', ')})` : ''}`,
    );
    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    return res.json({ ok: true, sanctuary: target });
  });

  app.delete('/api/admin/sanctuaries/:code', adminAuth.requireAdminAuth, async (req, res) => {
    const code = sanitizeCode(req.params.code);
    const target = db.sanctuaries[code];
    if (!target) {
      return res.status(404).json({ error: 'Sanctuary not found.' });
    }
    const label = `${target.sanctuaryName} (${code})`;
    delete db.sanctuaries[code];

    // Clean up marketplace listings, direct trades, and saved friend references for this sanctuary
    db.marketplace = (db.marketplace || []).filter((l) => l.sellerCode !== code);
    db.directTrades = (db.directTrades || []).filter(
      (t) => t.fromCode !== code && t.toCode !== code,
    );
    for (const s of Object.values(db.sanctuaries)) {
      if (s && Array.isArray(s.savedFriends)) {
        s.savedFriends = s.savedFriends.filter((fc) => fc !== code);
      }
    }

    if (mysqlStore) {
      await mysqlStore.deleteSanctuary(code);
      await mysqlStore.deleteListingsBySeller(code);
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(req.adminUser.username, 'sanctuary.delete', `Deleted sanctuary ${label}`);
    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, deletedCode: code });
  });

  app.get('/api/admin/chat', adminAuth.requireAdminAuth, (_req, res) => {
    return res.json({ messages: Array.isArray(db.chat) ? db.chat.slice(-80) : [] });
  });

  app.delete('/api/admin/chat/:id', adminAuth.requireAdminAuth, async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const before = db.chat.length;
    db.chat = db.chat.filter((m) => m.id !== id);
    if (db.chat.length === before) {
      return res.status(404).json({ error: 'Chat message not found.' });
    }
    if (mysqlStore) {
      await mysqlStore.deleteChat(id);
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(req.adminUser.username, 'chat.delete', `Deleted chat message ${id}`);
    broadcast({ type: 'chat:sync', messages: db.chat.slice(-50) });
    return res.json({ ok: true, deletedId: id });
  });

  app.post('/api/admin/chat/clear', adminAuth.requireAdminAuth, async (req, res) => {
    const count = db.chat.length;
    db.chat = [];
    if (mysqlStore) {
      await mysqlStore.clearChat();
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(req.adminUser.username, 'chat.clear', `Cleared ${count} chat messages`);
    broadcast({ type: 'chat:sync', messages: [] });
    return res.json({ ok: true, cleared: count });
  });

  app.post('/api/admin/broadcast', adminAuth.requireAdminAuth, async (req, res) => {
    const cleanText = sanitizeText(req.body?.text, 220);
    if (!cleanText) {
      return res.status(400).json({ error: 'Announcement text is required.' });
    }
    const now = Date.now();
    const chatMsg = {
      id: `chat-admin-${now}-${Math.random().toString(36).slice(2, 6)}`,
      senderCode: 'SYSTEM',
      senderName: 'Wildgrove Admin',
      avatarSpecies: 'golden_fox',
      text: cleanText,
      tag: 'milestone',
      timestamp: now,
    };
    db.chat.push(chatMsg);
    if (db.chat.length > 80) db.chat = db.chat.slice(-80);
    if (mysqlStore) {
      await mysqlStore.insertChat(chatMsg);
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(req.adminUser.username, 'chat.broadcast', cleanText.slice(0, 120));
    broadcast({ type: 'chat:message', message: chatMsg });
    return res.json({ ok: true, message: chatMsg });
  });

  app.get('/api/admin/marketplace', adminAuth.requireAdminAuth, (_req, res) => {
    return res.json({ listings: Array.isArray(db.marketplace) ? db.marketplace : [] });
  });

  app.delete('/api/admin/marketplace/:id', adminAuth.requireAdminAuth, async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    const before = db.marketplace.length;
    db.marketplace = db.marketplace.filter((l) => l.id !== id);
    if (db.marketplace.length === before) {
      return res.status(404).json({ error: 'Marketplace listing not found.' });
    }
    if (mysqlStore) {
      await mysqlStore.deleteListing(id);
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(req.adminUser.username, 'marketplace.delete', `Removed listing ${id}`);
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, deletedId: id });
  });

  app.post('/api/admin/marketplace/reset', adminAuth.requireAdminAuth, async (req, res) => {
    const reseed = req.body?.reseed !== false;
    db.marketplace = reseed ? buildSeedMarketplace() : [];
    if (mysqlStore) {
      await mysqlStore.clearMarketplace();
      for (const item of db.marketplace) {
        await mysqlStore.upsertListing(item);
      }
    } else {
      flushDatabaseNow();
    }
    await recordAdminAudit(
      req.adminUser.username,
      'marketplace.reset',
      reseed ? 'Reset and reseeded marketplace listings' : 'Cleared all marketplace listings',
    );
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, listings: db.marketplace });
  });

  app.get('/api/admin/trades', adminAuth.requireAdminAuth, (_req, res) => {
    return res.json({ trades: Array.isArray(db.directTrades) ? db.directTrades : [] });
  });

  app.delete('/api/admin/trades/:id', adminAuth.requireAdminAuth, async (req, res) => {
    const id = sanitizeText(req.params.id, 64);
    if (!Array.isArray(db.directTrades)) db.directTrades = [];
    const before = db.directTrades.length;
    db.directTrades = db.directTrades.filter((t) => t.id !== id);
    if (db.directTrades.length === before) {
      return res.status(404).json({ error: 'Trade offer not found.' });
    }
    if (!mysqlStore) flushDatabaseNow();
    await recordAdminAudit(req.adminUser.username, 'trade.delete', `Removed direct trade ${id}`);
    return res.json({ ok: true, deletedId: id });
  });

  app.get('/api/admin/export', adminAuth.requireAdminAuth, async (req, res) => {
    await recordAdminAudit(req.adminUser.username, 'server.export', 'Downloaded JSON server snapshot');
    return res.json({
      exportedAt: new Date().toISOString(),
      storage: mysqlStore ? 'mysql' : 'file',
      sanctuaries: db.sanctuaries || {},
      marketplace: db.marketplace || [],
      chat: db.chat || [],
      directTrades: db.directTrades || [],
    });
  });

  app.post('/api/admin/reset-server', adminAuth.requireAdminAuth, async (req, res) => {
    const {
      confirmPhrase,
      resetSanctuaries = true,
      resetMarketplace = true,
      resetChat = true,
      resetTrades = true,
      reseedMarketplace = true,
    } = req.body || {};

    if (String(confirmPhrase || '').trim() !== 'RESET WILDGROVE') {
      return res.status(400).json({
        error: 'Confirmation phrase mismatch. Type RESET WILDGROVE exactly to proceed.',
      });
    }

    const summary = [];
    if (resetSanctuaries) {
      const n = Object.keys(db.sanctuaries || {}).length;
      db.sanctuaries = buildSeedSanctuaries();
      if (mysqlStore) await mysqlStore.clearSanctuaries();
      summary.push(`${n} sanctuaries cleared`);
    }
    if (resetMarketplace) {
      db.marketplace = reseedMarketplace ? buildSeedMarketplace() : [];
      if (mysqlStore) {
        await mysqlStore.clearMarketplace();
        for (const item of db.marketplace) {
          await mysqlStore.upsertListing(item);
        }
      }
      summary.push(reseedMarketplace ? 'marketplace reseeded' : 'marketplace cleared');
    }
    if (resetChat) {
      const n = (db.chat || []).length;
      db.chat = buildSeedChat();
      if (mysqlStore) await mysqlStore.clearChat();
      summary.push(`${n} chat messages cleared`);
    }
    if (resetTrades) {
      const n = (db.directTrades || []).length;
      db.directTrades = [];
      summary.push(`${n} direct trades cleared`);
    }

    if (!mysqlStore) {
      flushDatabaseNow();
    }

    await recordAdminAudit(
      req.adminUser.username,
      'server.reset',
      `Server reset executed: ${summary.join(', ') || 'no scopes selected'}`,
    );

    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    broadcast({ type: 'chat:sync', messages: db.chat.slice(-50) });

    return res.json({
      ok: true,
      summary,
    });
  });

  // Return clean JSON 404 for unknown API routes
  app.use('/api', (_req, res) => {
    return res.status(404).json({ error: 'API route not found' });
  });

  // --- Frontend Serving (Dev Vite Middleware vs Production Static dist/) ---
  // Only load Vite in explicit development mode so production servers never
  // spawn bundler or file-watcher threads on shared hosting.
  const shouldUseViteDev = process.env.NODE_ENV === 'development';

  if (shouldUseViteDev) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      root: ROOT_DIR,
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: !disableHmr,
        ws: { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(DIST_DIR, {
        maxAge: '1h',
        index: 'index.html',
      }),
    );

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return next();
      }
      if (fs.existsSync(INDEX_HTML_PATH)) {
        return res.sendFile(INDEX_HTML_PATH);
      }
      return res
        .status(503)
        .send('Wildgrove Sanctuary frontend build not found. Please run npm run build before starting.');
    });
  }

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    clearInterval(heartbeatInterval);
    if (!mysqlStore) {
      flushDatabaseNow();
    } else {
      mysqlStore.close().catch(() => {});
    }

    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {
        // Ignore
      }
    });
    wss.close();

    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    server.close(() => {
      process.exit(0);
    });

    const forceTimer = setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      process.exit(0);
    }, 2500);
    if (typeof forceTimer.unref === 'function') {
      forceTimer.unref();
    }
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Wildgrove Sanctuary server listening on http://0.0.0.0:${PORT} (${shouldUseViteDev ? 'vite-dev' : 'production-static'})`,
    );
  });

  return server;
}
