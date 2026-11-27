import { useState } from 'react';
import { Dices, Play, SkipForward, Trees, X } from 'lucide-react';
import type { SpeciesId } from '../types/game';
import type { TerrainThemeId } from './DrawerModals';
import { SPECIES_CATALOG } from '../data/catalog';
import { SpeciesIcon } from './SpeciesIcon';

export interface NewFarmSetupPayload {
  keeperName: string;
  sanctuaryName: string;
  sanctuaryMotto: string;
  preferredTheme: TerrainThemeId;
  avatarSpecies?: SpeciesId; // undefined => match random starter animal
  skipTutorial: boolean;
}

interface NewFarmModalProps {
  canCancel?: boolean;
  onCancel?: () => void;
  onConfirm: (payload: NewFarmSetupPayload) => void;
}

const SANCTUARY_NAME_IDEAS = [
  'Sunlit Wildgrove',
  'Whispering Pines',
  'Cloverbend Haven',
  'Mossy Creek Meadow',
  'Lanternbrook Hollow',
  'Golden Fern Glade',
  'Bramblewood Sanctuary',
  'Dewdrop Valley',
];

const THEME_OPTIONS: Array<{
  id: TerrainThemeId;
  label: string;
  note: string;
  swatch: string;
}> = [
  { id: 'meadow', label: 'Sunlit Meadow', note: 'Warm grass & drifting pollen', swatch: '#78B856' },
  { id: 'autumn', label: 'Harvest Loam', note: 'Golden soil & maple leaves', swatch: '#C96D33' },
  { id: 'clover', label: 'Riverbank Clover', note: 'Lush clover & gentle rain', swatch: '#4E9A68' },
  { id: 'alpine', label: 'Alpine Moss', note: 'Cool highlands & soft snow', swatch: '#7FA3B8' },
];

const SPECIES_LIST = Object.values(SPECIES_CATALOG);

