import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Gift,
  Hammer,
  Hand,
  MessageCircle,
  Move,
  RotateCw,
  Sprout,
  Store,
  Trophy,
  Users,
} from 'lucide-react';
import type { ActiveDrawer } from '../types/game';
import type { TouchDragMode } from '../three/SanctuaryEngine';

interface BottomDockProps {
  activeDrawer: ActiveDrawer;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectDrawer: (drawer: ActiveDrawer) => void;
  editMode: boolean;
  onToggleEditMode: () => void;
  hasUnclaimedDaily: boolean;
  hasReadyCare?: boolean;
  unreadChatCount: number;
  visitingMode: boolean;
  touchDragMode: TouchDragMode;
  onChangeTouchDragMode: (mode: TouchDragMode) => void;
}

const DOCK_ITEMS: Array<{
  id: Exclude<ActiveDrawer, null | 'sync' | 'share' | 'manual'>;
  label: string;
  icon: typeof Hammer;
  disableWhenVisiting?: boolean;
}> = [
  { id: 'build', label: 'Build', icon: Hammer, disableWhenVisiting: true },
  { id: 'crops', label: 'Crops', icon: Sprout, disableWhenVisiting: true },
  { id: 'summary', label: 'Care', icon: ClipboardList, disableWhenVisiting: true },
  { id: 'market', label: 'Market', icon: Store },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy },
  { id: 'events', label: 'Tasks', icon: Gift },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export function BottomDock({
  activeDrawer,
  collapsed,
  onToggleCollapse,
  onSelectDrawer,
  editMode,
  onToggleEditMode,
  hasUnclaimedDaily,
  hasReadyCare,
  unreadChatCount,
  visitingMode,
  touchDragMode,
  onChangeTouchDragMode,
}: BottomDockProps) {
  return (
    <div
      className={`fixed bottom-0 pb-2.5 sm:pb-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200 w-[calc(100vw-20px)] max-w-[420px] sm:w-auto sm:max-w-[95vw] ${
        collapsed ? 'translate-y-[calc(100%-38px)] sm:translate-y-[calc(100%-30px)]' : 'translate-y-0'
      }`}
    >
      {/* Top Row above Dock: Hide/Show Tab + Mobile Right-Side Scroll/Rotate Toggle */}
      <div className="w-full relative flex items-end justify-start pl-2 min-[390px]:justify-center min-[390px]:pl-0 sm:justify-center h-[38px] sm:h-[30px]">
        {/* Collapsible Pull-Up / Hide Toggle Tab */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex items-center gap-1 h-[30px] px-3.5 rounded-t-xl bg-[#FAF6EE] border border-b-0 border-[#263129]/15 text-[11px] font-semibold text-[#4B5B4E] hover:text-[#233026] cursor-pointer shadow-sm"
          title="Toggle Control Dock (H)"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Dock</span>
              {unreadChatCount > 0 && (
                <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#D4622A] text-white text-[10px] font-mono-num font-bold leading-none animate-pulse">
                  <MessageCircle className="w-2.5 h-2.5" />
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Dock</span>
            </>
          )}
        </button>

        {/* Mobile Finger-Drag Toggle: Scroll (Pan) vs Rotate */}
        <div
          role="group"
          aria-label="Finger drag mode"
          className="sm:hidden absolute right-0 bottom-1.5 inline-flex items-center p-0.5 rounded-xl bg-[#FAF6EE]/95 border border-[#263129]/15 shadow-sm backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => onChangeTouchDragMode('pan')}
            aria-pressed={touchDragMode === 'pan'}
            className={`inline-flex items-center gap-1 h-[26px] px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              touchDragMode === 'pan'
                ? 'bg-[#2F6E49] text-[#FAF6EE] shadow-xs'
                : 'text-[#4B5B4E] hover:text-[#233026]'
            }`}
            title="Finger drag scrolls around the sanctuary"
          >
            <Hand className="w-3.5 h-3.5 shrink-0" />
            {touchDragMode === 'pan' && <span>Scroll</span>}
          </button>
          <button
            type="button"
            onClick={() => onChangeTouchDragMode('rotate')}
            aria-pressed={touchDragMode === 'rotate'}
            className={`inline-flex items-center gap-1 h-[26px] px-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
              touchDragMode === 'rotate'
                ? 'bg-[#C46B33] text-[#FAF6EE] shadow-xs'
                : 'text-[#4B5B4E] hover:text-[#233026]'
            }`}
            title="Finger drag rotates the camera"
          >
            <RotateCw className="w-3.5 h-3.5 shrink-0" />
            {touchDragMode === 'rotate' && <span>Rotate</span>}
          </button>
        </div>
      </div>

      {/* Mobile: Full 3x3 Pull-Up Grid (all 9 options visible) | Desktop: Single Horizontal Bar */}
      <nav
        aria-label="Sanctuary Controls"
        className="w-full sm:w-auto grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-1.5 bg-[#FAF6EE] border border-[#263129]/15 rounded-2xl p-2 sm:p-1.5 shadow-[0_12px_36px_rgba(32,48,34,0.18)] sm:overflow-x-auto sm:max-w-[94vw]"
      >
        {DOCK_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const isActive = activeDrawer === item.id;
          const isDisabled = visitingMode && item.disableWhenVisiting;

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDrawer(isActive ? null : item.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-colors whitespace-nowrap sm:shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#2F6E49] text-[#FAF6EE]'
                  : 'text-[#2C3A2F] bg-[#F3ECE0]/60 sm:bg-transparent hover:bg-[#EFE7D8]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Rearrange / Edit Layout Toggle */}
        <button
          type="button"
          disabled={visitingMode}
          onClick={onToggleEditMode}
          className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-colors whitespace-nowrap sm:shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            editMode
              ? 'bg-[#C46B33] text-[#FAF6EE]'
              : 'text-[#2C3A2F] bg-[#F3ECE0]/60 sm:bg-transparent hover:bg-[#EFE7D8]'
          }`}
          title="Rearrange placed enclosures, crops, and decorations"
        >
          <Move className="w-4 h-4 shrink-0" />
          <span>{editMode ? 'Editing' : 'Edit'}</span>
        </button>

        {DOCK_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const isActive = activeDrawer === item.id;
          const isDisabled = visitingMode && item.disableWhenVisiting;
          const showBadgeCount =
            (item.id === 'events' && hasUnclaimedDaily) ||
            (item.id === 'summary' && Boolean(hasReadyCare)) ||
            (item.id === 'chat' && unreadChatCount > 0);

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDrawer(isActive ? null : item.id)}
              className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-colors whitespace-nowrap sm:shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#2F6E49] text-[#FAF6EE]'
                  : 'text-[#2C3A2F] bg-[#F3ECE0]/60 sm:bg-transparent hover:bg-[#EFE7D8]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="inline-flex items-center gap-1">
                {item.label}
                {showBadgeCount && item.id !== 'chat' && (
                  <span className="text-[10px] font-mono-num font-bold text-[#D4622A]">•</span>
                )}
              </span>
              {item.id === 'chat' && unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 sm:static min-w-[18px] h-[18px] px-1 rounded-full bg-[#D4622A] text-white text-[10px] font-mono-num font-bold inline-flex items-center justify-center shadow-sm">
                  {unreadChatCount > 99 ? '99+' : unreadChatCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
