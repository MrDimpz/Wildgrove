import {
  ChevronDown,
  ChevronUp,
  Gift,
  Hammer,
  MessageCircle,
  Sprout,
  Store,
  Trophy,
  Users,
} from 'lucide-react';
import type { ActiveDrawer } from '../types/game';

interface BottomDockProps {
  activeDrawer: ActiveDrawer;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSelectDrawer: (drawer: ActiveDrawer) => void;
  hasUnclaimedDaily: boolean;
  unreadChatCount: number;
  visitingMode: boolean;
}

const DOCK_ITEMS: Array<{
  id: Exclude<ActiveDrawer, null | 'sync' | 'share' | 'manual'>;
  label: string;
  icon: typeof Hammer;
  disableWhenVisiting?: boolean;
}> = [
  { id: 'build', label: 'Build', icon: Hammer, disableWhenVisiting: true },
  { id: 'crops', label: 'Crops', icon: Sprout, disableWhenVisiting: true },
  { id: 'market', label: 'Market', icon: Store },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'leaderboard', label: 'Ranks', icon: Trophy },
  { id: 'events', label: 'Events', icon: Gift },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

export function BottomDock({
  activeDrawer,
  collapsed,
  onToggleCollapse,
  onSelectDrawer,
  hasUnclaimedDaily,
  unreadChatCount,
  visitingMode,
}: BottomDockProps) {
  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center transition-transform duration-200 max-w-[95vw] ${
        collapsed ? 'translate-y-[calc(100%-24px)]' : 'translate-y-0'
      }`}
    >
      {/* Collapsible Zen / Cinema Toggle Tab */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="inline-flex items-center gap-1 px-3 py-1 rounded-t-xl bg-[#FAF6EE] border border-b-0 border-[#263129]/15 text-[11px] font-semibold text-[#4B5B4E] hover:text-[#233026] cursor-pointer shadow-sm"
        title="Toggle Control Dock (H)"
      >
        {collapsed ? (
          <>
            <ChevronUp className="w-3.5 h-3.5" />
            <span>Show Dock</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-3.5 h-3.5" />
            <span>Hide Dock</span>
          </>
        )}
      </button>

      {/* Single Unified Horizontal Dock */}
      <nav
        aria-label="Sanctuary Controls"
        className="flex items-center gap-1 sm:gap-1.5 bg-[#FAF6EE] border border-[#263129]/15 rounded-2xl p-1.5 shadow-[0_12px_36px_rgba(32,48,34,0.18)] overflow-x-auto max-w-[94vw]"
      >
        {DOCK_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeDrawer === item.id;
          const isDisabled = visitingMode && item.disableWhenVisiting;
          const showBadgeCount =
            (item.id === 'events' && hasUnclaimedDaily) ||
            (item.id === 'chat' && unreadChatCount > 0);

          return (
            <button
              key={item.id}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelectDrawer(isActive ? null : item.id)}
              className={`relative flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-[#2F6E49] text-[#FAF6EE]'
                  : 'text-[#2C3A2F] hover:bg-[#EFE7D8]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {showBadgeCount && (
                <span className="ml-0.5 text-[10px] font-mono-num font-bold text-[#D4622A]">
                  {item.id === 'chat' ? `(${unreadChatCount})` : '•'}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
