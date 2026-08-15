import { useState } from 'react';
import {
  Search,
  HeartPulse,
  Droplets,
  BedDouble,
  Users,
  LifeBuoy,
  Navigation,
  Clock,
  MapPin,
  PersonStanding,
  CheckCircle2,
  CloudOff,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn, openGoogleMapsDirections } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { CATEGORY_META, PRIORITY_META } from '@/types';
import type { AidRequest, RequestCategory, FilterCategory } from '@/types';
import type { QueuedRequest } from '@/hooks/use-network';
import { timeAgo } from '@/hooks/use-network';

const ICON_MAP: Record<RequestCategory, typeof HeartPulse> = {
  medical: HeartPulse,
  food: Droplets,
  shelter: BedDouble,
  volunteers: Users,
  rescue: LifeBuoy,
};

interface LiveFeedProps {
  requests: AidRequest[];
  filter: FilterCategory;
  isOnline: boolean;
  queue: QueuedRequest[];
  queueCount: number;
  onClearQueue: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function LiveFeed({
  requests,
  filter,
  isOnline,
  queue,
  queueCount,
  onClearQueue,
  selectedId,
  onSelect,
}: LiveFeedProps) {
  const [search, setSearch] = useState('');

  const filtered = requests.filter((r) => {
    if (filter !== 'all' && r.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.details.toLowerCase().includes(q) ||
        r.items.some((i) => i.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const order = { critical: 0, urgent: 1, moderate: 2 };
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return a.distanceMiles - b.distanceMiles;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Search bar */}
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requests, items, or keywords..."
            className="border-border bg-secondary/30 pl-9"
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-info" /> Within 2-mile radius
          </span>
          <span className="font-semibold text-foreground">{sorted.length} requests</span>
        </div>
      </div>

      {/* Offline queue banner */}
      {queueCount > 0 && (
        <div className="border-b border-border bg-warning/[0.06] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-warning/20">
                <CloudOff className="h-3 w-3 text-warning" />
              </span>
              <div>
                <p className="text-xs font-bold text-warning">
                  Offline Queue · {queueCount} pending
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {isOnline ? 'Syncing to server...' : 'Will auto-sync when online'}
                </p>
              </div>
            </div>
            <button
              onClick={onClearQueue}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {queue.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded-md bg-card/60 px-2 py-1.5 text-[11px]">
                {isOnline ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-success" />
                ) : (
                  <Clock className="h-3 w-3 text-warning" />
                )}
                <span className="flex-1 truncate font-medium">{q.details || q.category}</span>
                <span className="text-muted-foreground">{timeAgo(q.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed list */}
      <ScrollArea className="flex-1">
        <div className="space-y-2.5 p-3">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-success/40" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No matching requests</p>
              <p className="text-xs text-muted-foreground/70">Try a different filter or search term</p>
            </div>
          ) : (
            sorted.map((r, i) => (
              <RequestCard
                key={r.id}
                request={r}
                selected={selectedId === r.id}
                onSelect={() => onSelect(r.id)}
                index={i}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface RequestCardProps {
  request: AidRequest;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

function RequestCard({ request, selected, onSelect, index }: RequestCardProps) {
  const meta = CATEGORY_META[request.category];
  const Icon = ICON_MAP[request.category];
  const prio = PRIORITY_META[request.priority];

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group cursor-pointer rounded-xl border bg-card p-3 transition-all animate-slide-in-right',
        selected
          ? 'border-alert/50 ring-1 ring-alert/30'
          : 'border-border hover:border-border/80 hover:bg-card/80'
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.text)} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.bg, meta.text)}>
                {meta.label}
              </span>
              <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', prio.bg, prio.text)}>
                {prio.label}
              </span>
            </div>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[10px] sm:text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" /> {timeAgo(request.createdAt)}
        </span>
      </div>

      {/* Title + details */}
      <h3 className="mt-2 text-sm font-bold leading-snug break-words">{request.title}</h3>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground break-words">{request.details}</p>

      {/* Items */}
      {request.items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {request.items.map((item, i) => (
            <span key={i} className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {item}
            </span>
          ))}
        </div>
      )}

      {/* Footer: distance + people + CTA */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <MapPin className="h-3 w-3 text-info" /> {request.distanceMiles}mi
          </span>
          {request.peopleCount > 0 && (
            <span className="flex items-center gap-0.5">
              <PersonStanding className="h-3 w-3" /> {request.peopleCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 rounded-lg bg-success px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold text-white transition-all hover:bg-success/90 active:scale-95">
            <Users className="h-3 w-3" /> I Can Help
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openGoogleMapsDirections(`${request.title}, Delhi NCR`);
            }}
            className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2 sm:px-2.5 py-1.5 text-[10px] sm:text-[11px] font-bold transition-all hover:bg-secondary active:scale-95"
          >
            <Navigation className="h-3 w-3 text-info" /> Directions
          </button>
        </div>
      </div>
    </div>
  );
}
