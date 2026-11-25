/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  ChatMessage,
  CommunitySanctuarySummary,
  LeaderboardEntry,
  MarketplaceListing,
  SanctuaryState,
  SpeciesId,
} from '../types/game';
import { computePrestige } from '../data/catalog';

const STORAGE_KEY = 'wildgrove_sanctuary_save_v1';
const FALLBACK_SANCTUARIES_KEY = 'wildgrove_fallback_sanctuaries_v1';
const FALLBACK_MARKET_KEY = 'wildgrove_fallback_market_v1';
const FALLBACK_CHAT_KEY = 'wildgrove_fallback_chat_v1';

// --- Local Persistence Helpers (instant boot + offline fallback) ---
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

export function saveLocalSanctuary(state: SanctuaryState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const map = readFallbackMap();
    map[state.syncCode] = { ...state, prestige: computePrestige(state), updatedAt: Date.now() };
    localStorage.setItem(FALLBACK_SANCTUARIES_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function readFallbackMap(): Record<string, SanctuaryState> {
  try {
    const raw = localStorage.getItem(FALLBACK_SANCTUARIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, SanctuaryState>;
    }
  } catch {
    // Ignore
  }
  return {};
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

// --- Cloud Sync REST API (Primary: Express Backend, Fallback: Local Storage) ---
export async function pushCloudSave(state: SanctuaryState): Promise<{ ok: boolean; updatedAt?: number }> {
  saveLocalSanctuary(state);
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

  const res = await fetchJson<{ sanctuary?: SanctuaryState }>(`/api/sync/${encodeURIComponent(clean)}`);
  if (res.ok && res.data?.sanctuary) {
    return res.data.sanctuary;
  }

  // Fallback to local map if offline / static deployment
  const map = readFallbackMap();
  return map[clean] || null;
}

export async function fetchCommunitySanctuaries(): Promise<CommunitySanctuarySummary[]> {
  const res = await fetchJson<{ sanctuaries?: CommunitySanctuarySummary[] }>('/api/sanctuaries');
  if (res.ok && Array.isArray(res.data?.sanctuaries)) {
    return res.data.sanctuaries;
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
  return null;
}

export async function fetchMarketplaceListings(): Promise<MarketplaceListing[]> {
  const res = await fetchJson<{ listings?: MarketplaceListing[] }>('/api/marketplace');
  if (res.ok && Array.isArray(res.data?.listings)) {
    try {
      localStorage.setItem(FALLBACK_MARKET_KEY, JSON.stringify(res.data.listings));
    } catch {
      // Ignore
    }
    return res.data.listings;
  }

  try {
    const raw = localStorage.getItem(FALLBACK_MARKET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore
  }
  return [];
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
  const res = await fetchJson<{ listing?: MarketplaceListing }>('/api/marketplace', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok && res.data?.listing) {
    return res.data.listing;
  }
  return null;
}

export async function buyMarketplaceListing(
  listingId: string,
  buyerCode: string,
): Promise<{ ok: boolean; purchased?: MarketplaceListing; error?: string }> {
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

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetchJson<{ leaderboard?: LeaderboardEntry[] }>('/api/leaderboard');
  if (res.ok && Array.isArray(res.data?.leaderboard)) {
    return res.data.leaderboard;
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

// --- Real-Time WebSocket Client with Auto-Reconnect & Local Fallback ---
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
  private reconnectDelay = 2000;
  private pendingChatQueue: Array<Record<string, unknown>> = [];

  constructor(listeners: RealtimeListeners) {
    this.listeners = listeners;
    this.hydrateCachedChat();
    this.connect();
  }

  private hydrateCachedChat(): void {
    try {
      const raw = localStorage.getItem(FALLBACK_CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.listeners.onChatInit(parsed);
        }
      }
    } catch {
      // Ignore
    }
  }

  private cacheChat(messages: ChatMessage[]): void {
    try {
      localStorage.setItem(FALLBACK_CHAT_KEY, JSON.stringify(messages.slice(-50)));
    } catch {
      // Ignore
    }
  }

  private connect(): void {
    if (this.closed || typeof window === 'undefined') return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this.reconnectDelay = 2000;
        // Flush any buffered chat messages sent while reconnecting
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
        if (!this.closed) {
          const delay = this.reconnectDelay;
          this.reconnectDelay = Math.min(15000, Math.round(this.reconnectDelay * 1.5));
          this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.reconnectTimer = window.setTimeout(() => this.connect(), 5000);
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

    // Queue for reconnect and apply optimistically so the user sees instant feedback
    this.pendingChatQueue.push(frame);
    if (this.pendingChatQueue.length > 10) this.pendingChatQueue.shift();
    this.listeners.onChatMessage({ ...payload, timestamp: Date.now() });
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
