import { Camera, Compass, Eye, Moon, Orbit, Sun, Sunrise, X } from 'lucide-react';
import type { TimeOfDayId } from '../types/game';
import type { PhotoCameraPreset } from '../three/SanctuaryEngine';

interface PhotoModeOverlayProps {
  sanctuaryName: string;
  timeOfDay: TimeOfDayId;
  activePreset: PhotoCameraPreset;
  onSelectPreset: (preset: PhotoCameraPreset) => void;
  onCycleTimeOfDay: () => void;
  onSnapPostcard: () => void;
  onExit: () => void;
}

export function PhotoModeOverlay({
  sanctuaryName,
  timeOfDay,
  activePreset,
  onSelectPreset,
  onCycleTimeOfDay,
  onSnapPostcard,
  onExit,
}: PhotoModeOverlayProps) {
  const presets: Array<{ id: PhotoCameraPreset; label: string; icon: typeof Compass }> = [
    { id: 'iso', label: 'Isometric', icon: Compass },
    { id: 'scenic', label: 'Low Scenic', icon: Eye },
    { id: 'top', label: 'Aerial', icon: Sun },
    { id: 'orbit', label: 'Turntable', icon: Orbit },
  ];

  return (
    <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 bg-[#FAF6EE]/95 border border-[#263129]/15 rounded-2xl px-3.5 py-2.5 shadow-[0_14px_40px_rgba(24,36,26,0.26)] max-w-[96vw]">
        <span className="hidden sm:inline font-display font-bold text-xs text-[#233026] pr-2 border-r border-[#263129]/15">
          Photo Studio · {sanctuaryName}
        </span>

        <div className="flex items-center gap-1 bg-[#EFE7D8] p-1 rounded-xl">
          {presets.map((p) => {
            const Icon = p.icon;
            const active = activePreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  active ? 'bg-[#2F6E49] text-white' : 'text-[#354438] hover:bg-[#E4DAC7]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCycleTimeOfDay}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFE7D8] hover:bg-[#E4DAC7] text-xs font-semibold text-[#233026] cursor-pointer whitespace-nowrap"
          title="Switch Time of Day Lighting"
        >
          {timeOfDay === 'night' ? (
            <Moon className="w-3.5 h-3.5 text-[#3B5998]" />
          ) : timeOfDay === 'sunset' ? (
            <Sunrise className="w-3.5 h-3.5 text-[#C96B2B]" />
          ) : (
            <Sun className="w-3.5 h-3.5 text-[#D99528]" />
          )}
          <span className="capitalize">{timeOfDay}</span>
        </button>

        <button
          type="button"
          onClick={onSnapPostcard}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#C46B33] hover:bg-[#AB5A28] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Snap Postcard</span>
        </button>

        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#263129] hover:bg-[#19221B] text-[#FAF6EE] text-xs font-semibold cursor-pointer whitespace-nowrap"
        >
          <X className="w-3.5 h-3.5" />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
}
