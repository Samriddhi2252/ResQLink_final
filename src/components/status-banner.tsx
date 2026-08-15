import { AlertTriangle, MapPin, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FILTER_TABS } from '@/types';
import type { FilterCategory } from '@/types';
import { EMERGENCY_ZONE } from '@/mockData';

interface StatusBannerProps {
  activeFilter: FilterCategory;
  onFilterChange: (f: FilterCategory) => void;
  requestCount: number;
}

export function StatusBanner({ activeFilter, onFilterChange, requestCount }: StatusBannerProps) {
  return (
    <div className="border-b border-border bg-gradient-to-b from-alert/[0.08] to-transparent">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {/* Alert banner */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-alert/15 ring-1 ring-alert/30">
              <AlertTriangle className="h-5 w-5 text-alert" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-alert">
                  Active Emergency Zone
                </span>
                <span className="flex items-center gap-1 rounded-full bg-alert/10 px-2 py-0.5 text-[10px] font-semibold text-alert">
                  <Radio className="h-2.5 w-2.5" /> LIVE
                </span>
              </div>
              <h1 className="mt-0.5 text-lg font-bold leading-tight sm:text-xl">
                {EMERGENCY_ZONE}
              </h1>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> Monitoring {requestCount} active requests within 2-mile radius
              </p>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-4 -mb-px flex gap-1 overflow-x-auto scrollbar-hide">
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange(tab.id)}
                className={cn(
                  'relative whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-alert text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
  );
}
