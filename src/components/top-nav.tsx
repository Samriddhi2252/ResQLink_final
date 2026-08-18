import { Siren, Building2, Wifi, WifiOff, Power, Search, BadgeCheck, Menu, Sun, Moon, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NetworkStatus } from '@/hooks/use-network';

interface TopNavProps {
  status: NetworkStatus;
  onToggleNetwork: () => void;
  onSos: () => void;
  onShelter: () => void;
  onFindHelp: () => void;
  onOfferHelp: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onTriage?: () => void;
}

export function TopNav({ status, onToggleNetwork, onSos, onShelter, onFindHelp, onOfferHelp, theme, onToggleTheme, onTriage }: TopNavProps) {
  const isOnline = status === 'online';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1600px] items-center justify-between px-3 sm:px-6">
        {/* Brand + network indicator */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-alert/10 ring-1 ring-alert/30">
              <Siren className="h-4 w-4 sm:h-5 sm:w-5 text-alert" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-alert opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-alert" />
              </span>
            </div>
            <div className="leading-none">
              <span className="block text-base sm:text-lg font-extrabold tracking-tight">
                ResQ<span className="text-alert">Link</span>
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-widest text-muted-foreground md:block">
                Disaster Response
              </span>
            </div>
          </div>

          {/* Network indicator */}
          <div
            className={cn(
              'flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold transition-colors',
              isOnline
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-warning/30 bg-warning/10 text-warning'
            )}
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="hidden sm:inline">Online</span>
                <span className="sm:hidden">Online</span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                  <WifiOff className="relative h-2.5 w-2.5 sm:h-3 sm:w-3" />
                </span>
                <span className="hidden md:inline">Offline — Local Sync Active</span>
                <span className="md:hidden">Offline</span>
              </>
            )}
          </div>
        </div>

        {/* Right: desktop buttons / tablet buttons / mobile menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3">
          {/* Mock network toggle (Desktop & Tablet >= md) */}
          <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 md:flex">
            <Power className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Mock</span>
            <Switch checked={isOnline} onCheckedChange={onToggleNetwork} aria-label="Toggle mock network" />
          </div>

          {/* Desktop & Tablet actions (>= md) */}
          <div className="hidden items-center gap-1.5 sm:gap-2 md:flex">
            <Button
              variant="outline"
              size="sm"
              onClick={onOfferHelp}
              className="border-success/30 bg-success/10 hover:bg-success/20 text-xs sm:text-sm"
            >
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-success" />
              <span>Offer Help</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onFindHelp}
              className="border-info/30 bg-info/10 hover:bg-info/20 text-xs sm:text-sm"
            >
              <Search className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-info" />
              <span>Find Help</span>
            </Button>

            {onTriage && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTriage}
                className="border-warning/30 bg-warning/10 hover:bg-warning/20 text-xs sm:text-sm"
              >
                <Brain className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning" />
                <span>AI Triage</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onShelter}
              className="border-border bg-secondary/40 hover:bg-secondary text-xs sm:text-sm"
            >
              <Building2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 text-info" />
              <span>Shelters</span>
            </Button>
          </div>

          {/* Primary SOS button (Visible on all screen sizes) */}
          <Button
            size="sm"
            onClick={onSos}
            className="h-8 sm:h-9 px-2.5 sm:px-3 bg-alert text-white shadow-md shadow-alert/20 hover:bg-alert/90 shrink-0"
          >
            <Siren className="mr-1 sm:mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="font-bold text-xs sm:text-sm">Request Aid</span>
          </Button>

          {/* Theme toggle (always visible) */}
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
            className={cn(
              'flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg',
              'border border-border bg-secondary/40 text-muted-foreground',
              'transition-colors hover:bg-secondary hover:text-foreground active:scale-95',
            )}
          >
            {theme === 'dark'
              ? <Sun className="h-4 w-4 text-warning" />
              : <Moon className="h-4 w-4 text-info" />
            }
          </button>

          {/* Mobile Menu Dropdown (< md) */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border bg-secondary/40 hover:bg-secondary"
                  aria-label="More navigation options"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border p-1.5 shadow-xl">
                <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">
                  Quick Actions
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={onOfferHelp}
                  className="flex items-center gap-2 py-2 px-2 text-xs font-medium cursor-pointer rounded-md focus:bg-secondary"
                >
                  <BadgeCheck className="h-4 w-4 text-success" />
                  <span>Offer Help / Resources</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onFindHelp}
                  className="flex items-center gap-2 py-2 px-2 text-xs font-medium cursor-pointer rounded-md focus:bg-secondary"
                >
                  <Search className="h-4 w-4 text-info" />
                  <span>Find Help Near You</span>
                </DropdownMenuItem>
                {onTriage && (
                  <DropdownMenuItem
                    onClick={onTriage}
                    className="flex items-center gap-2 py-2 px-2 text-xs font-medium cursor-pointer rounded-md focus:bg-secondary"
                  >
                    <Brain className="h-4 w-4 text-warning" />
                    <span>AI Emergency Triage</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={onShelter}
                  className="flex items-center gap-2 py-2 px-2 text-xs font-medium cursor-pointer rounded-md focus:bg-secondary"
                >
                  <Building2 className="h-4 w-4 text-info" />
                  <span>Shelter Portal</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border" />
                <DropdownMenuItem
                  onClick={onToggleTheme}
                  className="flex items-center gap-2 py-2 px-2 text-xs font-medium cursor-pointer rounded-md focus:bg-secondary"
                >
                  {theme === 'dark'
                    ? <Sun className="h-4 w-4 text-warning" />
                    : <Moon className="h-4 w-4 text-info" />
                  }
                  <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border" />
                <div className="flex items-center justify-between px-2 py-1.5 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Power className="h-3.5 w-3.5" /> Mock Network
                  </span>
                  <Switch
                    checked={isOnline}
                    onCheckedChange={onToggleNetwork}
                    aria-label="Toggle network mode"
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

