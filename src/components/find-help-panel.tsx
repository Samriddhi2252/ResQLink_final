import { useState, useMemo } from 'react';
import {
  Search,
  Hospital,
  Pill,
  UtensilsCrossed,
  Home,
  LifeBuoy,
  MapPin,
  Phone,
  Clock,
  Navigation,
  X,
  Filter,
  BedSingle,
  Mic,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Resource, ResourceType } from '@/types';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { VoiceMicButton } from '@/components/voice-mic-button';

interface FindHelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resources: Resource[];
}

const TYPE_META: Record<
  ResourceType,
  { label: string; icon: typeof Hospital; color: string; bg: string; text: string; border: string }
> = {
  hospital: { label: 'Hospital', icon: Hospital, color: 'alert', bg: 'bg-alert/15', text: 'text-alert', border: 'border-alert/30' },
  pharmacy: { label: 'Pharmacy', icon: Pill, color: 'info', bg: 'bg-info/15', text: 'text-info', border: 'border-info/30' },
  food: { label: 'Food & Water', icon: UtensilsCrossed, color: 'warning', bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/30' },
  shelter: { label: 'Shelter', icon: Home, color: 'success', bg: 'bg-success/15', text: 'text-success', border: 'border-success/30' },
  rescue: { label: 'Rescue', icon: LifeBuoy, color: 'alert', bg: 'bg-alert/15', text: 'text-alert', border: 'border-alert/30' },
};

const STATUS_META: Record<Resource['status'], { label: string; color: string }> = {
  open: { label: 'Open', color: 'text-success' },
  limited: { label: 'Limited', color: 'text-warning' },
  closed: { label: 'Closed', color: 'text-alert' },
};

const TYPE_FILTERS: { id: ResourceType | 'all'; label: string; icon: typeof Hospital }[] = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'hospital', label: 'Hospitals', icon: Hospital },
  { id: 'pharmacy', label: 'Pharmacies', icon: Pill },
  { id: 'food', label: 'Food & Water', icon: UtensilsCrossed },
  { id: 'shelter', label: 'Shelters', icon: Home },
  { id: 'rescue', label: 'Rescue', icon: LifeBuoy },
];

export function FindHelpPanel({ open, onOpenChange, resources }: FindHelpPanelProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');
  const voice = useVoiceInput();

  const handleVoiceSearch = () => {
    if (voice.listening) {
      voice.stop();
      return;
    }
    voice.start((text) => {
      setSearch(text);
    });
  };

  const filtered = useMemo(() => {
    return resources
      .filter((r) => {
        if (typeFilter !== 'all' && r.type !== typeFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            r.name.toLowerCase().includes(q) ||
            r.address.toLowerCase().includes(q) ||
            r.tags.some((t) => t.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [resources, typeFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: resources.length };
    for (const r of resources) c[r.type] = (c[r.type] || 0) + 1;
    return c;
  }, [resources]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/15 ring-1 ring-info/30">
              <Search className="h-5 w-5 text-info" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">Find Help Near You</SheetTitle>
              <SheetDescription className="text-xs">
                Search hospitals, pharmacies, food, shelters & rescue services in NCR
              </SheetDescription>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, area, or need (e.g. insulin, dialysis, langar)..."
className={cn('border-border bg-secondary/30 pl-9 pr-20', voice.listening && 'border-alert/40 ring-1 ring-alert/20')}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-12 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <VoiceMicButton
                listening={voice.listening}
                supported={voice.supported}
                onStart={handleVoiceSearch}
                onStop={handleVoiceSearch}
                size="sm"
              />
            </div>
          </div>

          {voice.listening && (
            <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-alert">
              <Mic className="h-3 w-3 animate-pulse" /> Listening… speak your search
            </p>
          )}

          {/* Type filter chips */}
          <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
            {TYPE_FILTERS.map((f) => {
              const Icon = f.icon;
              const active = typeFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    active
                      ? 'border-info/40 bg-info/15 text-info'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                  <span className={cn('rounded-full px-1.5 text-[10px]', active ? 'bg-info/20' : 'bg-secondary')}>
                    {counts[f.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-2.5 p-4">
            <p className="text-xs text-muted-foreground">
              {filtered.length} resource{filtered.length !== 1 ? 's' : ''} found
              {search && ` for "${search}"`}
            </p>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="h-10 w-10 text-muted-foreground/30" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">No resources found</p>
                <p className="text-xs text-muted-foreground/70">Try a different search or filter</p>
              </div>
            ) : (
              filtered.map((r, i) => (
                <ResourceCard key={r.id} resource={r} index={i} />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ResourceCard({ resource, index }: { resource: Resource; index: number }) {
  const meta = TYPE_META[resource.type];
  const Icon = meta.icon;
  const status = STATUS_META[resource.status];

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 transition-all animate-slide-in-right hover:bg-card/80"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
          <Icon className={cn('h-5 w-5', meta.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-tight">{resource.name}</h3>
            <span className={cn('shrink-0 text-[10px] font-bold uppercase', status.color)}>
              {status.label}
            </span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" /> {resource.address}
          </p>

          {/* Tags */}
          <div className="mt-2 flex flex-wrap gap-1">
            <span className={cn('rounded-md border px-1.5 py-0.5 text-[10px] font-bold', meta.border, meta.bg, meta.text)}>
              {meta.label}
            </span>
            {resource.open24h && (
              <span className="flex items-center gap-0.5 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                <Clock className="h-2.5 w-2.5" /> 24h
              </span>
            )}
            {resource.bedsAvailable !== undefined && resource.bedsAvailable > 0 && (
              <span className="flex items-center gap-0.5 rounded-md border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-medium text-success">
                <BedSingle className="h-2.5 w-2.5" /> {resource.bedsAvailable} beds
              </span>
            )}
            {resource.tags.map((t, i) => (
              <span key={i} className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t}
              </span>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3 text-info" /> {resource.distanceMiles}mi
              </span>
              <span className="flex items-center gap-0.5">
                <Phone className="h-3 w-3" /> {resource.phone}
              </span>
            </div>
            <button className="flex items-center gap-1 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 text-[11px] font-bold transition-all hover:bg-secondary active:scale-95">
              <Navigation className="h-3 w-3 text-info" /> Directions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
