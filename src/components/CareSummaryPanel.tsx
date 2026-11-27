import { useEffect, useState } from 'react';
import {
  Coins,
  Crosshair,
  Droplets,
  Leaf,
  Sparkles,
  Sprout,
  Zap,
} from 'lucide-react';
import type { SanctuaryState } from '../types/game';
import {
  CROP_CATALOG,
  CROP_GROW_DURATION_MS,
  SPECIES_CATALOG,
  computeEnclosureSynergy,
  formatMinSec,
} from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';

interface CareSummaryPanelProps {
  sanctuary: SanctuaryState;
  pendingIdleCoins: number;
  onCollectIdleCoins: () => void;
  onHarvestAll: () => void;
  onHarvestSingle: (cropId: string) => void;
  onFertilizeCrop: (cropId: string) => void;
  onInstantBloomCrop: (cropId: string) => void;
  onJumpToEnclosure: (enclosureId: string) => void;
}

export function CareSummaryPanel({
  sanctuary,
  pendingIdleCoins,
  onCollectIdleCoins,
  onHarvestAll,
  onHarvestSingle,
  onFertilizeCrop,
  onInstantBloomCrop,
  onJumpToEnclosure,
}: CareSummaryPanelProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const readyCrops = sanctuary.crops.filter((c) => {
    const dur = c.growDurationMs || CROP_GROW_DURATION_MS;
    return nowMs - c.plantedAt >= dur;
  });

  const fertilizerCount = sanctuary.inventory.sunbeam_fertilizer || 0;
  const sprinklerCount = sanctuary.inventory.meadow_sprinkler || 0;

  return (
    <div className="space-y-5">
      {/* Quick Sanctuary Action Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/25 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#233026] flex items-center gap-1.5">
              <Sprout className="w-4 h-4 text-[#2F6E49]" />
              Ready Harvests
            </div>
            <div className="text-[11px] text-[#4C5E50] mt-0.5">
              {readyCrops.length} of {sanctuary.crops.length} plots ready now
            </div>
          </div>
          <button
            type="button"
            disabled={readyCrops.length === 0}
            onClick={onHarvestAll}
            className="px-3.5 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer disabled:opacity-45 whitespace-nowrap"
          >
            Harvest All ({readyCrops.length})
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#FDF1D6] border border-[#C9851E]/30 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-[#5C3A0E] flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-[#C9851E]" />
              Sanctuary Idle Income
            </div>
            <div className="text-[11px] text-[#7A5424] mt-0.5">
              Happy habitats earn passive Coins over time
            </div>
          </div>
          <button
            type="button"
            disabled={pendingIdleCoins < 1}
            onClick={onCollectIdleCoins}
            className="px-3.5 py-2 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-xs font-semibold font-mono-num cursor-pointer disabled:opacity-45 whitespace-nowrap"
          >
            +{pendingIdleCoins} Coins
          </button>
        </div>
      </div>

      {/* Animal Care & Synergy Directory */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-[#233026]">
            Animals &amp; Care Status ({sanctuary.enclosures.length})
          </h3>
          <span className="text-[11px] text-[#5A6B5C]">Tap Jump to focus &amp; care</span>
        </div>

        <div className="space-y-2">
          {sanctuary.enclosures.map((enc) => {
            const sp = SPECIES_CATALOG[enc.species];
            const synergy = computeEnclosureSynergy(enc, sanctuary.decorations);
            const needsCare = enc.hunger < 65 || enc.grooming < 65;
            return (
              <div
                key={enc.id}
                className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
                  needsCare
                    ? 'bg-[#FDF3E7] border-[#C46B33]/35'
                    : 'bg-[#F3ECE0] border-[#263129]/10'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                    <SpeciesIcon
                      species={enc.species}
                      exotic={enc.variant === 'exotic'}
                      className="w-7 h-7"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold text-[#233026] truncate">
                        {enc.name}
                      </span>
                      <span className="text-[11px] font-mono-num text-[#5A6B5C]">
                        Lv.{enc.bondLevel}
                      </span>
                      {enc.isBaby && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#FCE8F0] text-[#8A2E56]">
                          Baby
                        </span>
                      )}
                      {synergy.bonusPrestige > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#E6F3EA] text-[#2F6E49]">
                          <Leaf className="w-2.5 h-2.5" />+{synergy.bonusPrestige}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#5A6B5C] font-mono-num mt-0.5">
                      {sp.name} · Full {enc.hunger}% · Groom {enc.grooming}% · Happy {enc.happiness}%
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onJumpToEnclosure(enc.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  Jump
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Planted Crops & Boosters */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display font-bold text-sm text-[#233026]">
            Crop Timers &amp; Boosters ({sanctuary.crops.length})
          </h3>
          <span className="text-[11px] font-mono-num text-[#5A6B5C]">
            Compost: {fertilizerCount} · Bloom Elixir: {sprinklerCount}
          </span>
        </div>

        {sanctuary.crops.length === 0 ? (
          <p className="text-xs text-[#5A6B5C] bg-[#F3ECE0] rounded-xl p-3">
            No crop plots planted yet. Open the Crops drawer to plant treat crops!
          </p>
        ) : (
          <div className="space-y-2">
            {sanctuary.crops.map((crop) => {
              const def = CROP_CATALOG[crop.cropType];
              const dur = crop.growDurationMs || CROP_GROW_DURATION_MS;
              const remainingMs = Math.max(0, dur - (nowMs - crop.plantedAt));
              const isReady = remainingMs === 0;
              return (
                <div
                  key={crop.id}
                  className="p-3 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#233026] flex items-center gap-1.5">
                      <span>{def.name}</span>
                      {crop.fertilized && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[#E6F3EA] text-[#2F6E49] font-semibold">
                          <Sparkles className="w-2.5 h-2.5" />
                          2× Yield
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono-num text-[#5A6B5C]">
                      {isReady ? 'Ready to harvest!' : `Ready in ${formatMinSec(remainingMs)}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isReady ? (
                      <button
                        type="button"
                        onClick={() => onHarvestSingle(crop.id)}
                        className="px-3 py-1.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-white text-xs font-semibold cursor-pointer"
                      >
                        Harvest
                      </button>
                    ) : (
                      <>
                        {!crop.fertilized && (
                          <button
                            type="button"
                            disabled={fertilizerCount < 1}
                            onClick={() => onFertilizeCrop(crop.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E4DAC7] border border-[#263129]/12 text-[#233026] text-[11px] font-semibold cursor-pointer disabled:opacity-45"
                            title="Use Sunbeam Compost (-50% time & 2× yield)"
                          >
                            <Droplets className="w-3 h-3 text-[#2F6E49]" />
                            Compost
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={sprinklerCount < 1 && sanctuary.gems < 1}
                          onClick={() => onInstantBloomCrop(crop.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#2A6F97] hover:bg-[#21597A] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-45"
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
        )}
      </div>
    </div>
  );
}
