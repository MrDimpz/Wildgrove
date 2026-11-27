import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Bell,
  BellOff,
  BookMarked,
  Check,
  ChefHat,
  Clock,
  Cloud,
  Coins,
  Copy,
  Download,
  Droplets,
  Gem,
  Gift,
  Heart,
  LayoutGrid,
  Maximize2,
  Moon,
  RefreshCw,
  RotateCw,
  Save,
  Send,
  Share2,
  Sparkles,
  Sprout,
  Star,
  Store,
  Sun,
  Sunrise,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import type {
  ActiveDrawer,
  ChatMessage,
  CommunitySanctuarySummary,
  CropTypeId,
  DecorTypeId,
  DirectTradeOffer,
  LeaderboardEntry,
  MarketplaceListing,
  PlacementChoice,
  ResourceId,
  SanctuaryState,
  SpeciesId,
  TimeOfDayId,
} from '../types/game';
import {
  ACHIEVEMENTS,
  CRAFTING_RECIPES,
  CROP_CATALOG,
  CROP_GROW_DURATION_MS,
  DAILY_REWARDS,
  DECOR_CATALOG,
  DEFAULT_GRID_SIZE,
  GENERATED_GROVE_CODES,
  MAX_GRID_SIZE,
  getDecorFootprint,
  PLOT_EXPANSIONS,
  RESOURCE_CATALOG,
  SEASONAL_EVENT_INFO,
  SPECIES_CATALOG,
  formatMinSec,
} from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';
import { ManualContent } from './ManualContent';
import { CareSummaryPanel } from './CareSummaryPanel';

export type TerrainThemeId = 'meadow' | 'autumn' | 'alpine' | 'clover';

const CROP_VISUAL_META: Record<CropTypeId, { swatch: string; lookLabel: string }> = {
  berry: { swatch: '#D92B54', lookLabel: 'Trellis ruby berry bramble' },
  mango: { swatch: '#F5A21D', lookLabel: 'Twin golden mango saplings' },
  lavender: { swatch: '#8A5FE0', lookLabel: 'Tall violet blossom spires' },
  herb: { swatch: '#3FA880', lookLabel: 'Stone-ringed alpine herb spiral' },
  bamboo_shoot: { swatch: '#52A844', lookLabel: 'Segmented jade bamboo & shoots' },
  fox_berry: { swatch: '#FF9B26', lookLabel: 'Arched vines & glowing amber lanterns' },
  ice_fish: { swatch: '#7AD6F7', lookLabel: 'Frosty stone basin & leaping fish' },
  river_reed: { swatch: '#6B3A22', lookLabel: 'Creek marsh with velvety cattails' },
};

