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
]);

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

  const rawEnclosures = Array.isArray(incoming.enclosures) ? incoming.enclosures.slice(0, 36) : [];
  const enclosures = rawEnclosures
    .filter((e) => e && typeof e === 'object')
    .map((e, idx) => ({
      id: sanitizeText(e.id, 48, `enc-${idx}-${now}`),
      species: VALID_SPECIES.has(e.species) ? e.species : 'raccoon',
      name: sanitizeText(e.name, 28, 'Companion'),
      variant: e.variant === 'exotic' ? 'exotic' : 'classic',
      gridX: clampInt(e.gridX, 0, 10, 0),
      gridZ: clampInt(e.gridZ, 0, 10, 0),
      happiness: clampInt(e.happiness, 0, 100, 80),
      hunger: clampInt(e.hunger, 0, 100, 80),
      grooming: clampInt(e.grooming, 0, 100, 80),
      bondLevel: clampInt(e.bondLevel, 1, 10, 1),
      lastFedAt: clampInt(e.lastFedAt, 0, now + 86400000, now),
      lastGroomedAt: clampInt(e.lastGroomedAt, 0, now + 86400000, now),
      visitorHearts: clampInt(e.visitorHearts, 0, 100000, 0),
    }));

  const rawCrops = Array.isArray(incoming.crops) ? incoming.crops.slice(0, 64) : [];
  const crops = rawCrops
    .filter((c) => c && typeof c === 'object')
    .map((c, idx) => ({
      id: sanitizeText(c.id, 48, `crop-${idx}-${now}`),
      cropType: VALID_CROPS.has(c.cropType) ? c.cropType : 'berry',
      gridX: clampInt(c.gridX, 0, 11, 0),
      gridZ: clampInt(c.gridZ, 0, 11, 0),
      plantedAt: clampInt(c.plantedAt, 0, now + 86400000, now),
      growDurationMs: clampInt(c.growDurationMs, 5000, 86400000, 600000),
    }));

  const rawDecors = Array.isArray(incoming.decorations) ? incoming.decorations.slice(0, 120) : [];
  const decorations = rawDecors
    .filter((d) => d && typeof d === 'object')
    .map((d, idx) => ({
      id: sanitizeText(d.id, 48, `dec-${idx}-${now}`),
      decorType: VALID_DECORS.has(d.decorType) ? d.decorType : 'lantern_post',
      gridX: clampInt(d.gridX, 0, 11, 0),
      gridZ: clampInt(d.gridZ, 0, 11, 0),
      rotation: clampInt(d.rotation, 0, 3, 0),
    }));

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
    enclosures,
    crops,
    decorations,
    inventory: createEmptyInventory(rawInv),
    dailyReward: {
      streak: clampInt(rawDaily.streak, 0, 7, 0),
      lastClaimDate:
        typeof rawDaily.lastClaimDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDaily.lastClaimDate)
          ? rawDaily.lastClaimDate
          : null,
    },
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

