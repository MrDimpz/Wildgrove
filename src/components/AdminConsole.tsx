import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Database,
  Download,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Store,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type AdminTab = 'overview' | 'sanctuaries' | 'chat' | 'marketplace' | 'maintenance';

interface AuditEntry {
  id: string;
  timestamp: number;
  actor: string;
  action: string;
  detail: string;
}

interface OverviewData {
  storage: 'mysql' | 'file';
  authMode: 'env' | 'claimed' | 'unclaimed';
  uptimeSec: number;
  onlineClients: number;
  sanctuaryCount: number;
  totalAnimals: number;
  totalCrops: number;
  totalDecorations: number;
  totalCoins: number;
  totalGems: number;
  marketplaceCount: number;
  directTradeCount: number;
  chatCount: number;
  auditLog: AuditEntry[];
}

interface AdminSanctuaryRow {
  syncCode: string;
  keeperName: string;
  sanctuaryName: string;
  avatarSpecies: string;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  prestige: number;
  gridSize: number;
  animalCount: number;
  cropCount: number;
  decorCount: number;
  updatedAt: number;
  stats: {
    totalFeeds: number;
    totalGrooms: number;
    totalHarvests: number;
    totalTrades: number;
    friendsVisited: number;
  };
}

interface AdminChatMsg {
  id: string;
  senderCode: string;
  senderName: string;
  text: string;
  tag?: string;
  timestamp: number;
}

interface AdminListing {
  id: string;
  sellerCode: string;
  sellerName: string;
  itemLabel: string;
  quantity: number;
  priceCoins: number;
  priceGems: number;
  rarity: string;
  createdAt: number;
}

interface AdminTrade {
  id: string;
  fromCode: string;
  fromName: string;
  toCode: string;
  itemLabel: string;
  quantity: number;
  askingCoins: number;
  status: string;
  createdAt: number;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function formatTimestamp(ms: number): string {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function AdminConsole({ onReturnToGame }: { onReturnToGame: () => void }) {
  // Auth state (token kept strictly in React memory — never localStorage/sessionStorage)
  const [statusLoading, setStatusLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [authMode, setAuthMode] = useState<'env' | 'claimed' | 'unclaimed'>('unclaimed');
  const [token, setToken] = useState<string | null>(null);
  const [adminUsername, setAdminUsername] = useState<string>('');

  // Login / Setup form fields
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard state
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loadingData, setLoadingData] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sanctuaries, setSanctuaries] = useState<AdminSanctuaryRow[]>([]);
  const [chatMessages, setChatMessages] = useState<AdminChatMsg[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [trades, setTrades] = useState<AdminTrade[]>([]);

  // Sanctuaries filters & modals
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updatedAt' | 'prestige' | 'coins' | 'level'>('updatedAt');
  const [inspectRecord, setInspectRecord] = useState<Record<string, unknown> | null>(null);
  const [editTarget, setEditTarget] = useState<AdminSanctuaryRow | null>(null);
  const [editForm, setEditForm] = useState({
    keeperName: '',
    sanctuaryName: '',
    coins: 0,
    gems: 0,
    level: 1,
    resetDailyTasks: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<AdminSanctuaryRow | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Chat broadcast & clear modal
  const [broadcastText, setBroadcastText] = useState('');
  const [confirmClearChat, setConfirmClearChat] = useState(false);

  // Server reset modal & scopes
  const [resetScopes, setResetScopes] = useState({
    resetSanctuaries: true,
    resetMarketplace: true,
    reseedMarketplace: true,
    resetChat: true,
    resetTrades: true,
  });
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPhrase, setResetPhrase] = useState('');

  // Password rotation form
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');

  const showNotice = useCallback((tone: 'ok' | 'err', text: string) => {
    setBanner({ tone, text });
  }, []);

  const adminFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      const res = await fetch(url, { ...init, headers });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && token) {
        setToken(null);
        setAuthError('Your admin session expired. Please sign in again.');
      }
      return { res, data };
    },
    [token],
  );