interface DrawerModalsProps {
  activeDrawer: ActiveDrawer;
  onClose: () => void;
  sanctuary: SanctuaryState;
  terrainTheme: TerrainThemeId;
  onChangeTerrainTheme: (theme: TerrainThemeId) => void;
  weatherEnabled: boolean;
  onToggleWeather: () => void;
  timeOfDay: TimeOfDayId;
  onChangeTimeOfDay: (tod: TimeOfDayId) => void;
  decorRotation: number;
  onRotateDecor: () => void;
  onStartPlacement: (choice: PlacementChoice) => void;
  onExpandPlot: (targetSize: 18 | 24) => void;
  // Breeding / Nursery
  onBreedAnimals: (parentAId: string, parentBId: string, babyName: string) => void;
  // Layout Blueprints
  onSaveBlueprint: (slot: 1 | 2 | 3, name: string) => void;
  onLoadBlueprint: (slot: 1 | 2 | 3) => void;
  // Crops, Crafting & Care Summary
  onCraftRecipe: (recipeId: string) => void;
  onFertilizeCrop: (cropId: string) => void;
  onInstantBloomCrop: (cropId: string) => void;
  onHarvestAll: () => void;
  onHarvestSingle: (cropId: string) => void;
  pendingIdleCoins: number;
  onCollectIdleCoins: () => void;
  onJumpToEnclosure: (enclosureId: string) => void;
  // Marketplace & Direct Trades
  listings: MarketplaceListing[];
  onBuyListing: (listingId: string) => void;
  onCreateListing: (resourceId: ResourceId, quantity: number, priceCoins: number) => void;
  onCancelListing: (listingId: string) => void;
  directTrades: DirectTradeOffer[];
  onSendDirectTrade: (
    toCode: string,
    resourceId: ResourceId,
    qty: number,
    askingCoins: number,
    note: string,
  ) => Promise<boolean>;
  onRespondDirectTrade: (offerId: string, action: 'accept' | 'decline') => void;
  // Friends & Guestbook
  communitySanctuaries: CommunitySanctuarySummary[];
  onVisitSanctuary: (syncCode: string) => void;
  onRefreshFriends: () => void;
  onTogglePinFriend: (syncCode: string) => void;
  onAddFriendCode: (syncCode: string) => Promise<boolean>;
  // Leaderboard
  leaderboard: LeaderboardEntry[];
  // Daily, Quests & Seasonal
  canClaimDaily: boolean;
  onClaimDaily: () => void;
  onClaimMilestone: (milestoneId: string) => void;
  onClaimQuest: (questId: string) => void;
  // Chat
  chatMessages: ChatMessage[];
  onlineCount: number;
  onSendChat: (text: string, tag: 'general' | 'trade' | 'visit' | 'milestone') => void;
  chatNotificationsEnabled: boolean;
  onToggleChatNotifications: () => void;
  browserNotifPermission: NotificationPermission | 'unsupported';
  onRequestBrowserNotif: () => void;
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
  timeOfDay,
  onChangeTimeOfDay,
  decorRotation,
  onRotateDecor,
  onStartPlacement,
  onExpandPlot,
  onBreedAnimals,
  onSaveBlueprint,
  onLoadBlueprint,
  onCraftRecipe,
  onFertilizeCrop,
  onInstantBloomCrop,
  onHarvestAll,
  onHarvestSingle,
  pendingIdleCoins,
  onCollectIdleCoins,
  onJumpToEnclosure,
  listings,
  onBuyListing,
  onCreateListing,
  onCancelListing,
  directTrades,
  onSendDirectTrade,
  onRespondDirectTrade,
  communitySanctuaries,
  onVisitSanctuary,
  onRefreshFriends,
  onTogglePinFriend,
  onAddFriendCode,
  leaderboard,
  canClaimDaily,
  onClaimDaily,
  onClaimMilestone,
  onClaimQuest,
  chatMessages,
  onlineCount,
  onSendChat,
  chatNotificationsEnabled,
  onToggleChatNotifications,
  browserNotifPermission,
  onRequestBrowserNotif,
  onUpdateProfile,
  onSyncNow,
  onLoadSyncCode,
  snapshotUrl,
  onCaptureSnapshot,
  onShareMilestoneToChat,
}: DrawerModalsProps) {
  const [buildTab, setBuildTab] = useState<'enclosures' | 'decor' | 'nursery' | 'storage' | 'aesthetics'>(
    'enclosures',
  );
  const [cropsTab, setCropsTab] = useState<'plots' | 'kitchen'>('plots');
  const [marketTab, setMarketTab] = useState<'browse' | 'sell' | 'direct'>('browse');

  // Marketplace sell form
  const [sellResource, setSellResource] = useState<ResourceId>('lucky_acorn');
  const [sellQty, setSellQty] = useState(1);
  const [sellPrice, setSellPrice] = useState(120);

  // Direct player-to-player trade form
  const [directToCode, setDirectToCode] = useState('');
  const [directResource, setDirectResource] = useState<ResourceId>('berry_treat');
  const [directQty, setDirectQty] = useState(1);
  const [directCoins, setDirectCoins] = useState(0);
  const [directNote, setDirectNote] = useState('');
  const [directStatus, setDirectStatus] = useState('');

  // Nursery breeding state
  const [parentAId, setParentAId] = useState('');
  const [parentBId, setParentBId] = useState('');
  const [babyNameInput, setBabyNameInput] = useState('');

  // Blueprint naming state
  const [bpNameDrafts, setBpNameDrafts] = useState<Record<number, string>>({
    1: 'Cozy Meadow',
    2: 'Festival Plaza',
    3: 'Grand Menagerie',
  });

  // Friends add-by-code state
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [friendMessage, setFriendMessage] = useState('');

  // Chat state
  const [chatText, setChatText] = useState('');
  const [chatTag, setChatTag] = useState<'general' | 'trade' | 'visit'>('general');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (activeDrawer !== 'chat') return;
    const el = chatScrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [activeDrawer, chatMessages.length]);

  // Profile & Sync state
  const [keeperInput, setKeeperInput] = useState(sanctuary.keeperName);
  const [sanctuaryInput, setSanctuaryInput] = useState(sanctuary.sanctuaryName);
  const [avatarInput, setAvatarInput] = useState<SpeciesId>(sanctuary.avatarSpecies);
  const [importCode, setImportCode] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Live 1-second timer tick for planted crops while Crops drawer is open
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (activeDrawer !== 'crops') return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeDrawer]);

  // Keep Nursery parent defaults sensible when opening Build
  const breedableAnimals = sanctuary.enclosures.filter((e) => e.bondLevel >= 4);
  useEffect(() => {
    if (breedableAnimals.length >= 2) {
      if (!breedableAnimals.some((e) => e.id === parentAId)) {
        setParentAId(breedableAnimals[0].id);
      }
      if (!breedableAnimals.some((e) => e.id === parentBId) || parentBId === parentAId) {
        const second = breedableAnimals.find((e) => e.id !== (parentAId || breedableAnimals[0].id));
        if (second) setParentBId(second.id);
      }
    }
  }, [breedableAnimals, parentAId, parentBId]);

  if (!activeDrawer) return null;

  const currentGridSize =
    sanctuary.gridSize === 24 ? 24 : sanctuary.gridSize === 18 ? 18 : DEFAULT_GRID_SIZE;
  const nextExpansion = PLOT_EXPANSIONS.find((tier) => tier.fromSize === currentGridSize) || null;
  const storageCrate = sanctuary.storageCrate || [];
  const savedFriends = sanctuary.savedFriends || [];
  const guestbook = sanctuary.guestbook || [];
  const blueprints = sanctuary.blueprints || [];
  const dailyQuests = sanctuary.dailyQuests?.quests || [];

  const titleMap: Record<Exclude<ActiveDrawer, null>, string> = {
    build: 'Habitat Builder, Nursery & Aesthetics',
    crops: 'Treat Crops, Kitchen & Pantry',
    summary: 'Sanctuary Care & Harvest Summary',
    market: 'Sanctuary Trading Post',
    friends: 'Friends, Visits & Guestbook',
    leaderboard: 'Global Keeper Rankings',
    events: 'Daily Quests, Streak & Festival',
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

  const readyCropsCount = sanctuary.crops.filter((c) => {
    const dur = c.growDurationMs || CROP_GROW_DURATION_MS;
    return nowMs - c.plantedAt >= dur;
  }).length;
  const fertilizerCount = sanctuary.inventory.sunbeam_fertilizer || 0;
  const sprinklerCount = sanctuary.inventory.meadow_sprinkler || 0;

  return (
    <div className="fixed inset-0 z-30 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-[#19241B]/42">
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col bg-[#FAF6EE] border border-[#263129]/15 rounded-3xl shadow-[0_24px_64px_rgba(24,36,26,0.3)] overflow-hidden sanctuary-modal">
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
          {/* ==================== CARE SUMMARY ==================== */}
          {activeDrawer === 'summary' && (
            <CareSummaryPanel
              sanctuary={sanctuary}
              pendingIdleCoins={pendingIdleCoins}
              onCollectIdleCoins={onCollectIdleCoins}
              onHarvestAll={onHarvestAll}
              onHarvestSingle={onHarvestSingle}
              onFertilizeCrop={onFertilizeCrop}
              onInstantBloomCrop={onInstantBloomCrop}
              onJumpToEnclosure={(encId) => {
                onClose();
                onJumpToEnclosure(encId);
              }}
            />
          )}

          {/* ==================== BUILD, NURSERY, STORAGE & AESTHETICS ==================== */}
          {activeDrawer === 'build' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
                  {(
                    [
                      ['enclosures', 'Enclosures'],
                      ['decor', 'Decor'],
                      ['nursery', 'Nursery'],
                      ['storage', `Crate (${storageCrate.length})`],
                      ['aesthetics', 'Plot & Style'],
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
                    const fp = getDecorFootprint(d.id);
                    const isCircus = d.id === 'circus_tent';
                    return (
                      <div
                        key={d.id}
                        className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                          isCircus
                            ? 'bg-[#FDF1EE] border-[#C93B44]/30 sm:col-span-2'
                            : 'bg-[#F3ECE0] border-[#263129]/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#233026]">{d.name}</div>
                          <div className="text-xs text-[#5A6B5C]">
                            +{d.prestigeBonus} Prestige · {fp === 2 ? '2×2 (4 squares)' : '1×1'} · {d.category}
                          </div>
                          {isCircus && (
                            <div className="text-xs text-[#7D2F2F] mt-1 leading-snug">
                              {d.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={!affordable}
                          onClick={() => {
                            onStartPlacement({ kind: 'decor', decorType: d.id });
                            onClose();
                          }}
                          className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0 ${
                            isCircus
                              ? 'bg-[#C93B44] hover:bg-[#AA2E36]'
                              : 'bg-[#2F6E49] hover:bg-[#25593B]'
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {d.costCoins.toLocaleString()}
                          {d.costGems > 0 && ` + ${d.costGems}G`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Sanctuary Nursery / Animal Breeding */}
              {buildTab === 'nursery' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#FDF1F6] border border-[#C94B7C]/25 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-base text-[#5D1F3C] flex items-center gap-1.5">
                        <Heart className="w-4 h-4 text-[#C94B7C] fill-current" />
                        Sanctuary Nursery
                      </h3>
                      <span className="text-xs font-mono-num font-bold text-[#8A2E56] bg-white px-2.5 py-1 rounded-lg border border-[#C94B7C]/20">
                        150 Coins
                      </span>
                    </div>
                    <p className="text-xs text-[#6B3A50] leading-relaxed">
                      Pair any two sanctuary animals with <strong>Bond Level 4 or higher</strong> to welcome a Nursery Baby with a glowing aura, unique hybrid trait, and <strong>+120 Prestige</strong>. Pairing Bond Lv. 6+ animals guarantees an Exotic morph!
                    </p>
                  </div>

                  {breedableAnimals.length < 2 ? (
                    <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 text-xs text-[#4B5A4E] space-y-2">
                      <p className="font-semibold text-[#233026]">
                        Need 2 animals at Bond Level 4+ ({breedableAnimals.length}/2 ready)
                      </p>
                      <p>
                        Tip: Bake a <strong>Gourmet Meadow Tart</strong> in the Crops → Kitchen tab for a guaranteed +1 Bond Level, or score 110+ in Treat Toss!
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">
                            Parent 1 (Bond Lv. 4+)
                          </label>
                          <select
                            value={parentAId}
                            onChange={(e) => setParentAId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs text-[#233026]"
                          >
                            {breedableAnimals.map((enc) => (
                              <option key={enc.id} value={enc.id}>
                                {enc.name} ({SPECIES_CATALOG[enc.species].name} · Lv.{enc.bondLevel})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">
                            Parent 2 (Bond Lv. 4+)
                          </label>
                          <select
                            value={parentBId}
                            onChange={(e) => setParentBId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs text-[#233026]"
                          >
                            {breedableAnimals
                              .filter((enc) => enc.id !== parentAId)
                              .map((enc) => (
                                <option key={enc.id} value={enc.id}>
                                  {enc.name} ({SPECIES_CATALOG[enc.species].name} · Lv.{enc.bondLevel})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">
                          Baby Name (Optional)
                        </label>
                        <input
                          type="text"
                          value={babyNameInput}
                          onChange={(e) => setBabyNameInput(e.target.value)}
                          maxLength={24}
                          placeholder="Leave blank for a cozy meadow name..."
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-sm text-[#233026]"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={
                          !parentAId ||
                          !parentBId ||
                          parentAId === parentBId ||
                          sanctuary.coins < 150
                        }
                        onClick={() => {
                          onBreedAnimals(parentAId, parentBId, babyNameInput.trim());
                          setBabyNameInput('');
                          onClose();
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#B34372] hover:bg-[#96365E] text-white text-sm font-semibold cursor-pointer disabled:opacity-45"
                      >
                        <Sparkles className="w-4 h-4" />
                        Welcome Nursery Baby (150 Coins)
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Storage Crate */}
              {buildTab === 'storage' && (
                <div className="space-y-3">
                  <div className="text-xs text-[#546457]">
                    Items stored from Edit Mode are safely kept here—place them back onto any open meadow tile for free.
                  </div>
                  {storageCrate.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 text-center text-xs text-[#5A6B5C] space-y-1.5">
                      <Archive className="w-6 h-6 mx-auto text-[#7B8B7E]" />
                      <div className="font-semibold text-[#233026]">Your Storage Crate is empty</div>
                      <p>
                        Tap <strong>Edit</strong> on the bottom bar, pick up any enclosure, crop, or decor, and click <strong>Store</strong> to pack it here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {storageCrate.map((entry, idx) => {
                        const label =
                          entry.kind === 'enclosure'
                            ? `${entry.item.name} (${SPECIES_CATALOG[entry.item.species].name})`
                            : entry.kind === 'crop'
                              ? CROP_CATALOG[entry.item.cropType].name
                              : DECOR_CATALOG[entry.item.decorType].name;
                        const footprint: 1 | 2 =
                          entry.kind === 'enclosure'
                            ? 2
                            : entry.kind === 'decor'
                              ? getDecorFootprint(entry.item.decorType)
                              : 1;
                        return (
                          <div
                            key={`${entry.kind}-${entry.item.id}-${idx}`}
                            className="p-3 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex items-center justify-between gap-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {entry.kind === 'enclosure' && (
                                <div className="w-9 h-9 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                  <SpeciesIcon
                                    species={entry.item.species}
                                    exotic={entry.item.variant === 'exotic'}
                                    className="w-6 h-6"
                                  />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#233026] truncate">
                                  {label}
                                </div>
                                <div className="text-[11px] text-[#5A6B5C] capitalize">
                                  {entry.kind} · {footprint}×{footprint} tile
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onStartPlacement({
                                  kind: 'storage',
                                  storageIndex: idx,
                                  label,
                                  footprint,
                                });
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                            >
                              Place Free
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {buildTab === 'aesthetics' && (
                <div className="space-y-4">
                  {/* Meadow Plot Expansion up to 24x24 */}
                  <div className="p-4 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/25 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-display font-bold text-sm sm:text-base text-[#233026] flex items-center gap-1.5">
                          <Maximize2 className="w-4 h-4 text-[#2F6E49]" />
                          Meadow Plot Expansion
                        </h3>
                        <p className="text-xs text-[#46594B] mt-0.5">
                          Current Sanctuary Size:{' '}
                          <strong className="font-mono-num text-[#233026]">
                            {currentGridSize}×{currentGridSize}
                          </strong>{' '}
                          ({currentGridSize * currentGridSize} buildable tiles · Max {MAX_GRID_SIZE}×{MAX_GRID_SIZE})
                        </p>
                      </div>
                      <span className="text-xs font-mono-num font-bold text-[#2F6E49] bg-[#FAF6EE] px-2.5 py-1 rounded-lg border border-[#2F6E49]/20">
                        {currentGridSize === 24 ? 'Max 24×24' : `Next: ${nextExpansion?.targetSize}×${nextExpansion?.targetSize}`}
                      </span>
                    </div>

                    {nextExpansion ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF6EE] border border-[#263129]/10">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#233026]">{nextExpansion.title}</div>
                          <div className="text-xs text-[#546457]">{nextExpansion.description}</div>
                        </div>
                        <button
                          type="button"
                          disabled={
                            sanctuary.coins < nextExpansion.costCoins ||
                            sanctuary.gems < nextExpansion.costGems
                          }
                          onClick={() => onExpandPlot(nextExpansion.targetSize)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap shrink-0"
                        >
                          <Coins className="w-3.5 h-3.5" />
                          {nextExpansion.costCoins.toLocaleString()} + {nextExpansion.costGems}G
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#2F6E49]/20 text-xs font-semibold text-[#2F6E49]">
                        Maximum 24×24 Grand Sanctuary Unlocked! Use the Edit button on the bottom dock to rearrange your layout anytime.
                      </div>
                    )}
                  </div>

                  {/* Time of Day Cycle */}
                  <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2.5">
                    <div className="text-xs font-semibold text-[#233026]">
                      Sky &amp; Time of Day (Sunset &amp; Night spawn glowing fireflies)
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'day', label: 'Sunlit Day', icon: Sun },
                          { id: 'sunset', label: 'Golden Sunset', icon: Sunrise },
                          { id: 'night', label: 'Moonlit Night', icon: Moon },
                        ] as const
                      ).map((opt) => {
                        const Icon = opt.icon;
                        const active = timeOfDay === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChangeTimeOfDay(opt.id)}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              active
                                ? 'bg-[#2F6E49] text-white border-[#2F6E49]'
                                : 'bg-[#FAF6EE] text-[#233026] border-[#263129]/12 hover:bg-[#EAE0CE]'
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weather & Meadow Theme */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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

                  {/* Sanctuary Layout Blueprints (Slots 1-3) */}
                  <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display font-bold text-sm text-[#233026] flex items-center gap-1.5">
                        <LayoutGrid className="w-4 h-4 text-[#2F6E49]" />
                        Sanctuary Layout Blueprints
                      </h3>
                      <span className="text-[11px] text-[#5A6B5C]">Safely rearranges owned items</span>
                    </div>
                    <div className="space-y-2">
                      {([1, 2, 3] as const).map((slot) => {
                        const saved = blueprints.find((b) => b.slot === slot);
                        return (
                          <div
                            key={slot}
                            className="p-2.5 rounded-xl bg-[#FAF6EE] border border-[#263129]/10 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="w-6 h-6 rounded-lg bg-[#EFE7D8] font-mono-num text-xs font-bold text-[#233026] flex items-center justify-center shrink-0">
                                {slot}
                              </span>
                              <input
                                type="text"
                                value={bpNameDrafts[slot] ?? saved?.name ?? `Blueprint ${slot}`}
                                onChange={(e) =>
                                  setBpNameDrafts((prev) => ({ ...prev, [slot]: e.target.value }))
                                }
                                maxLength={24}
                                className="min-w-0 flex-1 px-2 py-1 rounded-lg bg-white border border-[#263129]/12 text-xs text-[#233026]"
                              />
                              {saved && (
                                <span className="text-[10px] font-mono-num text-[#5A6B5C] whitespace-nowrap hidden sm:inline">
                                  {saved.enclosures.length}A · {saved.decorations.length}D
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onSaveBlueprint(
                                    slot,
                                    (bpNameDrafts[slot] || `Blueprint ${slot}`).trim(),
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#EFE7D8] hover:bg-[#E4DAC7] text-[#233026] text-xs font-semibold cursor-pointer"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={!saved}
                                onClick={() => {
                                  onLoadBlueprint(slot);
                                  onClose();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== CROPS, TREAT KITCHEN & PANTRY ==================== */}
          {activeDrawer === 'crops' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setCropsTab('plots')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      cropsTab === 'plots' ? 'bg-[#FAF6EE] text-[#233026] shadow-sm' : 'text-[#556658]'
                    }`}
                  >
                    <Sprout className="w-3.5 h-3.5" />
                    Crop Plots &amp; Pantry
                  </button>
                  <button
                    type="button"
                    onClick={() => setCropsTab('kitchen')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                      cropsTab === 'kitchen'
                        ? 'bg-[#FAF6EE] text-[#233026] shadow-sm'
                        : 'text-[#556658]'
                    }`}
                  >
                    <ChefHat className="w-3.5 h-3.5" />
                    Treat Kitchen
                  </button>
                </div>

                {cropsTab === 'plots' && readyCropsCount > 0 && (
                  <button
                    type="button"
                    onClick={onHarvestAll}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Harvest All ({readyCropsCount})
                  </button>
                )}
              </div>

              {cropsTab === 'kitchen' ? (
                <div className="space-y-3">
                  <p className="text-xs text-[#546457]">
                    Combine harvested treats and rare animal keepsakes to bake <strong>Gourmet Meadow Tarts</strong> (+1 guaranteed Bond Level) and crop growth boosters.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CRAFTING_RECIPES.map((recipe) => {
                      const hasAllIngredients = recipe.ingredients.every(
                        (ing) => (sanctuary.inventory[ing.resourceId] || 0) >= ing.qty,
                      );
                      const canAfford = hasAllIngredients && sanctuary.coins >= recipe.coinCost;
                      const ownedOutput = sanctuary.inventory[recipe.outputResource] || 0;
                      return (
                        <div
                          key={recipe.id}
                          className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm text-[#233026]">{recipe.name}</h3>
                              <span className="text-[11px] font-mono-num text-[#2F6E49] font-semibold">
                                Owned: {ownedOutput}
                              </span>
                            </div>
                            <p className="text-xs text-[#5A6B5C] leading-relaxed">
                              {recipe.description}
                            </p>
                            <div className="pt-1 space-y-1">
                              {recipe.ingredients.map((ing) => {
                                const owned = sanctuary.inventory[ing.resourceId] || 0;
                                const ok = owned >= ing.qty;
                                return (
                                  <div
                                    key={ing.resourceId}
                                    className="flex items-center justify-between text-[11px]"
                                  >
                                    <span className="text-[#3A4A3E]">
                                      {RESOURCE_CATALOG[ing.resourceId].name}
                                    </span>
                                    <span
                                      className={`font-mono-num font-bold ${
                                        ok ? 'text-[#2F6E49]' : 'text-[#B53232]'
                                      }`}
                                    >
                                      {owned}/{ing.qty}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onCraftRecipe(recipe.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45"
                          >
                            <ChefHat className="w-3.5 h-3.5" />
                            Craft ({recipe.coinCost} Coins)
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {sanctuary.crops.length > 0 && (
                    <div className="p-3.5 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/20 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#233026]">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#2F6E49]" />
                          Planted Plots ({sanctuary.crops.length})
                        </span>
                        <span className="text-[#4B5E50] font-normal font-mono-num">
                          Compost: {fertilizerCount} · Bloom Elixir: {sprinklerCount}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {sanctuary.crops.map((planted) => {
                          const def = CROP_CATALOG[planted.cropType];
                          const visual = CROP_VISUAL_META[planted.cropType];
                          const dur = planted.growDurationMs || CROP_GROW_DURATION_MS;
                          const remainingMs = Math.max(0, dur - (nowMs - planted.plantedAt));
                          const isReady = remainingMs === 0;
                          return (
                            <div
                              key={planted.id}
                              className="px-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#263129]/10 flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                                  style={{ backgroundColor: visual.swatch }}
                                />
                                <span className="font-semibold text-[#233026] truncate">
                                  {def.name}
                                </span>
                                {planted.fertilized && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E6F3EA] text-[#2F6E49]">
                                    2× Yield
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`font-mono-num font-bold whitespace-nowrap mr-1 ${
                                    isReady ? 'text-[#B86A14]' : 'text-[#2F6E49]'
                                  }`}
                                >
                                  {isReady ? 'Ready!' : formatMinSec(remainingMs)}
                                </span>
                                {isReady ? (
                                  <button
                                    type="button"
                                    onClick={() => onHarvestSingle(planted.id)}
                                    className="px-2.5 py-1 rounded-lg bg-[#2F6E49] text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Harvest
                                  </button>
                                ) : (
                                  <>
                                    {!planted.fertilized && (
                                      <button
                                        type="button"
                                        disabled={fertilizerCount < 1}
                                        onClick={() => onFertilizeCrop(planted.id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#EFE7D8] hover:bg-[#E4DAC7] text-[#233026] text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                                        title="Use Sunbeam Compost (-50% time & 2× yield)"
                                      >
                                        <Droplets className="w-3 h-3 text-[#2F6E49]" />
                                        Compost
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      disabled={sprinklerCount < 1 && sanctuary.gems < 1}
                                      onClick={() => onInstantBloomCrop(planted.id)}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#2A6F97] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-40"
                                      title={
                                        sprinklerCount > 0
                                          ? 'Use 1 Dewdrop Bloom Elixir'
                                          : 'Instant Bloom (1 Gem)'
                                      }
                                    >
                                      <Zap className="w-3 h-3" />
                                      {sprinklerCount > 0 ? 'Bloom' : '1G'}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(CROP_CATALOG).map((crop) => {
                      const sp = SPECIES_CATALOG[crop.bestFor];
                      const visual = CROP_VISUAL_META[crop.id];
                      const affordable = sanctuary.coins >= crop.costCoins;
                      return (
                        <div
                          key={crop.id}
                          className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0 border border-black/15"
                                  style={{ backgroundColor: visual.swatch }}
                                />
                                <h3 className="font-semibold text-sm text-[#233026] truncate">
                                  {crop.name}
                                </h3>
                              </div>
                              <div className="text-xs text-[#5A6B5C] mt-0.5">
                                Yields {crop.yieldAmount} treats ·{' '}
                                <span className="font-mono-num font-semibold text-[#2F6E49]">
                                  {formatMinSec(CROP_GROW_DURATION_MS)}
                                </span>{' '}
                                · For {sp.name}
                              </div>
                              <div className="text-[11px] text-[#667568] mt-0.5">
                                {visual.lookLabel}
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
                      Sanctuary Pantry, Crafted Goods &amp; Rare Collectibles
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
                            <span className="text-[#233026] font-medium truncate pr-2">
                              {r.name}
                            </span>
                            <span className="font-mono-num font-bold text-[#2F6E49]">{qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ==================== LIVE MARKETPLACE & DIRECT TRADES ==================== */}
          {activeDrawer === 'market' && (
            <>
              <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
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
                  List Item
                </button>
                <button
                  type="button"
                  onClick={() => setMarketTab('direct')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    marketTab === 'direct' ? 'bg-[#FAF6EE] text-[#233026] shadow-sm' : 'text-[#556658]'
                  }`}
                >
                  Direct Trades ({directTrades.length})
                </button>
              </div>

              {marketTab === 'browse' && (
                <div className="space-y-2.5">
                  {listings.map((item) => {
                    const isMine = item.sellerCode === sanctuary.syncCode;
                    const canAfford =
                      sanctuary.coins >= item.priceCoins && sanctuary.gems >= item.priceGems;
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
                        {isMine ? (
                          <button
                            type="button"
                            onClick={() => onCancelListing(item.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FCE8E8] hover:bg-[#F5D0D0] border border-[#C94B4B]/25 text-[#8A2626] text-xs font-semibold cursor-pointer whitespace-nowrap"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Cancel &amp; Reclaim
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!canAfford}
                            onClick={() => onBuyListing(item.id)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap"
                          >
                            <Store className="w-3.5 h-3.5" />
                            {item.priceCoins} Coins
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {marketTab === 'sell' && (
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
                      <label className="block text-xs font-semibold text-[#4B5B4E] mb-1">
                        Quantity
                      </label>
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

              {marketTab === 'direct' && (
                <div className="space-y-4">
                  {/* Send Direct Trade / Gift Form */}
                  <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-3">
                    <h3 className="text-sm font-semibold text-[#233026]">
                      Send Direct Trade or Gift to a Friend
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#4B5B4E] mb-1">
                          Recipient Sync Code
                        </label>
                        <input
                          type="text"
                          value={directToCode}
                          onChange={(e) => setDirectToCode(e.target.value.toUpperCase())}
                          placeholder="e.g. GROVE-XXXX"
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs font-mono-num"
                        />
                        {savedFriends.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {savedFriends.slice(0, 4).map((code) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() => setDirectToCode(code)}
                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-[#263129]/12 text-[10px] font-mono-num text-[#2F6E49] cursor-pointer hover:bg-[#E9F2EC]"
                              >
                                {code}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#4B5B4E] mb-1">
                          Item to Send
                        </label>
                        <select
                          value={directResource}
                          onChange={(e) => setDirectResource(e.target.value as ResourceId)}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs text-[#233026]"
                        >
                          {(Object.keys(RESOURCE_CATALOG) as ResourceId[]).map((rId) => (
                            <option key={rId} value={rId}>
                              {RESOURCE_CATALOG[rId].name} ({sanctuary.inventory[rId] || 0})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#4B5B4E] mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, sanctuary.inventory[directResource] || 1)}
                          value={directQty}
                          onChange={(e) => setDirectQty(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs font-mono-num"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#4B5B4E] mb-1">
                          Asking Coins (0 = Free Gift)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={5000}
                          value={directCoins}
                          onChange={(e) => setDirectCoins(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs font-mono-num"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      value={directNote}
                      onChange={(e) => setDirectNote(e.target.value)}
                      maxLength={100}
                      placeholder="Optional note (e.g. Enjoy these berries!)"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs"
                    />

                    <button
                      type="button"
                      disabled={
                        directToCode.trim().length < 4 ||
                        directToCode.trim() === sanctuary.syncCode ||
                        (sanctuary.inventory[directResource] || 0) < directQty
                      }
                      onClick={async () => {
                        const ok = await onSendDirectTrade(
                          directToCode.trim(),
                          directResource,
                          directQty,
                          directCoins,
                          directNote.trim(),
                        );
                        if (ok) {
                          setDirectNote('');
                          setDirectStatus('Direct trade offer sent!');
                        } else {
                          setDirectStatus('Could not send offer — verify Sync Code.');
                        }
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {directCoins === 0 ? 'Send Free Gift' : `Send Trade Offer (${directCoins} Coins)`}
                    </button>
                    {directStatus && (
                      <p className="text-xs font-semibold text-[#2F6E49]">{directStatus}</p>
                    )}
                  </div>

                  {/* Pending Direct Trade Inbox & Outbox */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-[#546457]">
                      Active Direct Offers ({directTrades.length})
                    </h3>
                    {directTrades.length === 0 ? (
                      <div className="p-3.5 rounded-xl bg-[#F3ECE0] text-xs text-[#5A6B5C]">
                        No pending direct trades right now. Send a gift or trade offer to any friend&apos;s Sync Code above!
                      </div>
                    ) : (
                      directTrades.map((offer) => {
                        const isIncoming = offer.toCode === sanctuary.syncCode;
                        return (
                          <div
                            key={offer.id}
                            className="p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-wrap items-center justify-between gap-2.5"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#233026]">
                                {isIncoming ? `From ${offer.fromName}` : `To ${offer.toCode}`}:{' '}
                                {offer.itemLabel} ×{offer.quantity}
                              </div>
                              <div className="text-[11px] text-[#5A6B5C]">
                                {offer.askingCoins === 0
                                  ? 'Free Gift'
                                  : `Asking ${offer.askingCoins} Coins`}
                                {offer.note ? ` · "${offer.note}"` : ''}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {isIncoming && (
                                <button
                                  type="button"
                                  disabled={sanctuary.coins < offer.askingCoins}
                                  onClick={() => onRespondDirectTrade(offer.id, 'accept')}
                                  className="px-3 py-1.5 rounded-xl bg-[#2F6E49] text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                                >
                                  Accept
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => onRespondDirectTrade(offer.id, 'decline')}
                                className="px-3 py-1.5 rounded-xl bg-[#FCE8E8] text-[#8A2626] text-xs font-semibold cursor-pointer"
                              >
                                {isIncoming ? 'Decline' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ==================== FRIENDS, PINNED LIST & GUESTBOOK ==================== */}
          {activeDrawer === 'friends' && (
            <div className="space-y-4">
              {/* Add Friend by Sync Code */}
              <div className="p-3.5 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/20 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#233026]">
                  <span className="inline-flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-[#2F6E49]" />
                    Add Friend by Sync Code
                  </span>
                  <button
                    type="button"
                    onClick={onRefreshFriends}
                    className="inline-flex items-center gap-1 text-[#2F6E49] font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                    placeholder="Enter GROVE-XXXX"
                    className="flex-1 px-3 py-2 rounded-xl bg-white border border-[#263129]/15 text-xs font-mono-num"
                  />
                  <button
                    type="button"
                    disabled={friendCodeInput.trim().length < 4}
                    onClick={async () => {
                      const ok = await onAddFriendCode(friendCodeInput.trim());
                      setFriendMessage(
                        ok ? `Pinned ${friendCodeInput.trim()} to your Friends list!` : 'Sync Code not found.',
                      );
                      if (ok) setFriendCodeInput('');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-45"
                  >
                    Pin Friend
                  </button>
                </div>
                {friendMessage && (
                  <p className="text-[11px] font-semibold text-[#2F6E49]">{friendMessage}</p>
                )}
              </div>

              {/* Community & Pinned Sanctuaries */}
              {(() => {
                const realFriends = [...communitySanctuaries]
                  .filter((s) => s.syncCode !== sanctuary.syncCode && !GENERATED_GROVE_CODES.has(s.syncCode))
                  .sort((a, b) => {
                    const aPin = savedFriends.includes(a.syncCode) ? 1 : 0;
                    const bPin = savedFriends.includes(b.syncCode) ? 1 : 0;
                    return bPin - aPin || b.prestige - a.prestige;
                  });
                const pinnedCount = savedFriends.filter((c) => !GENERATED_GROVE_CODES.has(c)).length;

                return (
                  <div className="space-y-2.5">
                    <div className="text-xs font-semibold text-[#546457]">
                      Player Sanctuaries ({pinnedCount} Pinned)
                    </div>
                    {realFriends.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 text-center space-y-1.5">
                        <div className="text-sm font-semibold text-[#233026]">
                          No Player Friends Yet
                        </div>
                        <p className="text-xs text-[#5A6B5C] leading-relaxed">
                          Share your Sync Code (<span className="font-mono-num font-bold text-[#2F6E49]">{sanctuary.syncCode}</span>) with friends or enter their code above to pin and visit real players&apos; sanctuaries.
                        </p>
                      </div>
                    ) : (
                      realFriends.map((friend) => {
                        const pinned = savedFriends.includes(friend.syncCode);
                        return (
                          <div
                            key={friend.syncCode}
                            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                              pinned
                                ? 'bg-[#FDF6E7] border-[#C9851E]/30'
                                : 'bg-[#F3ECE0] border-[#263129]/10'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                                <SpeciesIcon species={friend.avatarSpecies} className="w-7 h-7" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-semibold text-[#233026] truncate">
                                    {friend.sanctuaryName}
                                  </span>
                                  <span className="text-[10px] font-mono-num text-[#6B7A6E]">
                                    {friend.syncCode}
                                  </span>
                                </div>
                                <div className="text-xs text-[#5A6B5C]">
                                  {friend.keeperName} · Lv.{friend.level} · {friend.animalCount} animals ·{' '}
                                  <span className="font-mono-num">
                                    {friend.prestige.toLocaleString()}
                                  </span>{' '}
                                  Prestige
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onTogglePinFriend(friend.syncCode)}
                                className={`p-2 rounded-xl border cursor-pointer ${
                                  pinned
                                    ? 'bg-[#FDF1D6] border-[#C9851E]/40 text-[#C9851E]'
                                    : 'bg-[#FAF6EE] border-[#263129]/12 text-[#6B7A6E] hover:text-[#C9851E]'
                                }`}
                                title={pinned ? 'Unpin friend' : 'Pin friend'}
                              >
                                <Star className={`w-4 h-4 ${pinned ? 'fill-current' : ''}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onVisitSanctuary(friend.syncCode);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                              >
                                <Users className="w-3.5 h-3.5" />
                                Visit 3D
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })()}

              {/* Sanctuary Visitor Guestbook */}
              <div className="pt-2 border-t border-[#263129]/10 space-y-2.5">
                <h3 className="font-display font-bold text-sm text-[#233026] flex items-center gap-1.5">
                  <BookMarked className="w-4 h-4 text-[#C46B33]" />
                  Your Sanctuary Guestbook ({guestbook.length})
                </h3>
                {guestbook.length === 0 ? (
                  <p className="text-xs text-[#5A6B5C] bg-[#F3ECE0] p-3 rounded-xl">
                    When visiting keepers leave you a Care Gift, their personal guestbook notes will appear here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {guestbook.slice(0, 12).map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-xl bg-[#F3ECE0] border border-[#263129]/10 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[#233026]">
                            {entry.authorName}{' '}
                            <span className="font-mono-num text-[#6B7A6E]">({entry.authorCode})</span>
                          </span>
                          <span className="text-[#6B7A6E]">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-[#38473B] italic">&ldquo;{entry.message}&rdquo;</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== GLOBAL LEADERBOARD ==================== */}
          {activeDrawer === 'leaderboard' && (
            <div className="space-y-2.5">
              <div className="text-xs text-[#546457]">
                Global Sanctuary Prestige combines animal happiness, exotic variants, nursery babies, habitat synergy, bond levels, and decor.
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

          {/* ==================== DAILY QUESTS, STREAK & SEASONAL EVENT ==================== */}
          {activeDrawer === 'events' && (
            <div className="space-y-6">
              {/* Daily Keeper Quests */}
              <div className="p-4 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/25 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display font-bold text-base text-[#233026]">
                      Daily Keeper Quests
                    </h3>
                    <p className="text-xs text-[#4C5E50]">
                      Fresh rotating bounties every day for bonus Coins, Gems &amp; Lantern Points
                    </p>
                  </div>
                  <span className="text-[11px] font-mono-num font-semibold text-[#2F6E49]">
                    {dailyQuests.filter((q) => q.claimed).length}/{dailyQuests.length} Done
                  </span>
                </div>

                <div className="space-y-2">
                  {dailyQuests.map((q) => {
                    const pct = Math.min(100, Math.round((q.progress / Math.max(1, q.target)) * 100));
                    const ready = q.progress >= q.target && !q.claimed;
                    return (
                      <div
                        key={q.id}
                        className="p-3 rounded-xl bg-[#FAF6EE] border border-[#263129]/10 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="text-xs sm:text-sm font-semibold text-[#233026]">
                            {q.title}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-[#E3DAC8] rounded-full overflow-hidden max-w-[180px]">
                              <div
                                className="h-full bg-[#2F6E49] transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-mono-num text-[#5A6B5C]">
                              {Math.min(q.progress, q.target)}/{q.target} · +{q.rewardCoins}c +{q.rewardGems}g
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => onClaimQuest(q.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
                        >
                          {q.claimed ? 'Claimed' : ready ? 'Claim Reward' : 'In Progress'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                        <div className="text-[10px] font-mono-num font-bold text-[#5A6B5C]">
                          D{tier.day}
                        </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#546457]">
                <span className="font-mono-num font-semibold text-[#2F6E49]">
                  {onlineCount} {onlineCount === 1 ? 'Keeper' : 'Keepers'} Online
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onToggleChatNotifications}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${
                      chatNotificationsEnabled
                        ? 'bg-[#E9F2EC] border-[#2F6E49]/30 text-[#235437]'
                        : 'bg-[#F3ECE0] border-[#263129]/15 text-[#6B7A6E]'
                    }`}
                    title="Toggle live chat popups and notification chime"
                  >
                    {chatNotificationsEnabled ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-[#2F6E49]" />
                        <span>Alerts On</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5" />
                        <span>Alerts Muted</span>
                      </>
                    )}
                  </button>
                  {browserNotifPermission === 'default' && chatNotificationsEnabled && (
                    <button
                      type="button"
                      onClick={onRequestBrowserNotif}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FDF1D6] hover:bg-[#F8E5BE] border border-[#C9851E]/35 text-[#6E4510] text-[11px] font-semibold cursor-pointer transition-colors"
                      title="Enable browser desktop alerts when this tab is in the background"
                    >
                      <Bell className="w-3 h-3" />
                      <span>Enable Browser Alerts</span>
                    </button>
                  )}
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto sanctuary-scroll space-y-2.5 bg-[#F3ECE0] rounded-2xl p-3.5 border border-[#263129]/10"
              >
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8 text-xs text-[#5A6B5C] space-y-1">
                    <span className="font-semibold text-[#233026] text-sm">Community Chat is quiet</span>
                    <span>Say hello, share a trade offer, or invite fellow keepers to visit your sanctuary!</span>
                  </div>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-[#FAF6EE] flex items-center justify-center shrink-0 mt-0.5">
                        <SpeciesIcon species={m.avatarSpecies} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#233026]">{m.senderName}</span>
                          <span className="text-[#6B7A6E]">
                            {m.tag && m.tag !== 'general' ? m.tag : 'keeper'} ·{' '}
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-[#2C3A2F] break-words">{m.text}</p>
                      </div>
                    </div>
                  ))
                )}
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
                  <div className="text-xs font-semibold text-[#2F6E49]">
                    Your Cross-Platform Sync Code
                  </div>
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
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-[#2F6E49]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy Code'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await onSyncNow();
                      setSyncMessage(
                        ok ? 'Cloud sanctuary synced successfully.' : 'Saved locally; server unreachable.',
                      );
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
                    {(Object.keys(SPECIES_CATALOG) as SpeciesId[]).map((sp) => (
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
                <h3 className="text-sm font-semibold text-[#233026]">
                  Load Sanctuary From Another Device
                </h3>
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
                  <span className="font-mono-num">{sanctuary.prestige.toLocaleString()}</span>{' '}
                  Prestige · {sanctuary.enclosures.length} Animals
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
