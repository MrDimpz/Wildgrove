/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Coins,
  Gem,
  Heart,
  Leaf,
  Moon,
  Move,
  Music,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Sunrise,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ActiveDrawer, SanctuaryState, TimeOfDayId } from '../types/game';
import type { TerrainThemeId } from './DrawerModals';
import { xpRequiredForLevel } from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';

interface TopHudProps {
  sanctuary: SanctuaryState;
  visitingSanctuary: SanctuaryState | null;
  cloudStatus: 'synced' | 'saving' | 'offline';
  terrainTheme: TerrainThemeId;
  weatherEnabled: boolean;
  timeOfDay: TimeOfDayId;
  onCycleTheme: () => void;
  onCycleTimeOfDay: () => void;
  muted: boolean;
  onToggleMute: () => void;
  ambienceOn: boolean;
  onToggleAmbience: () => void;
  onEnterPhotoMode: () => void;
  pendingIdleCoins: number;
  onCollectIdleCoins: () => void;
  onResetCamera: () => void;
  onOpenDrawer: (drawer: ActiveDrawer) => void;
  onReturnHome: () => void;
  onCancelPlacement?: () => void;
  placementBanner?: string | null;
  editMode?: boolean;
  movingItemLabel?: string | null;
  movingItemIsDecor?: boolean;
  movingItemCanSell?: boolean;
  pendingEditTarget?: { gx: number; gz: number; blocked: boolean } | null;
  onConfirmEditPlacement?: () => void;
  onRotateMovingDecor?: () => void;
  onStoreMovingItem?: () => void;
  onSellMovingItem?: () => void;
  onCancelMovingItem?: () => void;
  onExitEditMode?: () => void;
  onRequestDemolish?: () => void;
  forageFoundCount?: number;
  onHintForage?: () => void;
}

