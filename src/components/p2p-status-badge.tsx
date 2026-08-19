/**
 * p2p-status-badge.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Compact, non-intrusive status indicator shown in the top-nav area.
 * Clicking it opens the full OfflineNetworkPanel.
 *
 * State → visual mapping:
 *   unavailable  →  grey  "P2P"
 *   searching    →  amber pulsing  "Searching…"
 *   connecting   →  blue  spinning "Connecting"
 *   syncing      →  blue  spinning "Syncing"
 *   connected    →  green "N devices"
 *   error        →  red   "P2P Error"
 */

import { Radio, Loader2, WifiOff, Signal, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { P2PPhase } from '@/hooks/use-p2p-network';

interface P2PStatusBadgeProps {
  phase:          P2PPhase;
  connectedCount: number;
  peerCount:      number;
  onClick:        () => void;
}

export function P2PStatusBadge({
  phase, connectedCount, peerCount, onClick,
}: P2PStatusBadgeProps) {

  // ── Phase → display config ─────────────────────────────────────────────────
  const cfg = (() => {
    switch (phase) {
      case 'unavailable':
        return {
          dot:   'bg-muted-foreground/50',
          pill:  'border-border bg-secondary/30 text-muted-foreground',
          icon:  <WifiOff className="h-3 w-3" />,
          label: 'P2P N/A',
          animate: false,
        };
      case 'searching':
        return {
          dot:   'bg-warning animate-pulse',
          pill:  'border-warning/30 bg-warning/10 text-warning',
          icon:  <Signal className="h-3 w-3" />,
          label: 'Searching…',
          animate: true,
        };
      case 'connecting':
        return {
          dot:   'bg-info animate-pulse',
          pill:  'border-info/30 bg-info/10 text-info',
          icon:  <Loader2 className="h-3 w-3 animate-spin" />,
          label: 'Connecting',
          animate: false,
        };
      case 'syncing':
        return {
          dot:   'bg-info animate-pulse',
          pill:  'border-info/30 bg-info/10 text-info',
          icon:  <RefreshCw className="h-3 w-3 animate-spin" />,
          label: 'Syncing',
          animate: false,
        };
      case 'connected':
        return {
          dot:   'bg-success',
          pill:  'border-success/30 bg-success/10 text-success',
          icon:  <Radio className="h-3 w-3" />,
          label: connectedCount > 0
            ? `${connectedCount} device${connectedCount !== 1 ? 's' : ''}`
            : peerCount > 0
            ? `${peerCount} nearby`
            : 'P2P Active',
          animate: false,
        };
      case 'error':
        return {
          dot:   'bg-alert',
          pill:  'border-alert/30 bg-alert/10 text-alert',
          icon:  <AlertTriangle className="h-3 w-3" />,
          label: 'P2P Error',
          animate: false,
        };
    }
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      title="Offline Network — click for details"
      aria-label="Offline peer-to-peer network status"
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] font-semibold transition-all hover:brightness-110 active:scale-95',
        cfg.pill,
      )}
    >
      {/* Animated status dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {cfg.animate && (
          <span className={cn(
            'absolute inline-flex h-full w-full animate-ping-slow rounded-full opacity-75',
            cfg.dot,
          )} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', cfg.dot)} />
      </span>

      {cfg.icon}
      <span className="hidden sm:inline">{cfg.label}</span>
    </button>
  );
}
