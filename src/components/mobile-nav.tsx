import { Map, ListChecks, Siren, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'map' | 'feed' | 'sos' | 'shelters';

interface MobileNavProps {
  active: MobileTab;
  onChange: (t: MobileTab) => void;
  onSos: () => void;
}

const TABS: { id: MobileTab; label: string; icon: typeof Map }[] = [
  { id: 'map',      label: 'Map',      icon: Map },
  { id: 'feed',     label: 'Needs',    icon: ListChecks },
  { id: 'sos',      label: 'SOS',      icon: Siren },
  { id: 'shelters', label: 'Shelters', icon: Building2 },
];

export function MobileNav({ active, onChange, onSos }: MobileNavProps) {
  return (
    <nav
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'border-t border-border glass-strong',
      )}
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map((tab) => {
          /* ── SOS centre button ── */
          if (tab.id === 'sos') {
            return (
              <button
                key={tab.id}
                onClick={onSos}
                className="relative -mt-7 flex flex-col items-center gap-1 focus:outline-none"
                aria-label="Post SOS emergency request"
              >
                {/* Outer glow ring */}
                <span className="absolute inset-0 -m-1 rounded-full bg-alert/20 animate-ping-slow pointer-events-none" />
                {/* Button circle */}
                <span
                  className={cn(
                    'relative flex h-14 w-14 items-center justify-center rounded-full',
                    'bg-alert text-white shadow-xl shadow-alert/40',
                    'ring-4 ring-background',
                    'transition-transform active:scale-90',
                  )}
                >
                  <Siren className="h-6 w-6" />
                </span>
                <span className="text-[10px] font-extrabold tracking-wide text-alert">SOS</span>
              </button>
            );
          }

          /* ── Regular tabs ── */
          const Icon     = tab.icon;
          const isActive = active === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-1 min-h-[44px] justify-center',
                'transition-all active:scale-90 focus:outline-none',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
              )}
            >
              {/* Icon container — active gets a pill background */}
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-all duration-150',
                  isActive
                    ? 'bg-secondary border border-border shadow-sm'
                    : 'bg-transparent',
                )}
              >
                <Icon
                  className={cn(
                    'h-4.5 w-4.5 transition-colors',
                    isActive ? 'text-info' : 'text-muted-foreground',
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-[10px] transition-all',
                  isActive ? 'font-bold text-foreground' : 'font-medium',
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
