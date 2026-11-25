import { useState } from 'react';
import {
  Check,
  Cloud,
  Coins,
  Copy,
  Download,
  Gem,
  Gift,
  Heart,
  RefreshCw,
  RotateCw,
  Send,
  Share2,
  Sparkles,
  Store,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type {
  ActiveDrawer,
  ChatMessage,
  CommunitySanctuarySummary,
  DecorTypeId,
  LeaderboardEntry,
  MarketplaceListing,
  PlacementChoice,
  ResourceId,
  SanctuaryState,
  SpeciesId,
} from '../types/game';
import {
  ACHIEVEMENTS,
  CROP_CATALOG,
  DAILY_REWARDS,
  DECOR_CATALOG,
  RESOURCE_CATALOG,
  SEASONAL_EVENT_INFO,
  SPECIES_CATALOG,
} from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';
import { ManualContent } from './ManualContent';

export type TerrainThemeId = 'meadow' | 'autumn' | 'alpine' | 'clover';

interface DrawerModalsProps {
  activeDrawer: ActiveDrawer;
  onClose: () => void;
  sanctuary: SanctuaryState;
  terrainTheme: TerrainThemeId;
  onChangeTerrainTheme: (theme: TerrainThemeId) => void;
  weatherEnabled: boolean;
  onToggleWeather: () => void;
  decorRotation: number;
  onRotateDecor: () => void;
  onStartPlacement: (choice: PlacementChoice) => void;
  // Marketplace
  listings: MarketplaceListing[];
  onBuyListing: (listingId: string) => void;
  onCreateListing: (resourceId: ResourceId, quantity: number, priceCoins: number) => void;
  // Friends
  communitySanctuaries: CommunitySanctuarySummary[];
  onVisitSanctuary: (syncCode: string) => void;
  onRefreshFriends: () => void;
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  // Daily & Seasonal
  canClaimDaily: boolean;
  onClaimDaily: () => void;
  onClaimMilestone: (milestoneId: string) => void;
  // Chat
  chatMessages: ChatMessage[];
  onlineCount: number;
  onSendChat: (text: string, tag: 'general' | 'trade' | 'visit' | 'milestone') => void;
  // Cloud Sync
  onUpdateProfile: (keeperName: string, sanctuaryName: string, avatarSpecies: SpeciesId) => void;
  onSyncNow: () => Promise<boolean>;
  onLoadSyncCode: (code: string) => Promise<boolean>;
  // Social Share
  snapshotUrl: string | null;
  onCaptureSnapshot: () => void;
  onShareMilestoneToChat: (text: string) => void;
}

const TERRAIN_THEMES: Array<{ id: TerrainThemeId; label: string; swatch: string; note: string }> = [
  { id: 'meadow', label: 'Sunlit Meadow', swatch: '#78AD57', note: 'Drifting sunlit pollen & petals' },
  { id: 'autumn', label: 'Harvest Loam', swatch: '#B38849', note: 'Falling crimson & gold maple leaves' },
  { id: 'alpine', label: 'Alpine Moss', swatch: '#598264', note: 'Soft drifting mountain snowfall' },
  { id: 'clover', label: 'Riverbank Clover', swatch: '#6AA86D', note: 'Gentle sunshower rain & ripples' },
];

export function DrawerModals({
  activeDrawer,
  onClose,
  sanctuary,
  terrainTheme,
  onChangeTerrainTheme,
  weatherEnabled,
  onToggleWeather,
  decorRotation,
  onRotateDecor,
  onStartPlacement,
  listings,
  onBuyListing,
  onCreateListing,
  communitySanctuaries,
  onVisitSanctuary,
  onRefreshFriends,
  leaderboard,
  canClaimDaily,
  onClaimDaily,
  onClaimMilestone,
  chatMessages,
  onlineCount,
  onSendChat,
  onUpdateProfile,
  onSyncNow,
  onLoadSyncCode,
  snapshotUrl,
  onCaptureSnapshot,
  onShareMilestoneToChat,
}: DrawerModalsProps) {
  const [buildTab, setBuildTab] = useState<'enclosures' | 'decor' | 'aesthetics'>('enclosures');
  const [marketTab, setMarketTab] = useState<'browse' | 'sell'>('browse');
  const [sellResource, setSellResource] = useState<ResourceId>('lucky_acorn');
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(120);

  const [chatText, setChatText] = useState('');
  const [chatTag, setChatTag] = useState<'general' | 'trade' | 'visit'>('general');

  // Profile & Sync state
  const [keeperInput, setKeeperInput] = useState(sanctuary.keeperName);
  const [sanctuaryInput, setSanctuaryInput] = useState(sanctuary.sanctuaryName);
  const [avatarInput, setAvatarInput] = useState<SpeciesId>(sanctuary.avatarSpecies);
  const [importCode, setImportCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [copied, setCopied] = useState(false);

  if (!activeDrawer) return null;

  const titleMap: Record<Exclude<ActiveDrawer, null>, string> = {
    build: 'Habitat Builder & Aesthetics',
    crops: 'Treat Crops & Pantry',
    market: 'Sanctuary Trading Post',
    friends: 'Visit Friends & Sanctuaries',
    leaderboard: 'Global Keeper Rankings',
    events: 'Daily Rewards & Harvest Festival',
    chat: 'Community Sanctuary Chat',
    sync: 'Cross-Platform Cloud Sync',
    share: 'Share Sanctuary Milestone',
    manual: "Keeper's Instruction Manual",
  };

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setSyncMessage('Copy unavailable in this browser.');
    }
  };

  const handleDownloadPostcard = () => {
    if (!snapshotUrl) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 760;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#FAF6EE';
      ctx.fillRect(0, 0, 1200, 760);
      ctx.drawImage(img, 36, 36, 1128, 570);
      ctx.strokeStyle = 'rgba(38,49,41,0.18)';
      ctx.lineWidth = 4;
      ctx.strokeRect(36, 36, 1128, 570);

      ctx.fillStyle = '#233026';
      ctx.font = 'bold 34px Georgia, serif';
      ctx.fillText(sanctuary.sanctuaryName, 44, 660);

      ctx.fillStyle = '#546457';
      ctx.font = '600 20px sans-serif';
      ctx.fillText(
        `Keeper ${sanctuary.keeperName} · Level ${sanctuary.level} · Prestige ${sanctuary.prestige.toLocaleString()} · Sync ${sanctuary.syncCode}`,
        44,
        702,
      );

      ctx.fillStyle = '#2F6E49';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Wildgrove Sanctuary', 1156, 682);

      const link = document.createElement('a');
      link.download = `${sanctuary.sanctuaryName.toLowerCase().replace(/\s+/g, '-')}-postcard.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = snapshotUrl;
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-[#19241B]/42">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-[#FAF6EE] border border-[#263129]/15 rounded-3xl shadow-[0_24px_64px_rgba(24,36,26,0.3)] overflow-hidden sanctuary-modal">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#263129]/10 bg-[#F3ECE0] shrink-0">
          <h2 className="font-display font-bold text-lg text-[#233026]">
            {titleMap[activeDrawer]}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#E5DCCB] text-[#455447] cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto sanctuary-scroll space-y-5">
          {/* ==================== BUILD & MODULAR AESTHETICS ==================== */}
          {activeDrawer === 'build' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
                  {(
                    [
                      ['enclosures', 'Animal Enclosures'],
                      ['decor', 'Flora & Decor'],
                      ['aesthetics', 'Terrain Aesthetics'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setBuildTab(id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        buildTab === id
                          ? 'bg-[#FAF6EE] text-[#233026] shadow-sm'
                          : 'text-[#556658] hover:text-[#233026]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {buildTab === 'decor' && (
                  <button
                    type="button"
                    onClick={onRotateDecor}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#233026] cursor-pointer whitespace-nowrap"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Rotate ({decorRotation * 90}°)
                  </button>
                )}
              </div>

              {buildTab === 'enclosures' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(SPECIES_CATALOG) as SpeciesId[]).map((spId) => {
                    const sp = SPECIES_CATALOG[spId];
                    const canAffordClassic = sanctuary.coins >= sp.costCoins;
                    const canAffordExotic = sanctuary.gems >= sp.exoticCostGems;
                    return (
                      <div
                        key={sp.id}
                        className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                            <SpeciesIcon species={sp.id} className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-sm text-[#233026]">{sp.habitatTitle}</h3>
                            <p className="text-xs text-[#5A6B5C] mt-0.5 leading-relaxed">
                              {sp.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={!canAffordClassic}
                            onClick={() => {
                              onStartPlacement({ kind: 'enclosure', species: sp.id, variant: 'classic' });
                              onClose();
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            {sp.costCoins}
                          </button>

                          <button
                            type="button"
                            disabled={!canAffordExotic}
                            onClick={() => {
                              onStartPlacement({ kind: 'enclosure', species: sp.id, variant: 'exotic' });
                              onClose();
                            }}
                            className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#2A6F97] hover:bg-[#21597A] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap"
                            title={`Adopt Exotic ${sp.exoticName}`}
                          >
                            <Gem className="w-3.5 h-3.5" />
                            Exotic ({sp.exoticCostGems})
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {buildTab === 'decor' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Object.keys(DECOR_CATALOG) as DecorTypeId[]).map((dId) => {
                    const d = DECOR_CATALOG[dId];
                    const affordable =
                      sanctuary.coins >= d.costCoins && sanctuary.gems >= d.costGems;
                    return (
                      <div
                        key={d.id}
                        className="p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#233026]">{d.name}</div>
                          <div className="text-xs text-[#5A6B5C]">
                            +{d.prestigeBonus} Prestige · {d.category}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!affordable}
                          onClick={() => {
                            onStartPlacement({ kind: 'decor', decorType: d.id });
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {d.costCoins}
                          {d.costGems > 0 && ` + ${d.costGems}G`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {buildTab === 'aesthetics' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#546457]">
                      Switch meadow terrain, lighting, and matching 3D procedural weather across all enclosures.
                    </p>
                    <button
                      type="button"
                      onClick={onToggleWeather}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        weatherEnabled
                          ? 'bg-[#2F6E49] text-white'
                          : 'bg-[#EFE7D8] text-[#4B5B4E] hover:bg-[#E5DCCB]'
                      }`}
                    >
                      Weather Effects: {weatherEnabled ? 'On' : 'Off'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {TERRAIN_THEMES.map((t) => {
                      const active = terrainTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onChangeTerrainTheme(t.id)}
                          className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#EAF3EC] border-[#2F6E49]'
                              : 'bg-[#F3ECE0] border-[#263129]/10 hover:bg-[#EAE0CE]'
                          }`}
                        >
                          <span
                            className="w-9 h-9 rounded-xl shrink-0 border border-black/15"
                            style={{ backgroundColor: t.swatch }}
                          />
                          <div>
                            <div className="text-sm font-semibold text-[#233026]">{t.label}</div>
                            <div className="text-xs text-[#5A6B5C]">{t.note}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== CROPS & PANTRY ==================== */}
          {activeDrawer === 'crops' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.values(CROP_CATALOG).map((crop) => {
                  const sp = SPECIES_CATALOG[crop.bestFor];
                  const affordable = sanctuary.coins >= crop.costCoins;
                  return (
                    <div
                      key={crop.id}
                      className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm text-[#233026]">{crop.name}</h3>
                          <div className="text-xs text-[#5A6B5C]">
                            Yields {crop.yieldAmount} treats · {Math.round(crop.growDurationMs / 1000)}s · For {sp.name}
                          </div>
                        </div>
                        <SpeciesIcon species={crop.bestFor} className="w-7 h-7 shrink-0" />
                      </div>
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() => {
                          onStartPlacement({ kind: 'crop', cropType: crop.id });
                          onClose();
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45"
                      >
                        <Coins className="w-3.5 h-3.5" />
                        Plant Plot ({crop.costCoins} Coins)
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#263129]/10">
                <h3 className="text-xs font-semibold text-[#546457] mb-2.5">
                  Sanctuary Pantry &amp; Rare Collectibles
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(RESOURCE_CATALOG) as ResourceId[]).map((rId) => {
                    const r = RESOURCE_CATALOG[rId];
                    const qty = sanctuary.inventory[rId] || 0;
                    return (
                      <div
                        key={rId}
                        className="px-3 py-2 rounded-xl bg-[#F3ECE0] flex items-center justify-between text-xs"
                      >
                        <span className="text-[#233026] font-medium truncate pr-2">{r.name}</span>
                        <span className="font-mono-num font-bold text-[#2F6E49]">{qty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ==================== LIVE MARKETPLACE ==================== */}
          {activeDrawer === 'market' && (
            <>
              <div className="inline-flex items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
                <button
                  type="button"
                  onClick={() => setMarketTab('browse')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    marketTab === 'browse' ? 'bg-[#FAF6EE] text-[#233026] shadow-sm' : 'text-[#556658]'
                  }`}
                >
                  Live Listings ({listings.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMarketTab('sell')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    marketTab === 'sell' ? 'bg-[#FAF6EE] text-[#233026] shadow-sm' : 'text-[#556658]'
                  }`}
                >
                  List Item to Trade
                </button>
              </div>

              {marketTab === 'browse' ? (
                <div className="space-y-2.5">
                  {listings.map((item) => {
                    const isMine = item.sellerCode === sanctuary.syncCode;
                    const canAfford = sanctuary.coins >= item.priceCoins && sanctuary.gems >= item.priceGems;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[#233026]">
                            {item.itemLabel} ×{item.quantity}
                          </div>
                          <div className="text-xs text-[#5A6B5C]">
                            Seller: {item.sellerName} · {item.rarity}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isMine || !canAfford}
                          onClick={() => onBuyListing(item.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap"
                        >
                          <Store className="w-3.5 h-3.5" />
                          {isMine ? 'Your Listing' : `${item.priceCoins} Coins`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-4 bg-[#F3ECE0] p-4 rounded-2xl">
                  <div>
                    <label className="block text-xs font-semibold text-[#4B5B4E] mb-1.5">
                      Select Resource From Pantry
                    </label>
                    <select
                      value={sellResource}
                      onChange={(e) => {
                        const r = e.target.value as ResourceId;
                        setSellResource(r);
                        setSellPrice(RESOURCE_CATALOG[r].baseCoinValue * sellQty);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#263129]/15 text-sm text-[#233026]"
                    >
                      {(Object.keys(RESOURCE_CATALOG) as ResourceId[]).map((rId) => (
                        <option key={rId} value={rId}>
                          {RESOURCE_CATALOG[rId].name} (Owned: {sanctuary.inventory[rId] || 0})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, sanctuary.inventory[sellResource] || 1)}
                        value={sellQty}
                        onChange={(e) => setSellQty(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">
                        Asking Price (Coins)
                      </label>
                      <input
                        type="number"
                        min={20}
                        max={5000}
                        value={sellPrice}
                        onChange={(e) => setSellPrice(Math.max(20, Number(e.target.value) || 20))}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm font-mono-num"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={(sanctuary.inventory[sellResource] || 0) < sellQty}
                    onClick={() => {
                      onCreateListing(sellResource, sellQty, sellPrice);
                      setMarketTab('browse');
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-sm font-semibold cursor-pointer disabled:opacity-45"
                  >
                    Post to Global Marketplace
                  </button>
                </div>
              )}
            </>
          )}

          {/* ==================== FRIENDS & SANCTUARY VISITS ==================== */}
          {activeDrawer === 'friends' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#546457]">
                <span>Visit other players&apos; live 3D sanctuaries and leave Care Gifts for coins.</span>
                <button
                  type="button"
                  onClick={onRefreshFriends}
                  className="inline-flex items-center gap-1 text-[#2F6E49] font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>

              {communitySanctuaries
                .filter((s) => s.syncCode !== sanctuary.syncCode)
                .map((friend) => (
                  <div
                    key={friend.syncCode}
                    className="p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                        <SpeciesIcon species={friend.avatarSpecies} className="w-7 h-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#233026] truncate">
                          {friend.sanctuaryName}
                        </div>
                        <div className="text-xs text-[#5A6B5C]">
                          {friend.keeperName} · Lv.{friend.level} · {friend.animalCount} animals ·{' '}
                          <span className="font-mono-num">{friend.prestige.toLocaleString()}</span> Prestige
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onVisitSanctuary(friend.syncCode);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Users className="w-3.5 h-3.5" />
                      Visit 3D
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* ==================== GLOBAL LEADERBOARD ==================== */}
          {activeDrawer === 'leaderboard' && (
            <div className="space-y-2.5">
              <div className="text-xs text-[#546457]">
                Global Sanctuary Prestige combines animal happiness, exotic variants, bond levels, and habitat design.
              </div>
              <div className="divide-y divide-[#263129]/10 rounded-2xl border border-[#263129]/10 bg-[#F3ECE0] overflow-hidden">
                {leaderboard.map((row) => {
                  const isMe = row.syncCode === sanctuary.syncCode;
                  return (
                    <div
                      key={row.syncCode}
                      className={`px-4 py-3 flex items-center justify-between gap-3 ${
                        isMe ? 'bg-[#E3EFE6]' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 text-center font-mono-num font-bold text-sm text-[#4B5A4E]">
                          #{row.rank}
                        </span>
                        <SpeciesIcon species={row.avatarSpecies} className="w-7 h-7 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#233026] truncate">
                            {row.sanctuaryName} {isMe ? '(You)' : ''}
                          </div>
                          <div className="text-xs text-[#5A6B5C]">
                            {row.keeperName} · Lv.{row.level} · {row.exoticCount} Exotic
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono-num font-bold text-sm text-[#2F6E49] shrink-0">
                        <Trophy className="w-4 h-4 text-[#C9851E]" />
                        {row.prestige.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ==================== DAILY REWARDS & SEASONAL EVENT ==================== */}
          {activeDrawer === 'events' && (
            <div className="space-y-6">
              {/* 7-Day Daily Streak */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#233026]">
                      7-Day Keeper Streak
                    </h3>
                    <p className="text-xs text-[#5A6B5C]">
                      Current Streak: Day {sanctuary.dailyReward.streak} / 7
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canClaimDaily}
                    onClick={onClaimDaily}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                  >
                    <Gift className="w-4 h-4" />
                    {canClaimDaily ? 'Claim Today' : 'Claimed Today'}
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {DAILY_REWARDS.map((tier) => {
                    const claimed = tier.day <= sanctuary.dailyReward.streak;
                    const isNext = tier.day === sanctuary.dailyReward.streak + 1 && canClaimDaily;
                    return (
                      <div
                        key={tier.day}
                        className={`p-2 rounded-xl border text-center ${
                          claimed
                            ? 'bg-[#E3EFE6] border-[#2F6E49]/35'
                            : isNext
                              ? 'bg-[#FDF1DF] border-[#C46B33]'
                              : 'bg-[#F3ECE0] border-[#263129]/10'
                        }`}
                      >
                        <div className="text-[10px] font-mono-num font-bold text-[#5A6B5C]">D{tier.day}</div>
                        <div className="text-xs font-mono-num font-bold text-[#233026] mt-0.5">
                          {tier.coins}c
                        </div>
                        <div className="text-[10px] font-mono-num text-[#2A6F97]">{tier.gems}g</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Seasonal Festival */}
              <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/12 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#233026]">
                      {SEASONAL_EVENT_INFO.title}
                    </h3>
                    <p className="text-xs text-[#5A6B5C] mt-0.5">{SEASONAL_EVENT_INFO.subtitle}</p>
                  </div>
                  <span className="text-xs font-mono-num font-semibold text-[#C46B33] whitespace-nowrap">
                    {sanctuary.seasonalEvent.lanternPoints} Lantern Pts · {SEASONAL_EVENT_INFO.endsLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  {SEASONAL_EVENT_INFO.milestones.map((m) => {
                    const reached = sanctuary.seasonalEvent.lanternPoints >= m.pointsRequired;
                    const claimed = sanctuary.seasonalEvent.claimedMilestones.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 bg-[#FAF6EE] p-3 rounded-xl border border-[#263129]/10"
                      >
                        <div>
                          <div className="text-sm font-semibold text-[#233026]">{m.title}</div>
                          <div className="text-xs text-[#5A6B5C] font-mono-num">
                            {m.pointsRequired} pts · +{m.rewardCoins} Coins · +{m.rewardGems} Gems
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={!reached || claimed}
                          onClick={() => onClaimMilestone(m.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2F6E49] text-white text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                        >
                          {claimed ? 'Claimed' : reached ? 'Claim Reward' : 'Locked'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================== REAL-TIME COMMUNITY CHAT ==================== */}
          {activeDrawer === 'chat' && (
            <div className="flex flex-col gap-3 h-[54vh]">
              <div className="flex items-center justify-between text-xs text-[#546457]">
                <span>Real-time WebSocket chat across all connected keepers</span>
                <span className="font-mono-num font-semibold text-[#2F6E49]">
                  {onlineCount} Keepers Online
                </span>
              </div>

              <div className="flex-1 overflow-y-auto sanctuary-scroll space-y-2.5 bg-[#F3ECE0] rounded-2xl p-3.5 border border-[#263129]/10">
                {chatMessages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#FAF6EE] flex items-center justify-center shrink-0 mt-0.5">
                      <SpeciesIcon species={m.avatarSpecies} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[#233026]">{m.senderName}</span>
                        <span className="text-[#6B7A6E]">
                          {m.tag && m.tag !== 'general' ? m.tag : 'keeper'} ·{' '}
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-[#2C3A2F] break-words">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatText.trim()) return;
                  onSendChat(chatText.trim(), chatTag);
                  setChatText('');
                }}
                className="flex items-center gap-2"
              >
                <select
                  value={chatTag}
                  onChange={(e) => setChatTag(e.target.value as 'general' | 'trade' | 'visit')}
                  className="px-2.5 py-2.5 rounded-xl bg-[#F3ECE0] border border-[#263129]/15 text-xs font-semibold text-[#233026]"
                >
                  <option value="general">Chat</option>
                  <option value="trade">Trade</option>
                  <option value="visit">Invite</option>
                </select>
                <input
                  type="text"
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Say hello, share a trade, or invite keepers..."
                  maxLength={200}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-white border border-[#263129]/15 text-sm text-[#233026] focus:outline-none focus:ring-2 focus:ring-[#2F6E49]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-sm font-semibold cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </form>
            </div>
          )}

          {/* ==================== CROSS-PLATFORM CLOUD SYNC ==================== */}
          {activeDrawer === 'sync' && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/25 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[#2F6E49]">Your Cross-Platform Sync Code</div>
                  <div className="font-mono-num text-2xl font-bold text-[#233026] tracking-wider">
                    {sanctuary.syncCode}
                  </div>
                  <div className="text-xs text-[#4C5E50]">
                    Use this code on any mobile or desktop browser to continue your exact sanctuary.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCode(sanctuary.syncCode)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FAF6EE] border border-[#263129]/15 text-xs font-semibold text-[#233026] cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-[#2F6E49]" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onSyncNow();
                      setSyncMessage(ok ? 'Cloud sanctuary synced successfully.' : 'Saved locally; server unreachable.');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    Sync Now
                  </button>
                </div>
              </div>

              {/* Edit Sanctuary Identity */}
              <div className="p-4 rounded-2xl bg-[#F3ECE0] space-y-3">
                <h3 className="text-sm font-semibold text-[#233026]">Keeper Profile</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#546457] mb-1">Keeper Name</label>
                    <input
                      type="text"
                      value={keeperInput}
                      onChange={(e) => setKeeperInput(e.target.value)}
                      maxLength={28}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#546457] mb-1">Sanctuary Name</label>
                    <input
                      type="text"
                      value={sanctuaryInput}
                      onChange={(e) => setSanctuaryInput(e.target.value)}
                      maxLength={36}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        'raccoon',
                        'gorilla',
                        'butterfly',
                        'wolf',
                        'red_panda',
                        'golden_fox',
                        'snow_leopard',
                        'river_otter',
                      ] as SpeciesId[]
                    ).map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => setAvatarInput(sp)}
                        className={`p-1.5 rounded-xl border cursor-pointer ${
                          avatarInput === sp
                            ? 'bg-[#FAF6EE] border-[#2F6E49]'
                            : 'bg-transparent border-transparent hover:bg-[#E6DEC9]'
                        }`}
                        title={SPECIES_CATALOG[sp].name}
                      >
                        <SpeciesIcon species={sp} className="w-7 h-7" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateProfile(keeperInput, sanctuaryInput, avatarInput);
                      setSyncMessage('Profile updated and synced.');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#2F6E49] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Profile
                  </button>
                </div>
              </div>

              {/* Load Another Device's Code */}
              <div className="p-4 rounded-2xl bg-[#F3ECE0] space-y-2.5">
                <h3 className="text-sm font-semibold text-[#233026]">Load Sanctuary From Another Device</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={importCode}
                    onChange={(e) => setImportCode(e.target.value.toUpperCase())}
                    placeholder="Enter GROVE-XXXX"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onLoadSyncCode(importCode);
                      setSyncMessage(ok ? 'Loaded cloud sanctuary!' : 'Code not found.');
                    }}
                    className="px-4 py-2 rounded-xl bg-[#C46B33] text-white text-xs font-semibold cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              </div>

              {syncMessage && <p className="text-xs font-semibold text-[#2F6E49]">{syncMessage}</p>}
            </div>
          )}

          {/* ==================== SOCIAL SHARE POSTCARD ==================== */}
          {activeDrawer === 'share' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden border border-[#263129]/15 bg-[#D4E9F4] aspect-video flex items-center justify-center">
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt="Live 3D snapshot of your Wildgrove Sanctuary"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-sm text-[#4A5A4E]">Capturing 3D sanctuary postcard...</span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A594D]">
                <span>
                  <strong>{sanctuary.sanctuaryName}</strong> · Level {sanctuary.level} ·{' '}
                  <span className="font-mono-num">{sanctuary.prestige.toLocaleString()}</span> Prestige ·{' '}
                  {sanctuary.enclosures.length} Animals
                </span>
                <button
                  type="button"
                  onClick={onCaptureSnapshot}
                  className="inline-flex items-center gap-1 text-[#2F6E49] font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake Snapshot
                </button>
              </div>

              {/* Achievements List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ACHIEVEMENTS.map((ach) => {
                  const unlocked = sanctuary.unlockedAchievements.includes(ach.id);
                  return (
                    <div
                      key={ach.id}
                      className={`p-3 rounded-xl border text-xs ${
                        unlocked
                          ? 'bg-[#E6F1E9] border-[#2F6E49]/30 text-[#233026]'
                          : 'bg-[#F3ECE0] border-[#263129]/10 text-[#6B7A6E]'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#C9851E]" />
                        {ach.title} {unlocked ? '· Unlocked' : ''}
                      </div>
                      <div className="mt-0.5">{ach.description}</div>
                    </div>
                  );
                })}
              </div>

              {/* Share Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadPostcard}
                  disabled={!snapshotUrl}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  Download Postcard PNG
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const msg = `Visit ${sanctuary.sanctuaryName} (Code: ${sanctuary.syncCode}) — Level ${sanctuary.level} with ${sanctuary.prestige.toLocaleString()} Prestige in Wildgrove Sanctuary!`;
                    handleCopyCode(msg);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-[#233026] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Share2 className="w-4 h-4" />
                  {copied ? 'Copied Post!' : 'Copy Social Post'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onShareMilestoneToChat(
                      `Just shared a postcard of ${sanctuary.sanctuaryName} — Level ${sanctuary.level}, ${sanctuary.prestige.toLocaleString()} Prestige! Come visit (${sanctuary.syncCode})!`,
                    );
                    onClose();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Heart className="w-4 h-4" />
                  Post to Community
                </button>
              </div>
            </div>
          )}

          {/* ==================== KEEPER'S INSTRUCTION MANUAL ==================== */}
          {activeDrawer === 'manual' && <ManualContent />}
        </div>
      </div>
    </div>
  );
}
