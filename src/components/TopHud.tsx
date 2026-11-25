/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudRain,
  Coins,
  Gem,
  Heart,
  Leaf,
  RotateCcw,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { ActiveDrawer, SanctuaryState } from '../types/game';
import type { TerrainThemeId } from './DrawerModals';
import { xpRequiredForLevel } from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';

interface TopHudProps {
  sanctuary: SanctuaryState;
  visitingSanctuary: SanctuaryState | null;
  cloudStatus: 'synced' | 'saving' | 'offline';
  terrainTheme: TerrainThemeId;
  weatherEnabled: boolean;
  onCycleTheme: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onResetCamera: () => void;
  onOpenDrawer: (drawer: ActiveDrawer) => void;
  onReturnHome: () => void;
  onCancelPlacement?: () => void;
  placementBanner?: string | null;
}

export function TopHud({
  sanctuary,
  visitingSanctuary,
  cloudStatus,
  terrainTheme,
  weatherEnabled,
  onCycleTheme,
  muted,
  onToggleMute,
  onResetCamera,
  onOpenDrawer,
  onReturnHome,
  onCancelPlacement,
  placementBanner,
}: TopHudProps) {
  const [showUtilityMenu, setShowUtilityMenu] = useState(false);

  const active = visitingSanctuary || sanctuary;
  const xpNeeded = xpRequiredForLevel(sanctuary.level);
  const xpPct = Math.min(100, Math.round((sanctuary.xp / xpNeeded) * 100));

  return (
    <div className="fixed top-0 inset-x-0 z-20 p-2.5 sm:p-4 pointer-events-none flex flex-col gap-2 max-w-full overflow-hidden">
      <div className="relative flex flex-col items-start gap-2">
        {/* Main Top Pill */}
        <div className="pointer-events-auto flex items-center justify-between gap-3 bg-[#FAF6EE] border border-[#263129]/15 rounded-2xl px-3.5 py-2 shadow-[0_6px_20px_rgba(32,48,34,0.12)] max-w-full">
          <div className="flex items-center gap-2.5 pr-2 sm:pr-3 sm:border-r border-[#263129]/12 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#EFE7D8] flex items-center justify-center shrink-0">
              <SpeciesIcon species={active.avatarSpecies} className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-display font-bold text-xs sm:text-base text-[#233026] truncate max-w-[120px] sm:max-w-[180px]">
                  {active.sanctuaryName}
                </span>
                <span className="text-[11px] sm:text-xs font-mono-num font-semibold text-[#5A6B5C] whitespace-nowrap">
                  Lv.{active.level}
                </span>
              </div>
              {!visitingSanctuary ? (
                <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
                  <div className="w-20 sm:w-24 h-1.5 bg-[#E3DAC8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3A8455] transition-all duration-300"
                      style={{ width: `${xpPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-mono-num text-[#617063] whitespace-nowrap">
                    {sanctuary.xp}/{xpNeeded} XP
                  </span>
                </div>
              ) : (
                <div className="text-[10px] sm:text-[11px] text-[#5A6B5C] truncate max-w-[160px]">
                  Visiting {visitingSanctuary.keeperName}
                </div>
              )}
            </div>
          </div>

          {/* Tabular Resource Counters & Pulldown Toggle */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm font-mono-num font-semibold text-[#233026] shrink-0">
            <div className="flex items-center gap-1 whitespace-nowrap" title="Sanctuary Coins">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#C9851E]" />
              <span>{sanctuary.coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1 whitespace-nowrap" title="Exotic Gems">
              <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#2B82B8]" />
              <span>{sanctuary.gems.toLocaleString()}</span>
            </div>

            <button
              type="button"
              onClick={() => setShowUtilityMenu(!showUtilityMenu)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E5DCCB] text-[#233026] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ml-1"
              title="Toggle Utility Actions Pulldown"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#2F6E49]" />
              <span className="hidden sm:inline">Tools</span>
              {showUtilityMenu ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
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
                <span className="truncate">{muted ? 'Unmute Audio' : 'Mute Audio'}</span>
              </button>
            </div>
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
    </div>
  );
}
