import { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  SkipForward,
} from 'lucide-react';
import type { ActiveDrawer, SanctuaryState } from '../types/game';
import { SPECIES_CATALOG } from '../data/catalog';

interface TutorialOverlayProps {
  sanctuary: SanctuaryState;
  step: number;
  onFocusStarterAnimal: () => void;
  onOpenStarterEnclosure: () => void;
  onOpenDrawer: (drawer: ActiveDrawer) => void;
  onAdvanceStep: () => void;
  onFinishTutorial: () => void;
  onSkipTutorial: () => void;
}

export const TOTAL_TUTORIAL_STEPS = 6;

export function TutorialOverlay({
  sanctuary,
  step,
  onFocusStarterAnimal,
  onOpenStarterEnclosure,
  onOpenDrawer,
  onAdvanceStep,
  onFinishTutorial,
  onSkipTutorial,
}: TutorialOverlayProps) {
  const [minimized, setMinimized] = useState(false);

  if (step < 0 || step >= TOTAL_TUTORIAL_STEPS) return null;

  const starterEnc = sanctuary.enclosures[0] || null;
  const starterSpeciesName = starterEnc ? SPECIES_CATALOG[starterEnc.species].name : 'Companion';
  const starterLabel = starterEnc ? `${starterEnc.name} the ${starterSpeciesName}` : 'your starter animal';

  const steps: Array<{
    title: string;
    body: string;
    hint: string;
    rewardNote?: string;
    actionLabel: string;
    onAction: () => void;
    isFinal?: boolean;
  }> = [
    {
      title: `Meet ${starterLabel}`,
      body: `Welcome to ${sanctuary.sanctuaryName}, ${sanctuary.keeperName}! Drag the meadow to look around, pinch or scroll to zoom, and tap your starter enclosure to inspect your new friend.`,
      hint: 'Tap your enclosure on the 3D meadow or press Focus Animal below.',
      actionLabel: 'Focus Animal',
      onAction: () => {
        onFocusStarterAnimal();
        onOpenStarterEnclosure();
      },
    },
    {
      title: 'Animal Care: Feeding',
      body: `Keep ${starterEnc ? starterEnc.name : 'your animal'} full and cheerful by playing the Treat Toss feeding mini-game. You already have starter treats packed in your pantry.`,
      hint: 'Open your animal habitat and complete 1 Feed session to advance automatically.',
      rewardNote: '+50 Coins on completion',
      actionLabel: 'Open Animal Care',
      onAction: onOpenStarterEnclosure,
    },
    {
      title: 'Animal Care: Grooming',
      body: `Grooming boosts cleanliness, happiness, and Bond Level—and high-bond animals earn more passive Coins and unlock nursery breeding later.`,
      hint: 'Open your animal habitat and complete 1 Grooming session.',
      rewardNote: '+50 Coins on completion',
      actionLabel: 'Open Grooming',
      onAction: onOpenStarterEnclosure,
    },
    {
      title: 'Growing & Harvesting Crops',
      body: `Your meadow begins with a ripe treat crop plot right beside your habitat. Tap glowing ripe crops on the meadow to harvest treats, or open Crops to plant more.`,
      hint: 'Harvest your ripe crop (or use Care → Harvest All) to restock treats.',
      rewardNote: '+40 Coins on completion',
      actionLabel: 'Open Crops',
      onAction: () => onOpenDrawer('crops'),
    },
    {
      title: 'Building, Decorating & Edit Mode',
      body: `Open Build on the bottom dock to adopt more animals, place decorations that boost nearby habitat synergy, or expand your meadow. Use Edit anytime to move, rotate, or store items.`,
      hint: 'Place any decoration, crop, or habitat from Build—or tap Next when ready.',
      rewardNote: '+60 Coins & +3 Gems on completion',
      actionLabel: 'Open Build',
      onAction: () => onOpenDrawer('build'),
    },
    {
      title: 'Daily Tasks, Market & Friends',
      body: `Check Tasks on the dock for incremental Daily Tasks (harvest items, care sessions, building & more) with rising Coin and Gem rewards. Trade finds in Market and visit friends anytime.`,
      hint: 'You are all set to grow your sanctuary at your own pace!',
      rewardNote: 'Welcome Bonus: +100 Coins & +5 Gems',
      actionLabel: 'Open Daily Tasks',
      onAction: () => {
        onFinishTutorial();
        onOpenDrawer('events');
      },
      isFinal: true,
    },
  ];

  const current = steps[step];
  const progressPct = Math.round(((step + 1) / TOTAL_TUTORIAL_STEPS) * 100);

  if (minimized) {
    return (
      <div className="fixed top-[68px] sm:top-[76px] left-3 sm:left-5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#FAF6EE]/95 border border-[#2F6E49]/35 text-[#233026] text-xs font-semibold shadow-md hover:bg-white cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#2F6E49]" />
          <span>
            Tutorial {step + 1}/{TOTAL_TUTORIAL_STEPS}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#5A6B5C]" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="Sanctuary Guided Tutorial"
      className="fixed top-[66px] sm:top-[76px] left-3 sm:left-5 z-20 w-[calc(100vw-24px)] max-w-[356px] pointer-events-auto"
    >
      <div className="rounded-2xl bg-[#FAF6EE]/96 border border-[#263129]/15 shadow-[0_14px_38px_rgba(28,44,32,0.22)] backdrop-blur-sm overflow-hidden">
        {/* Progress hairline */}
        <div className="h-1 w-full bg-[#E5DCCB]">
          <div
            className="h-full bg-[#2F6E49] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="p-3.5 sm:p-4 space-y-2.5">
          {/* Top metadata row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#2F6E49]">
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono-num">
                Guide · Step {step + 1} of {TOTAL_TUTORIAL_STEPS}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onSkipTutorial}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#5A6B5C] hover:text-[#B83B3B] hover:bg-[#EFE7D8] transition-colors cursor-pointer whitespace-nowrap"
              >
                <SkipForward className="w-3 h-3" />
                Skip Tutorial
              </button>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                aria-label="Collapse tutorial card"
                className="p-1 rounded-lg text-[#5A6B5C] hover:text-[#233026] hover:bg-[#EFE7D8] transition-colors cursor-pointer"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Step title & body */}
          <div className="space-y-1">
            <h3 className="font-display font-bold text-sm sm:text-base text-[#233026] leading-snug">
              {current.title}
            </h3>
            <p className="text-xs text-[#435346] leading-relaxed">{current.body}</p>
            <p className="text-[11px] text-[#5F6F62]">{current.hint}</p>
            {current.rewardNote && (
              <p className="text-[11px] font-semibold text-[#2F6E49] font-mono-num">
                {current.rewardNote}
              </p>
            )}
          </div>

          {/* Interactive actions */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={current.onAction}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#2F6E49] hover:bg-[#25593B] text-[#FAF6EE] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {current.isFinal ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {current.actionLabel}
                </>
              ) : (
                <>
                  {current.actionLabel}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={current.isFinal ? onFinishTutorial : onAdvanceStep}
              className="px-3 py-2 rounded-xl bg-[#EFE7D8] hover:bg-[#E4DAC7] text-[#2B382E] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              {current.isFinal ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
