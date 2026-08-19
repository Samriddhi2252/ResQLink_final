/**
 * offline-network-panel.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dedicated "Offline Network" sheet panel.
 * Shows full P2P status: device identity, discovered peers, sync statistics,
 * store-and-forward record counts, and a manual sync trigger.
 *
 * Opens as a right-side Sheet (same pattern as ShelterWidget / FindHelpPanel).
 * All data comes from the useP2PNetwork hook — this component is purely
 * presentational, it never touches the P2P engine directly.
 */

import { useState, useEffect } from 'react';
import {
  Wifi, WifiOff, Radio, RefreshCw, Users, ArrowLeftRight,
  Clock, CheckCircle2, AlertTriangle, Loader2, ArrowLeft,
  Shield, Database, Zap, Info, ChevronRight, Signal,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/hooks/use-network';
import type { P2PPhase, P2PPeerInfo } from '@/hooks/use-p2p-network';
import type { P2PStats } from '@/lib/p2p-db';
import { useModalBack } from '@/hooks/use-modal-back';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface OfflineNetworkPanelProps {
  open:           boolean;
  onOpenChange:   (open: boolean) => void;
  phase:          P2PPhase;
  peers:          P2PPeerInfo[];
  connectedCount: number;
  stats:          P2PStats;
  recordCount:    number;
  errorMessage:   string | null;
  deviceId:       string;
  deviceAlias:    string;
  isOnline:       boolean;
  onSyncNow:      () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase metadata
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_META: Record<P2PPhase, {
  label:   string;
  color:   string;
  bg:      string;
  border:  string;
  icon:    React.ReactNode;
  detail:  string;
}> = {
  unavailable: {
    label:  'Not Supported',
    color:  'text-muted-foreground',
    bg:     'bg-secondary/40',
    border: 'border-border',
    icon:   <WifiOff className="h-4 w-4" />,
    detail: 'WebRTC or IndexedDB is not available in this browser.',
  },
  searching: {
    label:  'Searching for Devices',
    color:  'text-warning',
    bg:     'bg-warning/10',
    border: 'border-warning/30',
    icon:   <Signal className="h-4 w-4 animate-pulse" />,
    detail: 'Looking for nearby ResQLinkk devices on this network...',
  },
  connecting: {
    label:  'Connecting',
    color:  'text-info',
    bg:     'bg-info/10',
    border: 'border-info/30',
    icon:   <Loader2 className="h-4 w-4 animate-spin" />,
    detail: 'Establishing peer-to-peer connection...',
  },
  syncing: {
    label:  'Syncing Emergency Data',
    color:  'text-info',
    bg:     'bg-info/10',
    border: 'border-info/30',
    icon:   <RefreshCw className="h-4 w-4 animate-spin" />,
    detail: 'Exchanging emergency records with nearby device...',
  },
  connected: {
    label:  'Network Active',
    color:  'text-success',
    bg:     'bg-success/10',
    border: 'border-success/30',
    icon:   <Radio className="h-4 w-4" />,
    detail: 'Offline peer-to-peer network is active.',
  },
  error: {
    label:  'Connection Error',
    color:  'text-alert',
    bg:     'bg-alert/10',
    border: 'border-alert/30',
    icon:   <AlertTriangle className="h-4 w-4" />,
    detail: 'Unable to connect. Retrying automatically.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function OfflineNetworkPanel({
  open, onOpenChange, phase, peers, connectedCount, stats,
  recordCount, errorMessage, deviceId, deviceAlias, isOnline, onSyncNow,
}: OfflineNetworkPanelProps) {
  useModalBack(open, () => onOpenChange(false));

  const [now, setNow] = useState(Date.now());

  // Tick every 30 s so "last sync" timestamps stay fresh
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [open]);

  const meta       = PHASE_META[phase];
  const shortId    = deviceId.slice(-8).toUpperCase();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-md">

        {/* ── Sticky header ── */}
        <div className="sticky top-0 z-10 border-b border-border glass-strong px-4 py-3.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50
                px-2.5 py-1.5 text-xs font-bold hover:bg-secondary active:scale-95 transition-all"
              aria-label="Go back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
              bg-info/15 ring-1 ring-info/25">
              <Radio className="h-4 w-4 text-info" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-sm font-bold">Offline Network</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                LAN peer-to-peer emergency data sync
              </SheetDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">

          {/* ── Phase banner ── */}
          <div className={cn(
            'flex items-center gap-3 rounded-2xl border p-4',
            meta.bg, meta.border,
          )}>
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', meta.bg, meta.color)}>
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-bold leading-tight', meta.color)}>{meta.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.detail}</p>
              {errorMessage && (
                <p className="mt-1 text-xs text-alert font-medium">{errorMessage}</p>
              )}
            </div>
            {/* Live pulse dot */}
            {(phase === 'connected' || phase === 'syncing') && (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
              </span>
            )}
          </div>

          {/* ── Device identity ── */}
          <Section title="Your Device" icon={<Shield className="h-3.5 w-3.5 text-info" />}>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{deviceAlias}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    ID: ...{shortId}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  {isOnline ? (
                    <span className="flex items-center gap-1 rounded-full border border-success/25
                      bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <Wifi className="h-2.5 w-2.5" /> Internet
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full border border-warning/25
                      bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      <WifiOff className="h-2.5 w-2.5" /> Offline
                    </span>
                  )}
                </div>
              </div>
              <p className="mt-2.5 text-[10px] text-muted-foreground leading-relaxed">
                Your device ID is anonymous and temporary. It resets if you clear browser data.
                No personal information is ever transmitted.
              </p>
            </div>
          </Section>

          {/* ── Stats grid ── */}
          <Section title="Sync Statistics" icon={<ArrowLeftRight className="h-3.5 w-3.5 text-info" />}>
            <div className="grid grid-cols-2 gap-2">
              <StatTile
                value={peers.length}
                label="Nearby Devices"
                icon={<Users className="h-4 w-4 text-info" />}
                color="text-info"
              />
              <StatTile
                value={connectedCount}
                label="Connected"
                icon={<Radio className="h-4 w-4 text-success" />}
                color="text-success"
              />
              <StatTile
                value={stats.totalReceived}
                label="Records Received"
                icon={<Zap className="h-4 w-4 text-warning" />}
                color="text-warning"
              />
              <StatTile
                value={stats.totalSent}
                label="Records Sent"
                icon={<ArrowLeftRight className="h-4 w-4 text-info" />}
                color="text-info"
              />
              <StatTile
                value={recordCount}
                label="Total Stored"
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
                color="text-foreground"
              />
              <StatTile
                value={stats.totalRelayed}
                label="Relayed (Hops)"
                icon={<ChevronRight className="h-4 w-4 text-muted-foreground" />}
                color="text-muted-foreground"
              />
            </div>

            {/* Last sync */}
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-secondary/20 px-3.5 py-2.5">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Last Sync
                </p>
                <p className="text-xs font-semibold text-foreground">
                  {stats.lastSyncAt
                    ? timeAgo(stats.lastSyncAt)
                    : 'Never'}
                  {stats.lastSyncPeer && (
                    <span className="text-muted-foreground font-normal ml-1">
                      · from ...{stats.lastSyncPeer.slice(-8).toUpperCase()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </Section>

          {/* ── Nearby peers list ── */}
          <Section
            title={`Nearby Devices (${peers.length})`}
            icon={<Users className="h-3.5 w-3.5 text-info" />}
          >
            {peers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl
                border border-dashed border-border bg-secondary/20">
                <Signal className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No devices found</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-[220px]">
                  Other ResQLinkk devices on the same Wi-Fi will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {peers.map((peer) => (
                  <PeerRow key={peer.deviceId} peer={peer} />
                ))}
              </div>
            )}
          </Section>

          {/* ── Manual sync button ── */}
          {(phase === 'connected' || phase === 'syncing') && (
            <button
              type="button"
              onClick={onSyncNow}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-xl border border-info/30',
                'bg-info/10 hover:bg-info/20 text-info px-4 py-3 text-sm font-bold',
                'transition-all active:scale-[0.98]',
              )}
            >
              <RefreshCw className={cn('h-4 w-4', phase === 'syncing' && 'animate-spin')} />
              Sync Now
            </button>
          )}

          {/* ── How it works ── */}
          <Section
            title="How Offline Network Works"
            icon={<Info className="h-3.5 w-3.5 text-muted-foreground" />}
            collapsible
          >
            <div className="rounded-xl border border-border bg-secondary/20 p-3.5 space-y-3">
              <FlowStep
                step="1"
                color="bg-info"
                title="Same Wi-Fi Network"
                body="Both devices must be on the same Wi-Fi or hotspot. No internet is required once discovered."
              />
              <FlowStep
                step="2"
                color="bg-warning"
                title="Automatic Discovery"
                body="ResQLinkk devices find each other via the local server. Discovery refreshes every 8 seconds."
              />
              <FlowStep
                step="3"
                color="bg-success"
                title="Direct P2P Connection"
                body="A WebRTC DataChannel is opened between devices. After this, data flows directly — the server is no longer involved."
              />
              <FlowStep
                step="4"
                color="bg-alert"
                title="Store & Forward"
                body="Every record you receive is stored locally and forwarded to the next device you connect to, creating a chain: A → B → C → D."
              />
              <FlowStep
                step="5"
                color="bg-info"
                title="Internet Returns"
                body="When connectivity is restored, all locally-held records are automatically pushed to the backend and appear for all online users."
              />
            </div>
          </Section>

          {/* ── Limitations notice ── */}
          <div className="rounded-xl border border-border bg-secondary/20 p-3.5">
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Platform Note
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This layer uses <strong className="text-foreground">WebRTC DataChannels</strong> — a real
                  browser P2P standard. Devices must be on the same Wi-Fi network.
                  For cross-network or Bluetooth-range P2P, a native Android app with
                  Google Nearby Connections would be required.
                </p>
              </div>
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function Section({
  title, icon, children, collapsible = false,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);

  return (
    <div>
      <button
        type="button"
        onClick={collapsible ? () => setOpen(v => !v) : undefined}
        className={cn(
          'flex w-full items-center gap-2 mb-2',
          collapsible && 'cursor-pointer hover:opacity-80 transition-opacity',
        )}
      >
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex-1 text-left">
          {title}
        </p>
        {collapsible && (
          <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-90')} />
        )}
      </button>
      {open && children}
    </div>
  );
}

function StatTile({
  value, label, icon, color,
}: {
  value: number; label: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className={cn('text-lg font-extrabold leading-none tabular-nums', color)}>
          {value}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
      </div>
    </div>
  );
}

function PeerRow({ peer }: { peer: P2PPeerInfo }) {
  const shortId = peer.deviceId.slice(-8).toUpperCase();

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border p-3 transition-colors',
      peer.connected
        ? 'border-success/25 bg-success/[0.04]'
        : 'border-border bg-card',
    )}>
      {/* Status dot */}
      <div className="relative flex h-2.5 w-2.5 shrink-0">
        {peer.connected && (
          <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-success opacity-60" />
        )}
        <span className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          peer.connected ? 'bg-success' : 'bg-muted-foreground/40',
        )} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground truncate">{peer.alias}</p>
        <p className="text-[10px] font-mono text-muted-foreground">...{shortId}</p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn('text-xs font-bold', peer.connected ? 'text-success' : 'text-muted-foreground')}>
          {peer.connected ? 'Connected' : 'Visible'}
        </p>
        <p className="text-[10px] text-muted-foreground">{peer.recordCount} records</p>
      </div>
    </div>
  );
}

function FlowStep({
  step, color, title, body,
}: {
  step: string; color: string; title: string; body: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white',
        'text-[9px] font-extrabold mt-0.5', color,
      )}>
        {step}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{body}</p>
      </div>
    </div>
  );
}
