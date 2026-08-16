import { AlertTriangle, MapPin, Radio, ChevronDown, Map } from 'lucide-react';
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
  { value: 'ncr',        label: 'Delhi NCR',                flag: '🏙️' },
  { value: 'badrinath',  label: 'Badrinath / Joshimath',    flag: '🏔️' },
];

export function StatusBanner({
  activeFilter,
  onFilterChange,
  requestCount,
  region,
  onRegionChange,
}: StatusBannerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const info = REGION_ZONES[region];

  return (
    <div className="w-full border-b border-border bg-gradient-to-b from-alert/[0.08] to-transparent">
      <div className="mx-auto max-w-[1600px] px-3 py-3 sm:px-6 sm:py-4">

        {/* ── Alert banner + Region Switcher ── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

          {/* Left: zone info */}
          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="mt-0.5 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-alert/15 ring-1 ring-alert/30">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-alert" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-alert">
                  Active Emergency Zone
                </span>
                <span className="flex items-center gap-1 rounded-full bg-alert/10 px-2 py-0.5 text-[10px] font-semibold text-alert">
                  <Radio className="h-2.5 w-2.5" /> LIVE
                </span>
              </div>

              {/* Zone title — the big heading */}
              <h1 className="mt-0.5 text-base font-bold leading-tight sm:text-xl break-words">
                {info.zone}
              </h1>

              {/* Location + hazard type row */}
              <div className="mt-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
                <p className="flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{info.location}</span>
                </p>
                <span className="hidden sm:inline text-muted-foreground/40">·</span>
                <p className="flex items-center gap-1 text-[11px] sm:text-xs text-warning/80">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span className="truncate">{info.hazard}</span>
                </p>
              </div>

              {/* Region quick stats */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Stat label="Active requests" value={requestCount} color="text-alert" />
                <Stat label="Shelters" value={info.stats.shelterCount} color="text-info" />
                <Stat label="Responders" value={info.stats.responderCount} color="text-success" />
                <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {info.stats.area}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Region Switcher */}
          <div className="relative flex-shrink-0 self-start sm:self-center">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] sm:text-xs font-semibold',
                'bg-card/80 shadow-md backdrop-blur-md transition-all hover:bg-secondary/60',
                menuOpen ? 'border-info text-info' : 'border-border text-foreground',
              )}
            >
              <Map className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Map Region:</span>
              <span className="font-bold">
                {REGION_OPTIONS.find(r => r.value === region)?.flag}{' '}
                {REGION_OPTIONS.find(r => r.value === region)?.label}
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', menuOpen && 'rotate-180')} />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />

                <div className="absolute right-0 top-full z-50 mt-2 w-72 sm:w-80
                  rounded-2xl border border-border bg-card shadow-2xl backdrop-blur-xl overflow-hidden
                  animate-float-up">

                  <div className="px-4 pt-3 pb-2 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Select Region
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
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                          'hover:bg-secondary/50',
                          isActive && 'bg-info/8 border-l-2 border-info',
                        )}
                      >
                        {/* Flag / icon */}
                        <span className="mt-0.5 text-xl shrink-0 leading-none">{opt.flag}</span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-bold leading-tight',
                              isActive ? 'text-info' : 'text-foreground')}>
                              {opt.label}
                            </p>
                            {isActive && (
                              <span className="rounded-full bg-info/15 border border-info/30 px-1.5 py-0.5
                                text-[9px] font-bold text-info uppercase tracking-wide">
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
                          {/* Mini stats row */}
                          <div className="mt-1.5 flex items-center gap-2">
                            <MiniStat label="Requests" value={ri.stats.requestCount} />
                            <MiniStat label="Shelters" value={ri.stats.shelterCount} />
                            <MiniStat label="Responders" value={ri.stats.responderCount} />
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

        {/* ── Filter tabs ── */}
        <div className="relative mt-3 sm:mt-4">
          <div className="-mb-px flex gap-1 overflow-x-auto scrollbar-hide touch-pan-x pb-0.5">
            {FILTER_TABS.map((tab) => {
              const active = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onFilterChange(tab.id)}
                  className={cn(
                    'relative shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-colors',
                    active
                      ? 'border-alert text-foreground font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-alert" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-border bg-secondary/40 px-2 py-0.5">
      <span className={cn('text-[11px] font-bold', color)}>{value}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[9px] text-muted-foreground">
      <span className="font-bold text-foreground">{value}</span> {label}
    </span>
  );
}
