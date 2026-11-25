import { useState } from 'react';
import { BookOpen, Cloud, Compass, Hammer, Heart, Sparkles } from 'lucide-react';
import type { SpeciesId } from '../types/game';
import { RESOURCE_CATALOG, SPECIES_CATALOG } from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';

type ManualSection = 'basics' | 'species' | 'habitats' | 'social';

export function ManualContent() {
  const [section, setSection] = useState<ManualSection>('basics');

  return (
    <div className="space-y-4">
      {/* Section Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFE7D8] rounded-xl">
        {(
          [
            ['basics', 'Basics & Controls', Compass],
            ['species', 'Animals & Care', Heart],
            ['habitats', 'Habitats & Weather', Hammer],
            ['social', 'Social & Cloud Sync', Cloud],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              section === id
                ? 'bg-[#FAF6EE] text-[#233026] shadow-sm'
                : 'text-[#556658] hover:text-[#233026]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 1. BASICS & CONTROLS */}
      {section === 'basics' && (
        <div className="space-y-4 text-sm text-[#2E3C31]">
          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2">
            <h3 className="font-display font-bold text-base text-[#233026] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2F6E49]" />
              Core Sanctuary Loop
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-[#3E4E41] leading-relaxed">
              <li>
                <strong>Grow &amp; Harvest Treats:</strong> Open <em>Crops</em> to plant berry bushes, mango trees, lavender beds, or alpine herbs. When a crop glows with a golden ring, click it to harvest treats and Coins.
              </li>
              <li>
                <strong>Feed &amp; Groom Your Animals:</strong> Click any 3D animal enclosure to open its care station. Play the <em>Treat Toss</em> timing mini-game and the <em>Brush &amp; Care</em> scrubbing mini-game to raise Happiness, Bond Level, and collect rare keepsakes.
              </li>
              <li>
                <strong>Design Your Meadow:</strong> Open <em>Build</em> to place custom enclosures, flora, ponds, and festival lanterns, or switch terrain themes and live weather.
              </li>
              <li>
                <strong>Trade, Visit &amp; Compete:</strong> Sell rare drops on the live <em>Market</em>, visit friends&apos; 3D sanctuaries for Care Gift coins, and climb the Global Prestige <em>Ranks</em>.
              </li>
            </ol>
          </div>

          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2.5">
            <h3 className="font-display font-bold text-base text-[#233026]">
              Camera &amp; Keyboard Controls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                ['Left Drag / 1-Finger Drag', 'Orbit isometric camera around your meadow'],
                ['Scroll Wheel / Pinch', 'Zoom in on enclosures or out to overview'],
                ['Right Drag / WASD / Arrows', 'Pan smoothly across the sanctuary'],
                ['Click / Tap Plot', 'Open enclosure care, harvest ready crop, or place item'],
                ['R Key (or Rotate button)', 'Rotate a decoration 90° before placing'],
                ['H Key (or Hide Dock)', 'Toggle Zen View to admire your 3D world'],
                ['Esc Key', 'Cancel placement mode or close open panels'],
              ].map(([keyLabel, desc]) => (
                <div
                  key={keyLabel}
                  className="p-2.5 rounded-xl bg-[#FAF6EE] border border-[#263129]/10 flex flex-col gap-0.5"
                >
                  <span className="font-mono-num font-semibold text-[#2F6E49]">{keyLabel}</span>
                  <span className="text-[#546457]">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. SPECIES & CARE MINI-GAMES */}
      {section === 'species' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.keys(SPECIES_CATALOG) as SpeciesId[]).map((spId) => {
              const sp = SPECIES_CATALOG[spId];
              const treat = RESOURCE_CATALOG[sp.favoriteTreat];
              const rare = RESOURCE_CATALOG[sp.rareDrop];
              return (
                <div
                  key={sp.id}
                  className="p-3.5 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] flex items-center justify-center shrink-0">
                      <SpeciesIcon species={sp.id} className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#233026]">{sp.name}</div>
                      <div className="text-xs text-[#5A6B5C]">{sp.habitatTitle}</div>
                    </div>
                  </div>
                  <div className="text-xs text-[#435346] space-y-1">
                    <div>
                      Favorite Treat: <strong>{treat.name}</strong>
                    </div>
                    <div>
                      Rare Drop: <strong>{rare.name}</strong>
                    </div>
                    <div>
                      Exotic Morph: <strong>{sp.exoticName}</strong> ({sp.exoticCostGems} Gems)
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-2xl bg-[#E9F2EC] border border-[#2F6E49]/20 space-y-2 text-xs text-[#2B3E30]">
            <div className="font-semibold text-sm text-[#233026] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#C9851E]" />
              Mastering Feeding &amp; Grooming Mini-Games
            </div>
            <p>
              <strong>Treat Toss (Feeding):</strong> Tap <em>Toss</em> over 5 rounds as the green slider passes through the golden target zone. Consecutive catches build a Combo Multiplier for extra Coins, Bond Levels, and a higher chance of Rare Drops.
            </p>
            <p>
              <strong>Brush &amp; Care (Grooming):</strong> Drag your mouse or finger across every mud, burr, or pollen patch until cleanliness passes 88% to guarantee a Rare Collectible drop and trigger a happy 3D celebration inside the enclosure.
            </p>
          </div>
        </div>
      )}

      {/* 3. HABITATS, GRID & WEATHER */}
      {section === 'habitats' && (
        <div className="space-y-4 text-xs sm:text-sm text-[#3E4E41]">
          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2">
            <h3 className="font-display font-bold text-base text-[#233026]">
              Grid-Based Habitat Customization
            </h3>
            <p className="leading-relaxed">
              Your sanctuary meadow is a <strong>12×12 tile grid</strong>. Animal enclosures occupy a <strong>2×2</strong> footprint, while crops, flora, ponds, and pathways occupy <strong>1×1</strong> tiles. While placing an item, hover or tap open land—<strong>green</strong> indicates a valid spot and <strong>coral</strong> indicates a blocked tile.
            </p>
            <p className="leading-relaxed">
              Every enclosure, decoration, Exotic Variant, and Bond Level increases your <strong>Sanctuary Prestige</strong>, which determines your global rank.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-2">
            <h3 className="font-display font-bold text-base text-[#233026]">
              Environment Themes &amp; Procedural Weather
            </h3>
            <p className="leading-relaxed">
              Click the weather icon in the top-right bar or open <strong>Build → Terrain Aesthetics</strong> to switch biome turf, lighting, and live 3D weather:
            </p>
            <ul className="space-y-1 text-xs text-[#4B5A4E] list-disc list-inside">
              <li><strong>Sunlit Meadow:</strong> Warm pasture sunlight with drifting golden pollen and petals.</li>
              <li><strong>Harvest Loam:</strong> Golden autumn glow with tumbling crimson and amber maple leaves.</li>
              <li><strong>Riverbank Clover:</strong> Lush creekside turf with gentle sunshower rain and ground ripples.</li>
              <li><strong>Alpine Moss:</strong> Crisp pine highland tones with softly drifting mountain snowfall.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 4. SOCIAL, TRADING & CLOUD SYNC */}
      {section === 'social' && (
        <div className="space-y-3 text-xs sm:text-sm text-[#3E4E41]">
          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-1.5">
            <h3 className="font-display font-bold text-base text-[#233026]">
              Cross-Platform Cloud Saving
            </h3>
            <p className="leading-relaxed">
              Your sanctuary saves automatically to the cloud under your unique <strong>Sync Code</strong> (e.g., <code className="font-mono-num font-semibold text-[#2F6E49]">GROVE-XXXX</code>). Open the Cloud button in the top-right bar to copy your code, customize your Keeper Name, or enter your code on a phone or PC to resume seamlessly.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#F3ECE0] border border-[#263129]/10 space-y-1.5">
            <h3 className="font-display font-bold text-base text-[#233026]">
              Visiting Friends, Marketplace &amp; Live Chat
            </h3>
            <p className="leading-relaxed">
              Open <strong>Friends</strong> and choose <em>Visit 3D</em> to walk around another keeper&apos;s live sanctuary. Tap their enclosures to leave a Care Gift (+40 Coins &amp; Festival Points for you, +1 Heart for them). Use <strong>Market</strong> to trade rare resources with real players, <strong>Events</strong> for your 7-day login streak &amp; Harvest Festival milestones, <strong>Chat</strong> for real-time community conversation, and <strong>Share</strong> to capture a downloadable 3D postcard.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
