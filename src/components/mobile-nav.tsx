import { Map, ListChecks, Siren, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MobileTab = 'map' | 'feed' | 'sos' | 'shelters';

interface MobileNavProps {
  active: MobileTab;
  onChange: (t: MobileTab) => void;
  onSos: () => void;
}

const TABS: { id: MobileTab; label: string; icon: typeof Map }[] = [
  { id: 'map', label: 'Map', icon: Map },
  { id: 'feed', label: 'Needs', icon: ListChecks },
  { id: 'sos', label: 'SOS', icon: Siren },
  { id: 'shelters', label: 'Shelters', icon: Building2 },
];

export function MobileNav({ active, onChange, onSos }: MobileNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {TABS.map((tab) => {
          if (tab.id === 'sos') {
            return (
              <button
                key={tab.id}
                onClick={onSos}
                className="relative -mt-6 flex flex-col items-center gap-1 focus:outline-none"
                aria-label="Post SOS request"
              >
                <span className="flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-alert text-white shadow-lg shadow-alert/40 ring-4 ring-background transition-transform active:scale-95">
                  <Siren className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="text-[10px] font-bold text-alert">SOS</span>
              </button>
            );
          }
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-1.5 min-h-[44px] justify-center transition-colors active:scale-95 focus:outline-none',
                isActive ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-colors', isActive && 'text-info')} />
              <span className="text-[10px]">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
