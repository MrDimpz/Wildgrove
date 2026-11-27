/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChatMessage,
  CommunitySanctuarySummary,
  DirectTradeOffer,
  LeaderboardEntry,
  MarketplaceListing,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from '../types/game';
import { GENERATED_GROVE_CODES, computePrestige, normalizeSanctuaryState } from '../data/catalog';

const STORAGE_KEY = 'wildgrove_sanctuary_save_v1';
const FALLBACK_SANCTUARIES_KEY = 'wildgrove_fallback_sanctuaries_v1';
const FALLBACK_MARKET_KEY = 'wildgrove_fallback_market_v1';
const FALLBACK_CHAT_KEY = 'wildgrove_fallback_chat_v1';
const FALLBACK_TRADES_KEY = 'wildgrove_fallback_trades_v1';

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

// Computer-generated sanctuaries removed — Friends & Directory display only real player sanctuaries.

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
  return [];
}

// --- Local Persistence Helpers (instant boot + complete static-hosting support) ---
export function loadLocalSanctuary(): SanctuaryState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SanctuaryState;
    if (parsed && parsed.syncCode && Array.isArray(parsed.enclosures)) {
      return normalizeSanctuaryState(parsed);
    }
  } catch {
    // Ignore storage read errors
  }
  return null;
}

function readFallbackMap(): Record<string, SanctuaryState> {
  const result: Record<string, SanctuaryState> = {};
  try {
    const raw = localStorage.getItem(FALLBACK_SANCTUARIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, SanctuaryState>;
      if (parsed && typeof parsed === 'object') {
        for (const [code, s] of Object.entries(parsed)) {
          if (!GENERATED_GROVE_CODES.has(code) && s && typeof s === 'object') {
            result[code] = s;
          }
        }
      }
    }
  } catch {
    // Ignore
  }
  return result;
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
      return normalizeSanctuaryState(res.data.sanctuary);
    }
  }

  const map = readFallbackMap();
  return map[clean] ? normalizeSanctuaryState(map[clean]) : null;
}

export async function fetchCommunitySanctuaries(): Promise<CommunitySanctuarySummary[]> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ sanctuaries?: CommunitySanctuarySummary[] }>('/api/sanctuaries');
    if (res.ok && Array.isArray(res.data?.sanctuaries)) {
      return res.data.sanctuaries.filter((s) => !GENERATED_GROVE_CODES.has(s.syncCode));
    }
  }

  const map = readFallbackMap();
  return Object.values(map)
    .filter((s) => !GENERATED_GROVE_CODES.has(s.syncCode))
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
  guestbookMessage?: string,
  visitorCode?: string,
): Promise<SanctuaryState | null> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ sanctuary?: SanctuaryState }>(
      `/api/sanctuaries/${encodeURIComponent(targetCode)}/visit-gift`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName, visitorCode, enclosureId, guestbookMessage }),
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
  const nextGuestbook = [...(target.guestbook || [])];
  if (guestbookMessage && guestbookMessage.trim()) {
    nextGuestbook.unshift({
      id: `gb-${Date.now()}`,
      authorName: visitorName,
      authorCode: visitorCode || 'GUEST',
      message: guestbookMessage.trim().slice(0, 140),
      timestamp: Date.now(),
    });
  }
  const updated: SanctuaryState = {
    ...target,
    enclosures: updatedEnclosures,
    guestbook: nextGuestbook.slice(0, 40),
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

export async function cancelMarketplaceListing(
  listingId: string,
  sellerCode: string,
): Promise<{ ok: boolean; cancelled?: MarketplaceListing; error?: string }> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ ok?: boolean; cancelled?: MarketplaceListing; error?: string }>(
      `/api/marketplace/${encodeURIComponent(listingId)}?sellerCode=${encodeURIComponent(sellerCode)}`,
      { method: 'DELETE' },
    );
    if (res.ok && res.data?.cancelled) {
      return { ok: true, cancelled: res.data.cancelled };
    }
    return { ok: false, error: res.data?.error || 'Could not cancel listing' };
  }
  const listings = readFallbackMarketplace();
  const found = listings.find((l) => l.id === listingId && l.sellerCode === sellerCode);
  if (!found) return { ok: false, error: 'Listing not found' };
  writeFallbackMarketplace(listings.filter((l) => l.id !== listingId));
  return { ok: true, cancelled: found };
}