function buildSeedSanctuaries() {
  const now = Date.now();
  const seeds = [
    {
      syncCode: 'GROVE-LUNA',
      keeperName: 'Maren',
      sanctuaryName: 'Silverpine Haven',
      avatarSpecies: 'wolf',
      level: 7,
      xp: 410,
      coins: 2450,
      gems: 62,
      prestige: 0,
      enclosures: [
        {
          id: 'maren-e1',
          species: 'wolf',
          name: 'Freya',
          variant: 'exotic',
          gridX: 2,
          gridZ: 2,
          happiness: 98,
          hunger: 92,
          grooming: 95,
          bondLevel: 7,
          lastFedAt: now - 60000,
          lastGroomedAt: now - 90000,
          visitorHearts: 18,
        },
        {
          id: 'maren-e2',
          species: 'butterfly',
          name: 'Celeste',
          variant: 'exotic',
          gridX: 7,
          gridZ: 2,
          happiness: 95,
          hunger: 90,
          grooming: 94,
          bondLevel: 6,
          lastFedAt: now - 50000,
          lastGroomedAt: now - 80000,
          visitorHearts: 14,
        },
        {
          id: 'maren-e3',
          species: 'snow_leopard',
          name: 'Nova',
          variant: 'exotic',
          gridX: 2,
          gridZ: 7,
          happiness: 94,
          hunger: 89,
          grooming: 92,
          bondLevel: 6,
          lastFedAt: now - 70000,
          lastGroomedAt: now - 110000,
          visitorHearts: 12,
        },
        {
          id: 'maren-e4',
          species: 'raccoon',
          name: 'Mochi',
          variant: 'exotic',
          gridX: 7,
          gridZ: 7,
          happiness: 96,
          hunger: 91,
          grooming: 94,
          bondLevel: 6,
          lastFedAt: now - 40000,
          lastGroomedAt: now - 80000,
          visitorHearts: 15,
        },
      ],
      crops: [
        { id: 'mc1', cropType: 'herb', gridX: 5, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'mc2', cropType: 'lavender', gridX: 6, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'mc3', cropType: 'ice_fish', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'mc4', cropType: 'berry', gridX: 6, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'md1', decorType: 'gazebo', gridX: 5, gridZ: 1, rotation: 0 },
        { id: 'md2', decorType: 'fountain', gridX: 5, gridZ: 6, rotation: 0 },
        { id: 'md3', decorType: 'koi_pond', gridX: 6, gridZ: 6, rotation: 1 },
        { id: 'md4', decorType: 'autumn_maple', gridX: 0, gridZ: 4, rotation: 0 },
        { id: 'md5', decorType: 'autumn_maple', gridX: 10, gridZ: 4, rotation: 2 },
        { id: 'md6', decorType: 'lantern_post', gridX: 4, gridZ: 3, rotation: 0 },
        { id: 'md7', decorType: 'lantern_post', gridX: 7, gridZ: 5, rotation: 1 },
        { id: 'md8', decorType: 'flower_arch', gridX: 5, gridZ: 8, rotation: 0 },
        { id: 'md9', decorType: 'willow', gridX: 0, gridZ: 9, rotation: 0 },
        { id: 'md10', decorType: 'bamboo', gridX: 10, gridZ: 9, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 12,
        mango_treat: 10,
        nectar_treat: 11,
        herb_treat: 14,
        bamboo_shoot_treat: 6,
        fox_berry_treat: 5,
        ice_fish_treat: 8,
        river_reed_treat: 5,
        lucky_acorn: 6,
        silverback_amber: 5,
        wing_dust: 7,
        moonstone_pelt: 8,
        lantern_charm: 9,
        fire_tail_charm: 4,
        sun_crystal: 4,
        frost_pelt: 6,
        river_pearl: 4,
      }),
      dailyReward: { streak: 6, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 340, claimedMilestones: ['m1', 'm2', 'm3'] },
      unlockedAchievements: ['four_species', 'exotic_collector', 'master_caretaker', 'grand_landscape'],
      stats: { totalFeeds: 42, totalGrooms: 38, totalHarvests: 61, totalTrades: 14, friendsVisited: 9 },
      updatedAt: now - 300000,
    },
    {
      syncCode: 'GROVE-FERN',
      keeperName: 'Kenji',
      sanctuaryName: 'Emerald Canopy Grove',
      avatarSpecies: 'gorilla',
      level: 5,
      xp: 230,
      coins: 1680,
      gems: 38,
      prestige: 0,
      enclosures: [
        {
          id: 'kenji-e1',
          species: 'gorilla',
          name: 'Kongo',
          variant: 'exotic',
          gridX: 2,
          gridZ: 3,
          happiness: 94,
          hunger: 88,
          grooming: 90,
          bondLevel: 5,
          lastFedAt: now - 100000,
          lastGroomedAt: now - 120000,
          visitorHearts: 12,
        },
        {
          id: 'kenji-e2',
          species: 'red_panda',
          name: 'Pabu',
          variant: 'exotic',
          gridX: 7,
          gridZ: 3,
          happiness: 92,
          hunger: 86,
          grooming: 89,
          bondLevel: 5,
          lastFedAt: now - 110000,
          lastGroomedAt: now - 130000,
          visitorHearts: 10,
        },
        {
          id: 'kenji-e3',
          species: 'river_otter',
          name: 'Ripple',
          variant: 'classic',
          gridX: 3,
          gridZ: 7,
          happiness: 89,
          hunger: 82,
          grooming: 88,
          bondLevel: 4,
          lastFedAt: now - 85000,
          lastGroomedAt: now - 95000,
          visitorHearts: 8,
        },
        {
          id: 'kenji-e4',
          species: 'butterfly',
          name: 'Nectar',
          variant: 'classic',
          gridX: 7,
          gridZ: 7,
          happiness: 92,
          hunger: 86,
          grooming: 90,
          bondLevel: 4,
          lastFedAt: now - 90000,
          lastGroomedAt: now - 100000,
          visitorHearts: 10,
        },
      ],
      crops: [
        { id: 'kc1', cropType: 'mango', gridX: 5, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'kc2', cropType: 'bamboo_shoot', gridX: 6, gridZ: 4, plantedAt: now - 650000, growDurationMs: 600000 },
        { id: 'kc3', cropType: 'river_reed', gridX: 5, gridZ: 5, plantedAt: now - 650000, growDurationMs: 600000 },
      ],
      decorations: [
        { id: 'kd1', decorType: 'bamboo', gridX: 1, gridZ: 3, rotation: 0 },
        { id: 'kd2', decorType: 'bamboo', gridX: 1, gridZ: 4, rotation: 1 },
        { id: 'kd3', decorType: 'bamboo', gridX: 10, gridZ: 3, rotation: 2 },
        { id: 'kd4', decorType: 'koi_pond', gridX: 5, gridZ: 2, rotation: 0 },
        { id: 'kd5', decorType: 'lantern_post', gridX: 4, gridZ: 5, rotation: 0 },
        { id: 'kd6', decorType: 'lantern_post', gridX: 7, gridZ: 5, rotation: 1 },
        { id: 'kd7', decorType: 'gazebo', gridX: 5, gridZ: 8, rotation: 0 },
        { id: 'kd8', decorType: 'autumn_maple', gridX: 10, gridZ: 7, rotation: 0 },
      ],
      inventory: createEmptyInventory({
        berry_treat: 7,
        mango_treat: 15,
        nectar_treat: 6,
        herb_treat: 5,
        bamboo_shoot_treat: 10,
        fox_berry_treat: 4,
        ice_fish_treat: 4,
        river_reed_treat: 9,
        lucky_acorn: 3,
        silverback_amber: 7,
        wing_dust: 2,
        moonstone_pelt: 2,
        lantern_charm: 5,
        fire_tail_charm: 5,
        sun_crystal: 3,
        frost_pelt: 3,
        river_pearl: 6,
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
        mango_treat: 6,
        nectar_treat: 18,
        herb_treat: 7,
        bamboo_shoot_treat: 4,
        fox_berry_treat: 11,
        ice_fish_treat: 4,
        river_reed_treat: 4,
        lucky_acorn: 4,
        silverback_amber: 3,
        wing_dust: 9,
        moonstone_pelt: 3,
        lantern_charm: 7,
        fire_tail_charm: 3,
        sun_crystal: 6,
        frost_pelt: 3,
        river_pearl: 3,
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
        mango_treat: 4,
        nectar_treat: 4,
        herb_treat: 8,
        bamboo_shoot_treat: 3,
        fox_berry_treat: 3,
        ice_fish_treat: 3,
        river_reed_treat: 3,
        lucky_acorn: 5,
        silverback_amber: 2,
        wing_dust: 1,
        moonstone_pelt: 2,
        lantern_charm: 3,
        fire_tail_charm: 2,
        sun_crystal: 2,
        frost_pelt: 2,
        river_pearl: 2,
      }),
      dailyReward: { streak: 3, lastClaimDate: '2026-11-25' },
      seasonalEvent: { eventId: 'autumn-lantern-harvest-2026', lanternPoints: 120, claimedMilestones: ['m1'] },
      unlockedAchievements: ['master_caretaker'],
      stats: { totalFeeds: 18, totalGrooms: 14, totalHarvests: 25, totalTrades: 5, friendsVisited: 3 },
      updatedAt: now - 900000,
    },
  ];

  const map = {};
  for (const s of seeds) {
    s.prestige = computePrestige(s);
    map[s.syncCode] = s;
  }
  return map;
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

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && parsed.sanctuaries && Array.isArray(parsed.marketplace) && Array.isArray(parsed.chat)) {
        // Normalize inventories so older saves include newer resources
        for (const [code, s] of Object.entries(parsed.sanctuaries)) {
          if (s && typeof s === 'object') {
            s.inventory = createEmptyInventory(s.inventory || {});
            s.prestige = computePrestige(s);
            parsed.sanctuaries[code] = s;
          }
        }
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
  const list = Object.values(db.sanctuaries).map((s) => ({
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
            persistDatabase();
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
      online: wss.clients.size,
      sanctuaries: Object.keys(db.sanctuaries).length,
    });
  });

  // --- Cloud Sync API ---
  app.get('/api/sync/:code', (req, res) => {
    const code = sanitizeCode(req.params.code);
    if (code.length < 4) {
      return res.status(400).json({ error: 'Invalid sync code' });
    }
    const record = db.sanctuaries[code];
    if (!record) {
      return res.status(404).json({ error: 'Sanctuary sync code not found' });
    }
    return res.json({ sanctuary: record });
  });

  app.put('/api/sync/:code', (req, res) => {
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
    persistDatabase();
    broadcast({ type: 'leaderboard:updated', leaderboard: buildLeaderboard() });
    return res.json({ ok: true, sanctuary: sanitized });
  });

  // --- Community & Visiting Sanctuaries API ---
  app.get('/api/sanctuaries', (_req, res) => {
    return res.json({ sanctuaries: buildCommunitySummaries() });
  });

  app.post('/api/sanctuaries/:code/visit-gift', (req, res) => {
    const code = sanitizeCode(req.params.code);
    const visitorName = sanitizeText(req.body?.visitorName, 28, 'A Fellow Keeper');
    const enclosureId = sanitizeText(req.body?.enclosureId, 64, '');
    const target = db.sanctuaries[code];
    if (!target) {
      return res.status(404).json({ error: 'Sanctuary not found' });
    }
    const enc = target.enclosures.find((e) => e.id === enclosureId) || target.enclosures[0];
    if (enc) {
      enc.visitorHearts = (enc.visitorHearts || 0) + 1;
      enc.happiness = Math.min(100, (enc.happiness || 80) + 6);
    }
    target.prestige = computePrestige(target);
    target.updatedAt = Date.now();
    persistDatabase();

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

  app.post('/api/marketplace', (req, res) => {
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
    persistDatabase();

    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, listing });
  });

  app.post('/api/marketplace/:id/buy', (req, res) => {
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

    if (db.marketplace.length < 4) {
      const refills = buildSeedMarketplace();
      const pick = refills[Math.floor(Math.random() * refills.length)];
      db.marketplace.push({ ...pick, id: `mkt-r-${Date.now()}`, createdAt: Date.now() });
    }

    persistDatabase();
    broadcast({ type: 'marketplace:updated', listings: db.marketplace });
    return res.json({ ok: true, purchased: listing });
  });

  // --- Leaderboard & Chat REST Fallbacks ---
  app.get('/api/leaderboard', (_req, res) => {
    return res.json({ leaderboard: buildLeaderboard() });
  });

  app.get('/api/chat', (_req, res) => {
    return res.json({ messages: db.chat.slice(-50) });
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
    flushDatabaseNow();

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
