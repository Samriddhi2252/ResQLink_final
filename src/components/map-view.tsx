import { useState } from 'react';
import {
  HeartPulse,
  Droplets,
  BedDouble,
  Users,
  LifeBuoy,
  Home,
  Navigation,
  Layers,
  Crosshair,
  X,
} from 'lucide-react';
import { cn, openGoogleMapsDirections } from '@/lib/utils';
import { CATEGORY_META } from '@/types';
import type { AidRequest, Shelter, Volunteer, RequestCategory } from '@/types';

interface MapViewProps {
  requests: AidRequest[];
  shelters: Shelter[];
  volunteers: Volunteer[];
  isOnline: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ICON_MAP: Record<RequestCategory, typeof HeartPulse> = {
  medical: HeartPulse,
  food: Droplets,
  shelter: BedDouble,
  volunteers: Users,
  rescue: LifeBuoy,
};

const NCR_LABELS: { name: string; x: number; y: number }[] = [
  { name: 'Wazirabad', x: 22, y: 74 },
  { name: 'Seelampur', x: 50, y: 24 },
  { name: 'Yamuna Bank', x: 48, y: 50 },
  { name: 'ITO', x: 38, y: 52 },
  { name: 'Mayur Vihar', x: 28, y: 54 },
  { name: 'Geeta Colony', x: 44, y: 66 },
  { name: 'Chandni Chowk', x: 82, y: 42 },
  { name: 'Shakarpur', x: 70, y: 34 },
  { name: 'Usmanpur', x: 76, y: 59 },
  { name: 'Model Town', x: 16, y: 40 },
];

type MarkerType = 'request' | 'shelter' | 'volunteer';

interface SelectedInfo {
  type: MarkerType;
  data: AidRequest | Shelter | Volunteer;
}

export function MapView({
  requests,
  shelters,
  volunteers,
  isOnline,
  selectedId,
  onSelect,
}: MapViewProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedInfo | null>(null);

  const handleSelect = (info: SelectedInfo) => {
    setSelected(info);
    if (info.type === 'request') {
      onSelect((info.data as AidRequest).id);
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border bg-background">
      {/* Map canvas — styled vector map placeholder */}
      <div className="absolute inset-0">
        {/* Grid overlay */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Water bodies / flood zones */}
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="flood" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0c4a6e" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#082f49" stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="river" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          {/* River */}
          <path d="M -5 55 Q 20 50 35 58 T 70 52 T 105 48 L 105 62 Q 75 66 50 60 T -5 64 Z" fill="url(#river)" />
          {/* Flood zone */}
          <ellipse cx="55" cy="45" rx="30" ry="22" fill="url(#flood)" />
          <ellipse cx="55" cy="45" rx="20" ry="14" fill="#0ea5e9" opacity="0.08" />
          {/* Roads */}
          <g stroke="#334155" strokeWidth="0.4" opacity="0.5" fill="none">
            <path d="M 0 30 L 100 30" />
            <path d="M 0 70 L 100 70" />
            <path d="M 25 0 L 25 100" />
            <path d="M 60 0 L 60 100" />
            <path d="M 0 0 L 100 100" opacity="0.3" />
          </g>
          {/* Blocks */}
          <g fill="#1e293b" opacity="0.4">
            <rect x="5" y="5" width="15" height="20" rx="1" />
            <rect x="28" y="5" width="25" height="20" rx="1" />
            <rect x="65" y="5" width="28" height="20" rx="1" />
            <rect x="5" y="75" width="18" height="18" rx="1" />
            <rect x="30" y="75" width="25" height="18" rx="1" />
            <rect x="65" y="75" width="28" height="18" rx="1" />
          </g>
        </svg>

        {/* NCR location labels */}
        <div className="pointer-events-none absolute inset-0 select-none">
          {NCR_LABELS.map((lbl) => (
            <span
              key={lbl.name}
              className="absolute -translate-x-1/2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50"
              style={{ left: `${lbl.x}%`, top: `${lbl.y}%` }}
            >
              {lbl.name}
            </span>
          ))}
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute right-2 sm:right-3 top-2 sm:top-3 z-20 flex flex-col gap-1 sm:gap-1.5">
        <button className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-secondary active:scale-95" aria-label="Zoom in">
          <span className="text-base sm:text-lg font-bold">+</span>
        </button>
        <button className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-secondary active:scale-95" aria-label="Zoom out">
          <span className="text-base sm:text-lg font-bold">−</span>
        </button>
        <button className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg border border-border bg-card/90 text-foreground shadow-md backdrop-blur transition-colors hover:bg-secondary active:scale-95" aria-label="Recenter">
          <Crosshair className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-info" />
        </button>
      </div>

      {/* Legend (Responsive: Collapsible / Compact on mobile) */}
      <div className="absolute left-2 sm:left-3 top-2 sm:top-3 z-20 max-w-[200px] rounded-lg border border-border bg-card/90 p-2 sm:p-3 shadow-md backdrop-blur">
        <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-semibold text-foreground">
          <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-info" />
          <span>Map Legend</span>
        </div>
        <div className="mt-1.5 space-y-1 sm:space-y-1.5">
          <LegendItem color="bg-alert" label="Urgent Needs" />
          <LegendItem color="bg-success" label="Supplies / Volunteers" />
          <LegendItem color="bg-info" label="Open Shelters" />
        </div>
      </div>

      {/* Offline overlay */}
      {!isOnline && (
        <div className="absolute right-2 sm:right-3 bottom-2 sm:bottom-3 z-20 flex items-center gap-1.5 sm:gap-2 rounded-lg border border-warning/30 bg-warning/10 px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs font-medium text-warning shadow-md backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-warning" />
          </span>
          Cached map tiles (offline)
        </div>
      )}

      {/* "You are here" marker */}
      <div
        className="absolute z-10"
        style={{ left: '48%', top: '50%' }}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          <div className="h-4 w-4 rounded-full bg-info ring-4 ring-info/30 ring-offset-2 ring-offset-background" />
          <span className="absolute left-1/2 top-5 -translate-x-1/2 whitespace-nowrap rounded bg-info/15 px-1.5 py-0.5 text-[9px] font-bold text-info">
            You are here
          </span>
        </div>
      </div>

      {/* Shelter markers */}
      {shelters.map((s) => {
        const pct = Math.round((s.occupied / s.capacity) * 100);
        const isFull = s.status === 'full';
        return (
          <button
            key={s.id}
            className="absolute z-10 -translate-x-1/2 -translate-y-full transition-transform hover:scale-110"
            style={{ left: `${s.coords.x}%`, top: `${s.coords.y}%` }}
            onMouseEnter={() => setHovered(s.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect({ type: 'shelter', data: s })}
          >
            <div className="relative flex flex-col items-center">
              <div className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border-2 shadow-lg',
                isFull ? 'border-alert bg-alert/20' : 'border-info bg-info/20'
              )}>
                <Home className={cn('h-4 w-4', isFull ? 'text-alert' : 'text-info')} />
              </div>
              <div className="absolute -bottom-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-bold shadow">
                {s.occupied}/{s.capacity}
              </div>
              {hovered === s.id && (
                <div className="absolute bottom-full mb-2 w-44 rounded-lg border border-border bg-popover p-2 text-left shadow-xl">
                  <p className="text-xs font-semibold">{s.name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{s.address}</p>
                  <p className={cn('mt-1 text-[10px] font-bold', isFull ? 'text-alert' : 'text-success')}>
                    {isFull ? 'FULL' : `${pct}% occupied`}
                  </p>
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Volunteer markers */}
      {volunteers.filter((v) => v.available).map((v) => (
        <button
          key={v.id}
          className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
          style={{ left: `${v.coords.x}%`, top: `${v.coords.y}%` }}
          onMouseEnter={() => setHovered(v.id)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleSelect({ type: 'volunteer', data: v })}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-success bg-success/20 shadow-lg">
            <Users className="h-3.5 w-3.5 text-success" />
          </div>
        </button>
      ))}

      {/* Request markers with pulsing rings */}
      {requests.map((r) => {
        const meta = CATEGORY_META[r.category];
        const Icon = ICON_MAP[r.category];
        const isCritical = r.priority === 'critical';
        const isSelected = selectedId === r.id;
        return (
          <button
            key={r.id}
            className={cn(
              'absolute z-10 -translate-x-1/2 -translate-y-full transition-transform hover:scale-110',
              isSelected && 'z-20 scale-110'
            )}
            style={{ left: `${r.coords.x}%`, top: `${r.coords.y}%` }}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect({ type: 'request', data: r })}
          >
            <div className="relative flex flex-col items-center">
              {isCritical && (
                <>
                  <span className={cn('absolute -top-1 h-9 w-9 animate-pulse-ring rounded-full', meta.bg)} />
                  <span className={cn('absolute -top-1 h-9 w-9 animate-ping-slow rounded-full opacity-40', meta.bg)} />
                </>
              )}
              <div className={cn(
                'relative flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-lg',
                meta.border, meta.bg
              )}>
                <Icon className={cn('h-4 w-4', meta.text)} />
              </div>
              <div className={cn('h-2 w-1 -mt-0.5', isCritical ? 'bg-alert' : 'bg-muted-foreground/50')} />
              {hovered === r.id && (
                <div className="absolute bottom-full mb-1 w-48 rounded-lg border border-border bg-popover p-2 text-left shadow-xl">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('rounded px-1.5 py-0.5 text-[9px] font-bold uppercase', meta.bg, meta.text)}>
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{r.distanceMiles}mi</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold">{r.title}</p>
                </div>
              )}
            </div>
          </button>
        );
      })}

      {/* Selected detail card */}
      {selected && (
        <div className="absolute inset-x-2 bottom-2 sm:inset-x-4 sm:bottom-4 z-30 max-h-[60vh] overflow-y-auto animate-float-up rounded-xl border border-border bg-card/95 p-3 sm:p-4 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => { setSelected(null); onSelect(''); }}
            className="absolute right-2.5 top-2.5 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <SelectedDetail info={selected} />
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn('h-2.5 w-2.5 rounded-full', color)} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function SelectedDetail({ info }: { info: SelectedInfo }) {
  if (info.type === 'request') {
    const r = info.data as AidRequest;
    const meta = CATEGORY_META[r.category];
    const Icon = ICON_MAP[r.category];
    return (
      <div>
        <div className="flex items-center gap-2 pr-8">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.bg)}>
            <Icon className={cn('h-4 w-4', meta.text)} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{r.title}</p>
            <p className="text-xs text-muted-foreground">{r.distanceMiles} mi away · {r.peopleCount > 0 ? `${r.peopleCount} people` : 'No headcount'}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{r.details}</p>
        {r.items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {r.items.map((item, i) => (
              <span key={i} className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium">
                {item}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-success/90">
            <Users className="h-3.5 w-3.5" /> I Can Help
          </button>
          <button
            onClick={() => openGoogleMapsDirections(`${r.title}, Delhi NCR`)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary active:scale-95"
          >
            <Navigation className="h-3.5 w-3.5 text-info" /> Directions
          </button>
        </div>
      </div>
    );
  }
  if (info.type === 'shelter') {
    const s = info.data as Shelter;
    const pct = Math.round((s.occupied / s.capacity) * 100);
    return (
      <div>
        <div className="flex items-center gap-2 pr-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info/15">
            <Home className="h-4 w-4 text-info" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.address}</p>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs">
              <span className="font-semibold">{s.occupied}/{s.capacity} beds</span>
              <span className={s.status === 'full' ? 'text-alert' : 'text-success'}>{pct}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary">
              <div className={cn('h-full rounded-full', s.status === 'full' ? 'bg-alert' : 'bg-success')} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {s.amenities.map((a, i) => (
            <span key={i} className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-[11px] font-medium">{a}</span>
          ))}
        </div>
        <div className="mt-3">
          <button
            onClick={() => openGoogleMapsDirections(`${s.name}, ${s.address}, Delhi NCR`)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary active:scale-95"
          >
            <Navigation className="h-3.5 w-3.5 text-info" /> Get Directions to Shelter
          </button>
        </div>
      </div>
    );
  }
  const v = info.data as Volunteer;
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/15">
          <Users className="h-4 w-4 text-success" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{v.name}</p>
          <p className="text-xs text-muted-foreground">{v.distanceMiles} mi away</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {v.skills.map((s, i) => (
          <span key={i} className="rounded-md border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">{s}</span>
        ))}
      </div>
    </div>
  );
}