function readFallbackTrades(): DirectTradeOffer[] {
  try {
    const raw = localStorage.getItem(FALLBACK_TRADES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DirectTradeOffer[];
    }
  } catch {
    // Ignore
  }
  return [];
}

function writeFallbackTrades(trades: DirectTradeOffer[]): void {
  try {
    localStorage.setItem(FALLBACK_TRADES_KEY, JSON.stringify(trades.slice(0, 60)));
  } catch {
    // Ignore
  }
}

export async function fetchDirectTrades(syncCode: string): Promise<DirectTradeOffer[]> {
  const clean = syncCode.trim().toUpperCase();
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ trades?: DirectTradeOffer[] }>(`/api/trades/${encodeURIComponent(clean)}`);
    if (res.ok && Array.isArray(res.data?.trades)) {
      return res.data.trades;
    }
  }
  return readFallbackTrades().filter(
    (t) => t.status === 'pending' && (t.toCode === clean || t.fromCode === clean),
  );
}

export async function createDirectTrade(payload: {
  fromCode: string;
  fromName: string;
  toCode: string;
  resourceId: ResourceId;
  itemLabel: string;
  quantity: number;
  askingCoins: number;
  note?: string;
}): Promise<{ ok: boolean; offer?: DirectTradeOffer; error?: string }> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ ok?: boolean; offer?: DirectTradeOffer; error?: string }>('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok && res.data?.offer) return { ok: true, offer: res.data.offer };
    return { ok: false, error: res.data?.error || 'Could not send trade offer' };
  }
  const offer: DirectTradeOffer = {
    id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...payload,
    toCode: payload.toCode.trim().toUpperCase(),
    status: 'pending',
    createdAt: Date.now(),
  };
  writeFallbackTrades([offer, ...readFallbackTrades()]);
  return { ok: true, offer };
}

export async function respondDirectTrade(
  offerId: string,
  responderCode: string,
  action: 'accept' | 'decline',
): Promise<{ ok: boolean; offer?: DirectTradeOffer; error?: string }> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ ok?: boolean; offer?: DirectTradeOffer; error?: string }>(
      `/api/trades/${encodeURIComponent(offerId)}/respond`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responderCode, action }),
      },
    );
    if (res.ok && res.data?.offer) return { ok: true, offer: res.data.offer };
    return { ok: false, error: res.data?.error || 'Could not update trade offer' };
  }
  const all = readFallbackTrades();
  const target = all.find((t) => t.id === offerId && t.status === 'pending');
  if (!target) return { ok: false, error: 'Offer not found' };
  target.status = action === 'accept' ? 'accepted' : 'declined';
  writeFallbackTrades(all);
  return { ok: true, offer: target };
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (await isBackendAvailable()) {
    const res = await fetchJson<{ leaderboard?: LeaderboardEntry[] }>('/api/leaderboard');
    if (res.ok && Array.isArray(res.data?.leaderboard)) {
      return res.data.leaderboard
        .filter((entry) => !GENERATED_GROVE_CODES.has(entry.syncCode))
        .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    }
  }
  const map = readFallbackMap();
  const list = Object.values(map)
    .filter((s) => !GENERATED_GROVE_CODES.has(s.syncCode))
    .map((s) => ({
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
        if (Array.isArray(parsed)) {
          const realMessages = (parsed as ChatMessage[]).filter(
            (m) => m && !String(m.id || '').startsWith('chat-seed-'),
          );
          this.listeners.onChatInit(realMessages);
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
          } else if (data.type === 'chat:sync' && Array.isArray(data.messages)) {
            this.cacheChat(data.messages);
            this.listeners.onChatInit(data.messages);
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