  // Check server admin setup status on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/admin/status');
        const data = await res.json();
        if (!active) return;
        setNeedsSetup(Boolean(data?.needsSetup));
        setAuthMode(data?.authMode || 'unclaimed');
      } catch {
        if (active) {
          setAuthError('Unable to reach the Wildgrove server. Check that the backend is running.');
        }
      } finally {
        if (active) setStatusLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const refreshAll = useCallback(async () => {
    if (!token) return;
    setLoadingData(true);
    try {
      const [ov, sanc, ch, mkt, trd] = await Promise.all([
        adminFetch('/api/admin/overview'),
        adminFetch('/api/admin/sanctuaries'),
        adminFetch('/api/admin/chat'),
        adminFetch('/api/admin/marketplace'),
        adminFetch('/api/admin/trades'),
      ]);
      if (ov.res.ok) setOverview(ov.data as OverviewData);
      if (sanc.res.ok && Array.isArray(sanc.data?.sanctuaries)) {
        setSanctuaries(sanc.data.sanctuaries as AdminSanctuaryRow[]);
      }
      if (ch.res.ok && Array.isArray(ch.data?.messages)) {
        setChatMessages(ch.data.messages as AdminChatMsg[]);
      }
      if (mkt.res.ok && Array.isArray(mkt.data?.listings)) {
        setListings(mkt.data.listings as AdminListing[]);
      }
      if (trd.res.ok && Array.isArray(trd.data?.trades)) {
        setTrades(trd.data.trades as AdminTrade[]);
      }
    } finally {
      setLoadingData(false);
    }
  }, [token, adminFetch]);

  useEffect(() => {
    if (token) {
      void refreshAll();
    }
  }, [token, refreshAll]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const u = usernameInput.trim();
    const p = passwordInput;
    if (!u || !p) {
      setAuthError('Please enter both username and password.');
      return;
    }
    if (needsSetup && p !== confirmPasswordInput) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const endpoint = needsSetup ? '/api/admin/setup' : '/api/admin/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        setAuthError(data?.error || 'Authentication failed.');
        return;
      }
      setToken(data.token);
      setAdminUsername(data.username || u);
      setAuthMode(data.authMode || 'claimed');
      setNeedsSetup(false);
      setPasswordInput('');
      setConfirmPasswordInput('');
    } catch {
      setAuthError('Network error while contacting server.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await adminFetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    }
    setToken(null);
    setOverview(null);
    setSanctuaries([]);
    setChatMessages([]);
    setListings([]);
    setTrades([]);
    setBanner(null);
  };

  const filteredSanctuaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? sanctuaries.filter(
          (s) =>
            s.syncCode.toLowerCase().includes(q) ||
            s.keeperName.toLowerCase().includes(q) ||
            s.sanctuaryName.toLowerCase().includes(q),
        )
      : sanctuaries;
    return [...filtered].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));
  }, [sanctuaries, searchQuery, sortBy]);

  const handleInspectSanctuary = async (code: string) => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(`/api/admin/sanctuaries/${encodeURIComponent(code)}`);
      if (res.ok && data?.sanctuary) {
        setInspectRecord(data.sanctuary as Record<string, unknown>);
      } else {
        showNotice('err', data?.error || 'Failed to load sanctuary details.');
      }
    } finally {
      setActionBusy(false);
    }
  };

  const openEditSanctuary = (row: AdminSanctuaryRow) => {
    setEditTarget(row);
    setEditForm({
      keeperName: row.keeperName,
      sanctuaryName: row.sanctuaryName,
      coins: row.coins,
      gems: row.gems,
      level: row.level,
      resetDailyTasks: false,
    });
  };

  const handleSaveSanctuaryEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(
        `/api/admin/sanctuaries/${encodeURIComponent(editTarget.syncCode)}`,
        {
          method: 'PATCH',
          body: JSON.stringify(editForm),
        },
      );
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to update sanctuary.');
        return;
      }
      setEditTarget(null);
      showNotice('ok', `Updated sanctuary ${editTarget.syncCode}.`);
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDeleteSanctuary = async () => {
    if (!deleteTarget) return;
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(
        `/api/admin/sanctuaries/${encodeURIComponent(deleteTarget.syncCode)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to delete sanctuary.');
        return;
      }
      const code = deleteTarget.syncCode;
      setDeleteTarget(null);
      showNotice('ok', `Deleted sanctuary ${code} and cleaned up associated listings and trades.`);
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ text: broadcastText.trim() }),
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to send announcement.');
        return;
      }
      setBroadcastText('');
      showNotice('ok', 'Announcement broadcast to all online players.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteChat = async (id: string) => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(`/api/admin/chat/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to delete chat message.');
        return;
      }
      showNotice('ok', 'Chat message deleted.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleClearChat = async () => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/chat/clear', { method: 'POST' });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to clear chat.');
        return;
      }
      setConfirmClearChat(false);
      showNotice('ok', `Cleared ${data?.cleared ?? 0} community chat messages.`);
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteListing = async (id: string) => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(`/api/admin/marketplace/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to remove listing.');
        return;
      }
      showNotice('ok', 'Marketplace listing removed.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleResetMarketplace = async (reseed: boolean) => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/marketplace/reset', {
        method: 'POST',
        body: JSON.stringify({ reseed }),
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to reset marketplace.');
        return;
      }
      showNotice('ok', reseed ? 'Marketplace reset and reseeded.' : 'Marketplace cleared.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleDeleteTrade = async (id: string) => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch(`/api/admin/trades/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to remove trade offer.');
        return;
      }
      showNotice('ok', 'Direct trade offer removed.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleExportSnapshot = async () => {
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/export');
      if (!res.ok) {
        showNotice('err', data?.error || 'Failed to export backup.');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wildgrove-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showNotice('ok', 'Downloaded JSON server backup.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleExecuteServerReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPhrase.trim() !== 'RESET WILDGROVE') {
      showNotice('err', 'Type RESET WILDGROVE exactly to confirm the server reset.');
      return;
    }
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/reset-server', {
        method: 'POST',
        body: JSON.stringify({
          confirmPhrase: resetPhrase.trim(),
          ...resetScopes,
        }),
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Server reset failed.');
        return;
      }
      setShowResetModal(false);
      setResetPhrase('');
      const summary = Array.isArray(data?.summary) ? data.summary.join(', ') : 'completed';
      showNotice('ok', `Server reset complete: ${summary}.`);
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curPass || !newPass) {
      showNotice('err', 'Enter both current and new password.');
      return;
    }
    if (newPass !== newPassConfirm) {
      showNotice('err', 'New passwords do not match.');
      return;
    }
    setActionBusy(true);
    try {
      const { res, data } = await adminFetch('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: curPass, newPassword: newPass }),
      });
      if (!res.ok) {
        showNotice('err', data?.error || 'Password update failed.');
        return;
      }
      if (data?.token) setToken(data.token);
      setCurPass('');
      setNewPass('');
      setNewPassConfirm('');
      showNotice('ok', 'Admin password updated and all other sessions revoked.');
      await refreshAll();
    } finally {
      setActionBusy(false);
    }
  };

  // =========================================================================
  // Auth Gate View (Setup or Login)
  // =========================================================================
  if (!token) {
    return (
      <div className="h-full w-full overflow-y-auto touch-pan-y bg-slate-50 text-slate-900 flex flex-col">
        <header className="h-14 px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 whitespace-nowrap">
            <Shield className="w-4 h-4 text-emerald-700" />
            <span>Wildgrove Admin</span>
          </div>
          <button
            type="button"
            onClick={onReturnToGame}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sanctuary
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            {statusLoading ? (
              <div className="py-10 text-center text-sm text-slate-500">
                Checking server admin status...
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    {needsSetup ? 'Initialize Admin Account' : 'Admin Console Sign In'}
                  </h1>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {needsSetup
                      ? 'No server admin password is configured yet. Claim this server by choosing your admin username and password. Credentials are hashed with scrypt on the server and locked immediately.'
                      : 'Sign in with your Wildgrove administrator credentials to manage sanctuaries, moderation, backups, and server resets.'}
                  </p>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-username"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Username
                    </label>
                    <input
                      id="admin-username"
                      type="text"
                      autoComplete="username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="Enter admin username"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-password"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={needsSetup ? 'new-password' : 'current-password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder={needsSetup ? 'Minimum 8 characters' : 'Enter password'}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {needsSetup && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-password-confirm"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Confirm Password
                      </label>
                      <input
                        id="admin-password-confirm"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
                        required
                      />
                    </div>
                  )}

                  {authError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authSubmitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {authSubmitting
                      ? 'Verifying...'
                      : needsSetup
                        ? 'Save Credentials & Enter Console'
                        : 'Sign In'}
                  </button>
                </form>

                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">
                  Auth mode:{' '}
                  <span className="font-mono text-slate-700">
                    {authMode === 'env'
                      ? 'Server environment variables'
                      : authMode === 'claimed'
                        ? 'Server-stored scrypt hash'
                        : 'Awaiting first-run claim'}
                  </span>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }

  // =========================================================================
  // Authenticated Admin Console Workspace
  // =========================================================================
  const NAV_ITEMS: Array<{ id: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sanctuaries', label: 'Sanctuaries', icon: Users },
    { id: 'chat', label: 'Chat & Broadcast', icon: MessageSquare },
    { id: 'marketplace', label: 'Market & Trades', icon: Store },
    { id: 'maintenance', label: 'Backup & Reset', icon: Database },
  ];

  const tabTitles: Record<AdminTab, string> = {
    overview: 'Server Overview',
    sanctuaries: 'Sanctuary Directory',
    chat: 'Community Chat & Broadcasts',
    marketplace: 'Marketplace & Direct Trades',
    maintenance: 'Backups, Security & Server Reset',
  };

  return (
    <div className="h-full w-full overflow-hidden touch-pan-y bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="h-14 px-5 border-b border-slate-200 flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-emerald-700 shrink-0" />
          <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
            Wildgrove Admin
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2 text-xs text-slate-500">
          <div className="truncate">
            Signed in as <span className="font-semibold text-slate-800">{adminUsername}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onReturnToGame}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Open Game
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Right Main Column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Top Breadcrumb Bar */}
        <header className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400 hidden sm:inline">Admin</span>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <h1 className="font-semibold text-slate-900 truncate">{tabTitles[activeTab]}</h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onReturnToGame}
              className="lg:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Game
            </button>
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-red-600 cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-3 py-2 flex items-center gap-1 overflow-x-auto touch-pan-x shrink-0">
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Main Scrollable Viewport */}
        <main className="flex-1 min-h-0 overflow-y-auto touch-pan-y p-4 sm:p-6 max-w-6xl w-full mx-auto space-y-6">
          {banner && (
            <div
              className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
                banner.tone === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {banner.tone === 'ok' ? (
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span className="truncate">{banner.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setBanner(null)}
                aria-label="Dismiss notice"
                className="p-1 rounded hover:bg-black/5 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-medium text-slate-500">Total Sanctuaries</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {overview ? overview.sanctuaryCount.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {overview ? `${overview.totalAnimals} animals · ${overview.totalDecorations} decor` : ''}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-medium text-slate-500">Live Online Clients</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    {overview ? overview.onlineClients.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    Uptime: {overview ? formatDuration(overview.uptimeSec) : '—'}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-medium text-slate-500">Market &amp; Chat</div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                    {overview ? overview.marketplaceCount.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-slate-500 font-mono tabular-nums">
                    {overview
                      ? `${overview.chatCount} chat msgs · ${overview.directTradeCount} pending trades`
                      : ''}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                  <div className="text-xs font-medium text-slate-500">Storage Backend</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {overview ? (overview.storage === 'mysql' ? 'MySQL' : 'Local JSON') : '—'}
                  </div>
                  <div className="text-xs text-slate-500">
                    Auth: {overview?.authMode === 'env' ? 'Environment vars' : 'Server hash'}
                  </div>
                </div>
              </div>

              {/* Recent Admin Audit Log */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Recent Admin Activity</h2>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    {overview?.auditLog.length ?? 0} entries
                  </span>
                </div>

                {!overview || overview.auditLog.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No administrative actions logged yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Operator</th>
                          <th className="py-2.5 px-4">Action</th>
                          <th className="py-2.5 px-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {overview.auditLog.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {formatTimestamp(entry.timestamp)}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                              {entry.actor}
                            </td>
                            <td className="py-2.5 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                              {entry.action}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-600">{entry.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== SANCTUARIES TAB ==================== */}
          {activeTab === 'sanctuaries' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sync code, keeper, or sanctuary..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="sort-sanctuaries" className="text-xs text-slate-500 whitespace-nowrap">
                    Sort by
                  </label>
                  <select
                    id="sort-sanctuaries"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'updatedAt' | 'prestige' | 'coins' | 'level')
                    }
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="updatedAt">Last Updated</option>
                    <option value="prestige">Highest Prestige</option>
                    <option value="coins">Most Coins</option>
                    <option value="level">Highest Level</option>
                  </select>
                </div>
              </div>

              {filteredSanctuaries.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  {sanctuaries.length === 0
                    ? 'No player sanctuaries are currently stored on the server.'
                    : 'No sanctuaries match your search filter.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                        <th className="py-2.5 px-4">Sync Code</th>
                        <th className="py-2.5 px-4">Sanctuary / Keeper</th>
                        <th className="py-2.5 px-4 text-right">Level</th>
                        <th className="py-2.5 px-4 text-right">Prestige</th>
                        <th className="py-2.5 px-4 text-right">Coins / Gems</th>
                        <th className="py-2.5 px-4">Meadow</th>
                        <th className="py-2.5 px-4">Updated</th>
                        <th className="py-2.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredSanctuaries.map((row) => (
                        <tr key={row.syncCode} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
                            {row.syncCode}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 text-sm">
                              {row.sanctuaryName}
                            </div>
                            <div className="text-xs text-slate-500">{row.keeperName}</div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700">
                            {row.level}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-emerald-700">
                            {row.prestige.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-700 whitespace-nowrap">
                            {row.coins.toLocaleString()}c · {row.gems.toLocaleString()}g
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 font-mono tabular-nums whitespace-nowrap">
                            {row.animalCount}A · {row.cropCount}C · {row.decorCount}D ({row.gridSize}×{row.gridSize})
                          </td>
                          <td className="py-3 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {formatTimestamp(row.updatedAt)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleInspectSanctuary(row.syncCode)}
                                className="px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                              >
                                Inspect
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditSanctuary(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(row)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ==================== CHAT & BROADCAST TAB ==================== */}
          {activeTab === 'chat' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Broadcast System Announcement
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Post an official message into Community Chat that appears live for all connected players.
                  </p>
                </div>
                <form onSubmit={handleSendBroadcast} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    maxLength={220}
                    placeholder="e.g. Server maintenance begins in 10 minutes — please save your sanctuary."
                    className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="submit"
                    disabled={actionBusy || !broadcastText.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    <Megaphone className="w-4 h-4" />
                    Send Broadcast
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Community Chat Log ({chatMessages.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    disabled={chatMessages.length === 0 || actionBusy}
                    onClick={() => setConfirmClearChat(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear All Chat
                  </button>
                </div>

                {chatMessages.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Community chat is currently empty.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Time</th>
                          <th className="py-2.5 px-4">Sender</th>
                          <th className="py-2.5 px-4">Message</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...chatMessages].reverse().map((msg) => (
                          <tr key={msg.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
                              {formatTimestamp(msg.timestamp)}
                            </td>
                            <td className="py-2.5 px-4 whitespace-nowrap">
                              <div className="text-xs font-semibold text-slate-900">
                                {msg.senderName}
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                {msg.senderCode} · {msg.tag || 'general'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-sm text-slate-700 break-words max-w-md">
                              {msg.text}
                            </td>
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void handleDeleteChat(msg.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== MARKETPLACE & TRADES TAB ==================== */}
          {activeTab === 'marketplace' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Active Marketplace Listings ({listings.length})
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => void handleResetMarketplace(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset &amp; Reseed
                    </button>
                    <button
                      type="button"
                      disabled={actionBusy || listings.length === 0}
                      onClick={() => void handleResetMarketplace(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear All
                    </button>
                  </div>
                </div>

                {listings.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No active marketplace listings.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Item</th>
                          <th className="py-2.5 px-4">Seller</th>
                          <th className="py-2.5 px-4 text-right">Qty</th>
                          <th className="py-2.5 px-4 text-right">Price</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listings.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4">
                              <div className="font-medium text-slate-900">{item.itemLabel}</div>
                              <div className="text-xs text-slate-500">{item.rarity}</div>
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-600">
                              {item.sellerName}{' '}
                              <span className="font-mono text-slate-400">({item.sellerCode})</span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                              ×{item.quantity}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                              {item.priceCoins}c{item.priceGems > 0 ? ` · ${item.priceGems}g` : ''}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void handleDeleteListing(item.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Direct Trade Offers ({trades.length})
                  </h2>
                </div>
                {trades.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No direct player trade offers recorded.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                          <th className="py-2.5 px-4">Route</th>
                          <th className="py-2.5 px-4">Item</th>
                          <th className="py-2.5 px-4 text-right">Asking</th>
                          <th className="py-2.5 px-4">Status</th>
                          <th className="py-2.5 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trades.map((trd) => (
                          <tr key={trd.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 text-xs font-mono text-slate-700 whitespace-nowrap">
                              {trd.fromCode} → {trd.toCode}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-900">
                              {trd.itemLabel} ×{trd.quantity}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                              {trd.askingCoins > 0 ? `${trd.askingCoins}c` : 'Gift'}
                            </td>
                            <td className="py-2.5 px-4 text-xs text-slate-600">{trd.status}</td>
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => void handleDeleteTrade(trd.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== MAINTENANCE & SERVER RESET TAB ==================== */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              {/* JSON Export */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Export Server Backup</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Download a JSON snapshot of all sanctuaries, marketplace listings, direct trades, and community chat before making bulk changes.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={actionBusy}
                  onClick={() => void handleExportSnapshot()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  Download JSON Backup
                </button>
              </div>

              {/* Password Management */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-slate-600" />
                  <h2 className="text-sm font-semibold text-slate-900">Admin Credentials</h2>
                </div>
                {authMode === 'env' ? (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Admin credentials are currently controlled by server environment variables (
                    <span className="font-mono text-slate-800">ADMIN_USERNAME</span> and{' '}
                    <span className="font-mono text-slate-800">ADMIN_PASSWORD</span>). Update them
                    in your hosting provider&apos;s Secrets / Environment panel and restart the server
                    to rotate credentials.
                  </p>
                ) : (
                  <form onSubmit={handleRotatePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="password"
                      value={curPass}
                      onChange={(e) => setCurPass(e.target.value)}
                      placeholder="Current password"
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      required
                    />
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
                      required
                    />
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newPassConfirm}
                        onChange={(e) => setNewPassConfirm(e.target.value)}
                        placeholder="Confirm new password"
                        className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 text-sm"
                        required
                      />
                      <button
                        type="submit"
                        disabled={actionBusy}
                        className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Update
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Danger Zone: Full Server Reset */}
              <div className="bg-white border border-red-200 rounded-xl p-5 space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-4 h-4" />
                    <h2 className="text-sm font-bold">Server Reset</h2>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Permanently wipe selected data scopes across memory and persistent storage (MySQL or JSON file). Your admin credentials will be preserved so you remain signed in.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-slate-700">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetScopes.resetSanctuaries}
                      onChange={(e) =>
                        setResetScopes((prev) => ({ ...prev, resetSanctuaries: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-red-600 focus:ring-red-600"
                    />
                    <span>Delete all player sanctuaries ({sanctuaries.length})</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetScopes.resetChat}
                      onChange={(e) =>
                        setResetScopes((prev) => ({ ...prev, resetChat: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-red-600 focus:ring-red-600"
                    />
                    <span>Clear all community chat ({chatMessages.length})</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetScopes.resetMarketplace}
                      onChange={(e) =>
                        setResetScopes((prev) => ({ ...prev, resetMarketplace: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-red-600 focus:ring-red-600"
                    />
                    <span>Reset marketplace listings ({listings.length})</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetScopes.resetTrades}
                      onChange={(e) =>
                        setResetScopes((prev) => ({ ...prev, resetTrades: e.target.checked }))
                      }
                      className="rounded border-slate-300 text-red-600 focus:ring-red-600"
                    />
                    <span>Clear all direct trades ({trades.length})</span>
                  </label>
                  {resetScopes.resetMarketplace && (
                    <label className="flex items-center gap-2.5 cursor-pointer sm:col-span-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={resetScopes.reseedMarketplace}
                        onChange={(e) =>
                          setResetScopes((prev) => ({
                            ...prev,
                            reseedMarketplace: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      <span>Repopulate default starter marketplace listings after reset</span>
                    </label>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    disabled={
                      !resetScopes.resetSanctuaries &&
                      !resetScopes.resetMarketplace &&
                      !resetScopes.resetChat &&
                      !resetScopes.resetTrades
                    }
                    onClick={() => {
                      setResetPhrase('');
                      setShowResetModal(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Initiate Server Reset...
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== INSPECT SANCTUARY MODAL ==================== */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[85vh] bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Sanctuary Record: {String(inspectRecord.syncCode || '')}
              </h3>
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-800 bg-slate-50">
              {JSON.stringify(inspectRecord, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* ==================== EDIT SANCTUARY MODAL ==================== */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Edit Sanctuary ({editTarget.syncCode})
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSanctuaryEdit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Keeper Name</label>
                  <input
                    type="text"
                    value={editForm.keeperName}
                    onChange={(e) => setEditForm((f) => ({ ...f, keeperName: e.target.value }))}
                    maxLength={28}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Sanctuary Name</label>
                  <input
                    type="text"
                    value={editForm.sanctuaryName}
                    onChange={(e) => setEditForm((f) => ({ ...f, sanctuaryName: e.target.value }))}
                    maxLength={36}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Coins</label>
                  <input
                    type="number"
                    min={0}
                    max={10000000}
                    value={editForm.coins}
                    onChange={(e) => setEditForm((f) => ({ ...f, coins: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Gems</label>
                  <input
                    type="number"
                    min={0}
                    max={1000000}
                    value={editForm.gems}
                    onChange={(e) => setEditForm((f) => ({ ...f, gems: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Level</label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={editForm.level}
                    onChange={(e) => setEditForm((f) => ({ ...f, level: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.resetDailyTasks}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, resetDailyTasks: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-emerald-700"
                />
                <span>Reset this sanctuary&apos;s Daily Tasks for today</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy}
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== DELETE SANCTUARY CONFIRMATION ==================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Delete Sanctuary?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                This will permanently remove{' '}
                <strong className="text-slate-900">{deleteTarget.sanctuaryName}</strong> (
                <span className="font-mono text-xs">{deleteTarget.syncCode}</span>, keeper{' '}
                {deleteTarget.keeperName}) along with their marketplace listings and pending trades.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleConfirmDeleteSanctuary()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CLEAR CHAT CONFIRMATION ==================== */}
      {confirmClearChat && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">Clear All Community Chat?</h3>
              <p className="text-sm text-slate-600">
                All {chatMessages.length} chat messages will be deleted from the server and cleared live for connected players.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearChat(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handleClearChat()}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SERVER RESET CONFIRMATION MODAL ==================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-red-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Confirm Full Server Reset</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  This irreversible action will wipe the selected server data immediately and broadcast empty/reseeded state to online players.
                </p>
              </div>
            </div>

            <form onSubmit={handleExecuteServerReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Type <span className="font-mono text-red-700">RESET WILDGROVE</span> to confirm
                </label>
                <input
                  type="text"
                  value={resetPhrase}
                  onChange={(e) => setResetPhrase(e.target.value)}
                  placeholder="RESET WILDGROVE"
                  autoFocus
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy || resetPhrase.trim() !== 'RESET WILDGROVE'}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-40"
                >
                  {actionBusy ? 'Resetting...' : 'Reset Server Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