export function NewFarmModal({ canCancel, onCancel, onConfirm }: NewFarmModalProps) {
  const [keeperName, setKeeperName] = useState('');
  const [sanctuaryName, setSanctuaryName] = useState('');
  const [sanctuaryMotto, setSanctuaryMotto] = useState('');
  const [preferredTheme, setPreferredTheme] = useState<TerrainThemeId>('meadow');
  const [avatarChoice, setAvatarChoice] = useState<'starter' | SpeciesId>('starter');
  const [error, setError] = useState('');

  const handleShuffleName = () => {
    const next =
      SANCTUARY_NAME_IDEAS[Math.floor(Math.random() * SANCTUARY_NAME_IDEAS.length)];
    setSanctuaryName(next);
  };

  const submit = (skipTutorial: boolean) => {
    const cleanKeeper = keeperName.trim();
    const cleanSanctuary = sanctuaryName.trim();
    if (!cleanKeeper) {
      setError('Please enter your keeper display name to begin.');
      return;
    }
    if (!cleanSanctuary) {
      setError('Please give your new sanctuary a name.');
      return;
    }
    setError('');
    onConfirm({
      keeperName: cleanKeeper.slice(0, 24),
      sanctuaryName: cleanSanctuary.slice(0, 32),
      sanctuaryMotto: sanctuaryMotto.trim().slice(0, 80),
      preferredTheme,
      avatarSpecies: avatarChoice === 'starter' ? undefined : avatarChoice,
      skipTutorial,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#142018]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-farm-heading"
    >
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl bg-[#FAF6EE] border border-[#263129]/15 shadow-[0_24px_64px_rgba(20,34,24,0.34)] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#263129]/10 flex items-start justify-between gap-4">
          <div>
            <h2
              id="new-farm-heading"
              className="font-display font-bold text-xl sm:text-2xl text-[#233026] leading-tight"
              style={{ textWrap: 'balance' }}
            >
              Found Your Sanctuary
            </h2>
            <p className="text-xs sm:text-sm text-[#4D5D50] mt-1">
              Set up your keeper profile. Every new farm begins with one mystery starter animal, two cozy decorations, and a ripe treat crop.
            </p>
          </div>
          {canCancel && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close setup"
              className="p-2 rounded-xl text-[#4D5D50] hover:text-[#233026] hover:bg-[#EFE7D8] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Display Name & Sanctuary Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="keeper-display-name"
                className="block text-xs font-semibold text-[#2C3B30]"
              >
                Display Name
              </label>
              <input
                id="keeper-display-name"
                type="text"
                value={keeperName}
                onChange={(e) => {
                  setKeeperName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Maya"
                maxLength={24}
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#263129]/18 text-sm text-[#233026] placeholder:text-[#8A978C] focus:outline-none focus:ring-2 focus:ring-[#2F6E49]"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="sanctuary-farm-name"
                  className="block text-xs font-semibold text-[#2C3B30]"
                >
                  Sanctuary Name
                </label>
                <button
                  type="button"
                  onClick={handleShuffleName}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2F6E49] hover:text-[#225437] cursor-pointer"
                >
                  <Dices className="w-3.5 h-3.5" />
                  Suggest
                </button>
              </div>
              <input
                id="sanctuary-farm-name"
                type="text"
                value={sanctuaryName}
                onChange={(e) => {
                  setSanctuaryName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Whispering Pines"
                maxLength={32}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#263129]/18 text-sm text-[#233026] placeholder:text-[#8A978C] focus:outline-none focus:ring-2 focus:ring-[#2F6E49]"
              />
            </div>
          </div>

          {/* Sanctuary Motto / Welcome Note */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="sanctuary-motto"
                className="block text-xs font-semibold text-[#2C3B30]"
              >
                Sanctuary Motto
              </label>
              <span className="text-[11px] text-[#6B7A6E]">Optional</span>
            </div>
            <input
              id="sanctuary-motto"
              type="text"
              value={sanctuaryMotto}
              onChange={(e) => setSanctuaryMotto(e.target.value)}
              placeholder="A peaceful hillside haven for curious forest friends"
              maxLength={80}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#263129]/18 text-sm text-[#233026] placeholder:text-[#8A978C] focus:outline-none focus:ring-2 focus:ring-[#2F6E49]"
            />
          </div>

          {/* Starting Meadow Climate */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2C3B30]">
              <Trees className="w-3.5 h-3.5 text-[#2F6E49]" />
              <span>Starting Meadow Landscape</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {THEME_OPTIONS.map((t) => {
                const active = preferredTheme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPreferredTheme(t.id)}
                    className={`text-left px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E9F2EC] border-[#2F6E49] text-[#233026]'
                        : 'bg-[#F3ECE0]/70 border-[#263129]/10 text-[#3B4B3E] hover:bg-[#EFE7D8]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0 border border-black/15"
                        style={{ backgroundColor: t.swatch }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold truncate">{t.label}</span>
                    </div>
                    <div className="text-[11px] text-[#5B6B5E] mt-0.5 truncate">{t.note}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Keeper Badge Emblem */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#2C3B30]">Keeper Emblem</span>
              <span className="text-[11px] text-[#5B6B5E]">
                {avatarChoice === 'starter'
                  ? 'Matches your random starter animal'
                  : SPECIES_CATALOG[avatarChoice].name}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAvatarChoice('starter')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  avatarChoice === 'starter'
                    ? 'bg-[#2F6E49] border-[#2F6E49] text-white'
                    : 'bg-[#F3ECE0] border-[#263129]/12 text-[#3B4B3E] hover:bg-[#EAE1D0]'
                }`}
              >
                Match Starter
              </button>
              {SPECIES_LIST.map((sp) => {
                const selected = avatarChoice === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setAvatarChoice(sp.id)}
                    title={sp.name}
                    aria-label={`Choose ${sp.name} emblem`}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                      selected
                        ? 'bg-[#E9F2EC] border-[#2F6E49] ring-1 ring-[#2F6E49]'
                        : 'bg-[#F3ECE0] border-[#263129]/10 hover:bg-[#EAE1D0]'
                    }`}
                  >
                    <SpeciesIcon species={sp.id} className="w-6 h-6" />
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p className="text-xs font-semibold text-[#B83B3B] bg-[#FBE9E7] border border-[#B83B3B]/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="px-6 py-4 bg-[#F3ECE0] border-t border-[#263129]/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => submit(true)}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FAF6EE] hover:bg-white border border-[#263129]/15 text-[#3B4B3E] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip Tutorial
          </button>

          <button
            type="button"
            onClick={() => submit(false)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] text-sm font-semibold shadow-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Play className="w-4 h-4 fill-current" />
            Create Sanctuary &amp; Start Tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
