import { Home, Users, MapPin, Navigation, X, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { cn, buildGoogleMapsUrl } from '@/lib/utils';
import type { Shelter } from '@/types';
import type { NavDestination } from '@/hooks/use-navigation';

interface ShelterWidgetProps {
  shelters: Shelter[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationLabel?: string;
  onNavigate?: (dest: NavDestination) => void;
}

export function ShelterWidget({ shelters, open, onOpenChange, locationLabel = 'Delhi NCR', onNavigate }: ShelterWidgetProps) {
  const totalCapacity = shelters.reduce((s, sh) => s + sh.capacity, 0);
  const totalOccupied = shelters.reduce((s, sh) => s + sh.occupied, 0);
  const overallPct = Math.round((totalOccupied / totalCapacity) * 100);
  const openCount = shelters.filter((s) => s.status === 'open').length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-md"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-4 sm:px-6 py-3.5 sm:py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-info/15 ring-1 ring-info/30">
              <Home className="h-4 w-4 sm:h-5 sm:w-5 text-info" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base sm:text-lg font-bold">Shelter Portal</SheetTitle>
              <SheetDescription className="text-xs truncate">
                {openCount} shelters open · {totalCapacity - totalOccupied} beds available
              </SheetDescription>
            </div>
          </div>
        </div>

        {/* Overall capacity */}
        <div className="border-b border-border px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="font-semibold">Regional Capacity</span>
            <span className={cn('font-bold', overallPct > 85 ? 'text-alert' : 'text-success')}>
              {totalOccupied}/{totalCapacity}
            </span>
          </div>
          <Progress
            value={overallPct}
            className={cn('mt-2 h-2.5', overallPct > 85 && '[&_[data-state=complete]]:bg-alert')}
          />
          <div className="mt-1.5 flex justify-between text-[10px] sm:text-[11px] text-muted-foreground">
            <span>{overallPct}% occupied</span>
            <span>{totalCapacity - totalOccupied} beds free</span>
          </div>
        </div>

        {/* Shelter list */}
        <div className="space-y-3 px-4 sm:px-6 py-4">
          {shelters.map((s) => {
            const pct = Math.round((s.occupied / s.capacity) * 100);
            const isFull = s.status === 'full';
            return (
              <div
                key={s.id}
                className="rounded-xl border border-border bg-card p-3.5 sm:p-4 transition-colors hover:bg-card/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold leading-tight break-words">{s.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground break-words">
                      <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{s.address}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                      isFull ? 'bg-alert/15 text-alert' : 'bg-success/15 text-success'
                    )}
                  >
                    {isFull ? 'Full' : 'Open'}
                  </span>
                </div>

                {/* Capacity bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-semibold">
                      <Users className="h-3 w-3 text-muted-foreground" /> {s.occupied}/{s.capacity} beds
                    </span>
                    <span className={cn('font-bold', isFull ? 'text-alert' : pct > 75 ? 'text-warning' : 'text-success')}>
                      {pct}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isFull ? 'bg-alert' : pct > 75 ? 'bg-warning' : 'bg-success'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Amenities */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.amenities.map((a, i) => (
                    <span key={i} className="rounded-md border border-border bg-secondary/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {a}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex gap-1.5">
                  <button
                    onClick={() => onNavigate?.({
                      id: s.id,
                      name: s.name,
                      address: s.address,
                      coords: [s.coords.y, s.coords.x] as [number, number],
                      type: 'shelter',
                    })}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-2 text-xs font-bold transition-colors hover:bg-secondary active:scale-[0.99]"
                  >
                    <Navigation className="h-3.5 w-3.5 text-info" /> Get Directions
                  </button>
                  {(() => {
                    const url = buildGoogleMapsUrl({
                      coords: [s.coords.y, s.coords.x] as [number, number],
                      query: `${s.name}, ${s.address}`,
                    });
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary active:scale-[0.99]"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" /> Maps ↗
                      </a>
                    ) : null;
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