export function TopHud({
  sanctuary,
  visitingSanctuary,
  cloudStatus,
  terrainTheme,
  weatherEnabled,
  timeOfDay,
  onCycleTheme,
  onCycleTimeOfDay,
  muted,
  onToggleMute,
  ambienceOn,
  onToggleAmbience,
  onEnterPhotoMode,
  pendingIdleCoins,
  onCollectIdleCoins,
  onResetCamera,
  onOpenDrawer,
  onReturnHome,
  onCancelPlacement,
  placementBanner,
  editMode,
  movingItemLabel,
  movingItemIsDecor,
  movingItemCanSell,
  pendingEditTarget,
  onConfirmEditPlacement,
  onRotateMovingDecor,
  onStoreMovingItem,
  onSellMovingItem,
  onCancelMovingItem,
  onExitEditMode,
  onRequestDemolish,
  forageFoundCount = 3,
  onHintForage,
}: TopHudProps) {
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);

  const active = visitingSanctuary || sanctuary;
  const xpNeeded = xpRequiredForLevel(sanctuary.level);
  const xpPct = Math.min(100, Math.round((sanctuary.xp / xpNeeded) * 100));

  return (
    <div className="fixed top-0 inset-x-0 z-20 p-2.5 sm:p-4 pointer-events-none flex flex-col gap-2 max-w-full overflow-hidden">
      <div className="relative flex flex-col items-start gap-2">
        {/* Main Top Pill */}
        <div className="pointer-events-auto w-full sm:w-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 bg-[#FAF6EE] border border-[#263129]/15 rounded-2xl px-3 sm:px-3.5 py-2 shadow-[0_6px_20px_rgba(32,48,34,0.12)] max-w-full">
          {/* Row 1 (Mobile) / Left Section (Desktop): Avatar, Name, Level, XP + Mobile Tools Toggle */}
          <div className="flex items-center justify-between gap-2 sm:pr-3 sm:border-r border-[#263129]/12 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EFE7D8] flex items-center justify-center shrink-0">
                <SpeciesIcon species={active.avatarSpecies} className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="font-display font-bold text-xs sm:text-base text-[#233026] truncate max-w-[140px] sm:max-w-[180px]">
                    {active.sanctuaryName}
                  </span>
                  <span className="text-[11px] sm:text-xs font-mono-num font-semibold text-[#5A6B5C] whitespace-nowrap shrink-0">
                    Lv.{active.level}
                  </span>
                </div>
                {!visitingSanctuary ? (
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 min-w-0">
                    <div className="w-16 sm:w-24 h-1.5 bg-[#E3DAC8] rounded-full overflow-hidden shrink-0">
                      <div
                        className="h-full bg-[#3A8455] transition-all duration-300"
                        style={{ width: `${xpPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] sm:text-[11px] font-mono-num text-[#617063] whitespace-nowrap shrink-0">
                      {sanctuary.xp}/{xpNeeded} XP
                    </span>
                  </div>
                ) : (
                  <div className="text-[10px] sm:text-[11px] text-[#5A6B5C] truncate max-w-[180px]">
                    Visiting {visitingSanctuary.keeperName}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile-only Tools toggle pinned to Row 1 right */}
            <button
              type="button"
              onClick={() => setShowUtilityMenu(!showUtilityMenu)}
              className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-[#233026] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Toggle Utility Actions Pulldown"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2F6E49]" />
              {showUtilityMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Row 2 (Mobile) / Right Section (Desktop): Tabular Resource Counters & Desktop Tools Toggle */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-x-3 gap-y-1.5 sm:gap-4 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[#263129]/10 text-xs sm:text-sm font-mono-num font-semibold text-[#233026] shrink-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-1 whitespace-nowrap" title="Sanctuary Coins">
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C9851E]" />
                <span>{sanctuary.coins.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-1 whitespace-nowrap" title="Exotic Gems">
                <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2B82B8]" />
                <span>{sanctuary.gems.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!visitingSanctuary && pendingIdleCoins >= 10 && (
                <button
                  type="button"
                  onClick={onCollectIdleCoins}
                  className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl bg-[#FDF1D6] hover:bg-[#F9E3B3] border border-[#C9851E]/35 text-[#6B420F] text-xs font-semibold font-mono-num cursor-pointer whitespace-nowrap"
                  title="Collect passive Sanctuary Coins earned by happy animals"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C9851E]" />
                  <span>+{pendingIdleCoins}</span>
                </button>
              )}

              {!visitingSanctuary && forageFoundCount < 3 && onHintForage && (
                <button
                  type="button"
                  onClick={onHintForage}
                  className="inline-flex items-center gap-1 px-2.5 py-1 sm:py-1.5 rounded-xl bg-[#E7F5EC] hover:bg-[#D5ECDD] border border-[#2F6E49]/30 text-[#1F5436] text-xs font-semibold font-mono-num cursor-pointer whitespace-nowrap"
                  title="Daily Hide-and-Seek Foraging: Find 3 shimmering golden acorns hidden around your meadow for a Gem Chest!"
                >
                  <Leaf className="w-3.5 h-3.5 text-[#2F6E49]" />
                  <span className="hidden sm:inline">Forage</span>
                  <span>{forageFoundCount}/3</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowUtilityMenu(!showUtilityMenu)}
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-[#233026] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ml-1"
                title="Toggle Utility Actions Pulldown"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#2F6E49]" />
                <span>Tools</span>
                {showUtilityMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Pulldown Utility Menu Panel */}
        {showUtilityMenu && (
          <div className="pointer-events-auto w-full max-w-md bg-[#FAF6EE] border border-[#263129]/15 rounded-2xl p-2.5 shadow-[0_12px_36px_rgba(32,48,34,0.22)] flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="text-[11px] font-semibold text-[#5A6B5C] px-2 py-0.5 uppercase tracking-wider flex items-center justify-between">
              <span>Sanctuary Settings &amp; Tools</span>
              <span className="text-[10px] text-[#2F6E49] font-mono font-bold">Wildgrove</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  onCycleTheme();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                {terrainTheme === 'autumn' ? (
                  <Leaf className="w-4 h-4 text-[#C9522B] shrink-0" />
                ) : terrainTheme === 'clover' ? (
                  <CloudRain className="w-4 h-4 text-[#2B82B8] shrink-0" />
                ) : terrainTheme === 'alpine' ? (
                  <Snowflake className="w-4 h-4 text-[#4B82A6] shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-[#D99528] shrink-0" />
                )}
                <span className="truncate">
                  Theme:{' '}
                  {!weatherEnabled
                    ? 'Clear'
                    : terrainTheme === 'autumn'
                      ? 'Leaves'
                      : terrainTheme === 'clover'
                        ? 'Rain'
                        : terrainTheme === 'alpine'
                          ? 'Snow'
                          : 'Sunlit'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUtilityMenu(false);
                  onOpenDrawer('sync');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <Cloud className="w-4 h-4 text-[#2F6E49] shrink-0" />
                <span className="truncate">
                  Sync: {cloudStatus === 'saving' ? 'Saving' : cloudStatus === 'synced' ? sanctuary.syncCode : 'Local'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUtilityMenu(false);
                  onOpenDrawer('share');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <Camera className="w-4 h-4 text-[#C46B33] shrink-0" />
                <span className="truncate">Share Postcard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUtilityMenu(false);
                  onOpenDrawer('manual');
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <BookOpen className="w-4 h-4 text-[#2F6E49] shrink-0" />
                <span className="truncate">Keeper Manual</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUtilityMenu(false);
                  onResetCamera();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <RotateCcw className="w-4 h-4 text-[#3B4B3E] shrink-0" />
                <span className="truncate">Reset Camera</span>
              </button>

              <button
                type="button"
                onClick={onCycleTimeOfDay}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                {timeOfDay === 'night' ? (
                  <Moon className="w-4 h-4 text-[#3B5998] shrink-0" />
                ) : timeOfDay === 'sunset' ? (
                  <Sunrise className="w-4 h-4 text-[#C96B2B] shrink-0" />
                ) : (
                  <Sun className="w-4 h-4 text-[#D99528] shrink-0" />
                )}
                <span className="truncate capitalize">Sky: {timeOfDay}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowUtilityMenu(false);
                  onEnterPhotoMode();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <Camera className="w-4 h-4 text-[#2F6E49] shrink-0" />
                <span className="truncate">Photo Mode (P)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleAmbience();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                <Music className={`w-4 h-4 shrink-0 ${ambienceOn ? 'text-[#2F6E49]' : 'text-[#7A847C]'}`} />
                <span className="truncate">Music: {ambienceOn ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onToggleMute();
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-xs font-semibold text-[#2A392D] transition-colors cursor-pointer text-left"
              >
                {muted ? (
                  <VolumeX className="w-4 h-4 text-[#C9522B] shrink-0" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#2F6E49] shrink-0" />
                )}
                <span className="truncate">{muted ? 'Unmute SFX' : 'Mute SFX'}</span>
              </button>
            </div>

            {!visitingSanctuary && onRequestDemolish && (
              <div className="pt-1.5 mt-0.5 border-t border-[#263129]/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowUtilityMenu(false);
                    onRequestDemolish();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#FCE8E8] hover:bg-[#F7D4D4] border border-[#C94B4B]/25 text-xs font-semibold text-[#8A2626] transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 shrink-0" />
                  <span>Demolish Everything &amp; Start Over</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Visiting Friend Mode Strip */}
      {visitingSanctuary && (
        <div className="pointer-events-auto self-center flex items-center gap-3 bg-[#2B5D43] text-[#FAF6EE] px-4 py-2 rounded-xl shadow-md text-xs sm:text-sm font-medium">
          <Heart className="w-4 h-4 text-[#F8B4B4] shrink-0" />
          <span>
            Visiting {visitingSanctuary.keeperName}&apos;s {visitingSanctuary.sanctuaryName} — Click any enclosure to pet &amp; gift!
          </span>
          <button
            type="button"
            onClick={onReturnHome}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#FAF6EE] text-[#233026] font-semibold text-xs hover:bg-[#EFE7D8] cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return Home
          </button>
        </div>
      )}

      {/* Active Placement Mode Strip */}
      {placementBanner && onCancelPlacement && !visitingSanctuary && (
        <div className="pointer-events-auto self-center flex items-center gap-3 bg-[#263129] text-[#FAF6EE] px-4 py-2 rounded-xl shadow-md text-xs sm:text-sm font-medium">
          <span>Placing: {placementBanner} — Click any open green tile on your meadow</span>
          <button
            type="button"
            onClick={onCancelPlacement}
            className="px-3 py-1 rounded-lg bg-[#FAF6EE] text-[#233026] font-semibold text-xs hover:bg-[#EFE7D8] cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Active Edit / Rearrange Mode Strip */}
      {editMode && !placementBanner && !visitingSanctuary && (
        <div className="pointer-events-auto self-center flex flex-wrap items-center justify-center gap-2 sm:gap-3 bg-[#8C451C] text-[#FAF6EE] px-3.5 sm:px-4 py-2 rounded-xl shadow-md text-xs sm:text-sm font-medium max-w-[96vw]">
          <Move className="w-4 h-4 shrink-0" />
          <span>
            {movingItemLabel ? (
              pendingEditTarget ? (
                pendingEditTarget.blocked ? (
                  `${movingItemLabel} — That spot is blocked, tap an open green tile`
                ) : (
                  `Place ${movingItemLabel} here? Tap Confirm or choose another tile`
                )
              ) : (
                <>
                  <span className="sm:hidden">
                    Picked up {movingItemLabel} — Tap a tile to select new placement
                  </span>
                  <span className="hidden sm:inline">
                    Moving {movingItemLabel} — Click any open green tile to place
                  </span>
                </>
              )
            ) : (
              <>
                <span className="sm:hidden">Edit Mode — Tap an item to pick it up</span>
                <span className="hidden sm:inline">
                  Edit Mode — Click any enclosure, crop, or decoration to pick it up
                </span>
              </>
            )}
          </span>
          {movingItemLabel && pendingEditTarget && onConfirmEditPlacement && (
            <button
              type="button"
              disabled={pendingEditTarget.blocked}
              onClick={onConfirmEditPlacement}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm whitespace-nowrap transition-colors ${
                pendingEditTarget.blocked
                  ? 'bg-[#FCE8E8]/20 text-[#FFD4D4] cursor-not-allowed'
                  : 'bg-[#2F6E49] hover:bg-[#24573A] text-[#FAF6EE] cursor-pointer'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              {pendingEditTarget.blocked ? 'Spot Blocked' : 'Confirm Place'}
            </button>
          )}
          {movingItemLabel && movingItemIsDecor && onRotateMovingDecor && (
            <button
              type="button"
              onClick={onRotateMovingDecor}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6EE]/18 hover:bg-[#FAF6EE]/28 text-[#FAF6EE] font-semibold text-xs cursor-pointer whitespace-nowrap"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotate
            </button>
          )}
          {movingItemLabel && onStoreMovingItem && (
            <button
              type="button"
              onClick={onStoreMovingItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FAF6EE]/18 hover:bg-[#FAF6EE]/28 text-[#FAF6EE] font-semibold text-xs cursor-pointer whitespace-nowrap"
              title="Move item safely into Storage Crate to place back later"
            >
              <Archive className="w-3.5 h-3.5" />
              Store
            </button>
          )}
          {movingItemLabel && movingItemCanSell && onSellMovingItem && (
            <button
              type="button"
              onClick={onSellMovingItem}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FCE8E8]/25 hover:bg-[#FCE8E8]/40 text-[#FFE5E5] font-semibold text-xs cursor-pointer whitespace-nowrap"
              title="Sell item for 50% Coin refund"
            >
              <Coins className="w-3.5 h-3.5" />
              Sell 50%
            </button>
          )}
          {movingItemLabel && onCancelMovingItem && (
            <button
              type="button"
              onClick={onCancelMovingItem}
              className="px-2.5 py-1 rounded-lg bg-[#FAF6EE]/18 hover:bg-[#FAF6EE]/28 text-[#FAF6EE] font-semibold text-xs cursor-pointer whitespace-nowrap"
            >
              Unselect
            </button>
          )}
          {onExitEditMode && (
            <button
              type="button"
              onClick={onExitEditMode}
              className="px-3 py-1 rounded-lg bg-[#FAF6EE] text-[#233026] font-semibold text-xs hover:bg-[#EFE7D8] cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          )}
        </div>
      )}
    </div>
  );
}
