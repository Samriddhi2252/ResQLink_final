import { Siren, Building2, Wifi, WifiOff, Power, Search, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { NetworkStatus } from '@/hooks/use-network';

interface TopNavProps {
  status: NetworkStatus;
  onToggleNetwork: () => void;
  onSos: () => void;
  onShelter: () => void;
  onFindHelp: () => void;
  onOfferHelp: () => void;
}

export function TopNav({ status, onToggleNetwork, onSos, onShelter, onFindHelp, onOfferHelp }: TopNavProps) {
  const isOnline = status === 'online';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
        {/* Brand + network indicator */}
        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-alert/10 ring-1 ring-alert/30">
              <Siren className="h-5 w-5 text-alert" />
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-alert opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-alert" />
              </span>
            </div>
            <div className="leading-none">
              <span className="block text-lg font-extrabold tracking-tight">
                ResQ<span className="text-alert">Link</span>
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground sm:block">
                Disaster Response
              </span>
            </div>
          </div>

          {/* Network indicator */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
              isOnline
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-warning/30 bg-warning/10 text-warning'
            )}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Online</span>
                <span className="sm:hidden">Online</span>
              </>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                  <WifiOff className="relative h-3 w-3" />
                </span>
                <span className="hidden sm:inline">Offline — Local Sync Active</span>
                <span className="sm:hidden">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Right: quick actions + mock toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mock network toggle */}
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 md:flex">
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Mock</span>
            <Switch checked={isOnline} onCheckedChange={onToggleNetwork} aria-label="Toggle network" />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onOfferHelp}
            className="border-success/30 bg-success/10 hover:bg-success/20"
          >
            <BadgeCheck className="mr-1.5 h-4 w-4 text-success" />
            <span className="hidden sm:inline">Offer Help</span>
            <span className="sm:hidden">Offer</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onFindHelp}
            className="border-info/30 bg-info/10 hover:bg-info/20"
          >
            <Search className="mr-1.5 h-4 w-4 text-info" />
            <span className="hidden sm:inline">Find Help</span>
            <span className="sm:hidden">Find</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onShelter}
            className="border-border bg-secondary/40 hover:bg-secondary"
          >
            <Building2 className="mr-1.5 h-4 w-4 text-info" />
            <span className="hidden sm:inline">Shelter Portal</span>
            <span className="sm:hidden">Shelters</span>
          </Button>

          <Button
            size="sm"
            onClick={onSos}
            className="bg-alert text-white shadow-lg shadow-alert/20 hover:bg-alert/90"
          >
            <Siren className="mr-1.5 h-4 w-4" />
            <span className="font-bold">Request Aid</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
