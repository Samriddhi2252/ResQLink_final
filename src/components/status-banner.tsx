import {
  AlertTriangle, MapPin, Radio, ChevronDown, Map,
  Activity, BedDouble, Users, Flame, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILTER_TABS } from '@/types';
import type { FilterCategory } from '@/types';
import { REGION_ZONES } from '@/mockData';
import type { MapRegion } from '@/components/map-view';
import { useState } from 'react';

interface StatusBannerProps {
  activeFilter: FilterCategory;
  onFilterChange: (f: FilterCategory) => void;
  requestCount: number;
  region: MapRegion;
  onRegionChange: (r: MapRegion) => void;
}

const REGION_OPTIONS: { value: MapRegion; label: string; flag: string }[] = [
  { value: 'ncr',       label: 'Delhi NCR',             flag: '🏙️' },
  { value: 'badrinath', label: 'Badrinath / Joshimath', flag: '🏔️' },
];

/* Category icons for filter tabs */
const TAB_ICONS: Record<string, React.ReactNode> = {
  all:        <Activity   className="h-3.5 w-3.5" />,
  medical:    <Flame      className="h-3.5 w-3.5" />,
  food:       <Users      className="h-3.5 w-3.5" />,
  shelter:    <BedDouble  className="h-3.5 w-3.5" />,
  volunteers: <Users      className="h-3.5 w-3.5" />,
};

export function StatusBanner({
  activeFilter,
  onFilterChange,
  requestCount,
  region,
  onRegionChange,
}: StatusBannerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const info = REGION_ZONES[region];

  /* Derive a "critical" count as a fraction of total for the stat card */
  const criticalCount = Math.max(1, Math.round(requestCount * 0.3));

  return (
    <div className="w-full border-b border-border bg-card/60 backdrop-blur-sm">
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-4 space-y-3 sm:space-y-4">

        {/* ── ROW 1: Emergency status + region switcher ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

          {/* Left — zone identity */}
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Pulsing alert icon */}
            <div className="mt-0.5 relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-alert/15 ring-1 ring-alert/30">
              <AlertTriangle className="h-5 w-5 text-alert" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-alert opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-alert" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              {/* Live badge + type */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/35 bg-alert/[12%] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-alert">
                  <Radio className="h-2.5 w-2.5" />
                  Active Emergency
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  <Clock className="h-2.5 w-2.5" />
                  <span className="hidden sm:inline">Live Response Ongoing</span>
                  <span className="sm:hidden">Live</span>
                </span>
              </div>

              {/* Zone title */}
              <h1 className="mt-1.5 text-lg font-extrabold leading-tight tracking-tight sm:text-xl break-words text-foreground">
                {info.zone}
              </h1>

              {/* Location + hazard */}
              <div className="mt-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-info" />
                  <span className="truncate">{info.location}</span>
                </p>
                <span className="hidden sm:inline text-border">·</span>
                <p className="flex items-center gap-1.5 text-xs text-warning/80">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{info.hazard}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right — region switcher */}
          <div className="relative flex-shrink-0 self-start">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
                'bg-card shadow-sm backdrop-blur-md transition-all hover:bg-secondary/60 active:scale-[0.98]',
                menuOpen ? 'border-info/50 text-info' : 'border-border text-foreground',
              )}
            >
              <Map className="h-3.5 w-3.5 shrink-0 text-info" />
              <span className="hidden sm:inline text-muted-foreground">Region:</span>
              <span className="font-bold">
                {REGION_OPTIONS.find(r => r.value === region)?.flag}{' '}
                {REGION_OPTIONS.find(r => r.value === region)?.label}
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', menuOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-72 sm:w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-float-up">
                  <div className="px-4 pt-3 pb-2 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Select Emergency Region
                    </p>
                  </div>
                  {REGION_OPTIONS.map(opt => {
                    const ri = REGION_ZONES[opt.value];
                    const isActive = region === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { onRegionChange(opt.value); setMenuOpen(false); }}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/50',
                          isActive && 'bg-info/[8%] border-l-2 border-info',
                        )}
                      >
                        <span className="mt-0.5 text-xl shrink-0 leading-none">{opt.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-bold leading-tight', isActive ? 'text-info' : 'text-foreground')}>
                              {opt.label}
                            </p>
                            {isActive && (
                              <span className="rounded-full bg-info/15 border border-info/30 px-1.5 py-0.5 text-[9px] font-bold text-info uppercase tracking-wide">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed truncate">
                            {ri.location}
                          </p>
                          <p className="mt-0.5 text-[10px] text-warning/70 leading-tight truncate">
                            ⚠ {ri.hazard}
                          </p>
                          <div className="mt-1.5 flex items-center gap-3">
                            <RegionMiniStat label="Requests"  value={ri.stats.requestCount} />
                            <RegionMiniStat label="Shelters"  value={ri.stats.shelterCount} />
                            <RegionMiniStat label="Responders" value={ri.stats.responderCount} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── ROW 2: Stat cards ── */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5 -mx-0.5 px-0.5">
          <StatCard
            value={requestCount}
            label="Active Requests"
            valueClass="text-alert"
            borderClass="border-alert/20"
            bgClass="bg-alert/5"
            dot="bg-alert"
          />
          <StatCard
            value={info.stats.shelterCount}
            label="Shelters"
            valueClass="text-info"
            borderClass="border-info/20"
            bgClass="bg-info/5"
            dot="bg-info"
          />
          <StatCard
            value={info.stats.responderCount}
            label="Responders"
            valueClass="text-success"
            borderClass="border-success/20"
            bgClass="bg-success/5"
            dot="bg-success"
          />
          <StatCard
            value={criticalCount}
            label="Critical Cases"
            valueClass="text-alert"
            borderClass="border-alert/25"
            bgClass="bg-alert/[8%]"
            dot="bg-alert animate-pulse"
          />
          <div className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground font-medium">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <span>{info.stats.area}</span>
          </div>
        </div>

        {/* ── ROW 3: Filter tabs ── */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5 -mx-0.5 px-0.5">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={cn(
                  'relative flex shrink-0 items-center gap-1.5 rounded-lg px-3 sm:px-4 py-2 text-xs font-medium',
                  'border transition-all duration-150 whitespace-nowrap',
                  active
                    ? 'bg-secondary border-border text-foreground font-semibold shadow-sm'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )}
              >
                {TAB_ICONS[tab.id] && (
                  <span className={cn('shrink-0 transition-colors', active ? 'text-alert' : 'text-muted-foreground/60')}>
                    {TAB_ICONS[tab.id]}
                  </span>
                )}
                {tab.label}
                {active && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-alert" />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StatCard({
  value,
  label,
  valueClass,
  borderClass,
  bgClass,
  dot,
}: {
  value: number;
  label: string;
  valueClass: string;
  borderClass: string;
  bgClass: string;
  dot: string;
}) {
  return (
    <div className={cn(
      'flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-colors',
      borderClass, bgClass,
    )}>
      <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
      <div className="leading-none">
        <p className={cn('text-xl font-extrabold leading-none tabular-nums', valueClass)}>
          {value}
        </p>
        <p className="mt-1 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
          {label}
        </p>
      </div>
    </div>
  );
}

function RegionMiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[9px] text-muted-foreground">
      <span className="font-bold text-foreground">{value}</span> {label}
    </span>
  );
}
