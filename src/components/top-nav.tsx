import {
  Siren, Building2, Wifi, WifiOff, Power, Search,
  BadgeCheck, Menu, Sun, Moon, Brain, ShieldAlert,
  ChevronDown,
} from 'lucide-react';
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

export function TopNav({
  status, onToggleNetwork, onSos, onShelter,
  onFindHelp, onOfferHelp, theme, onToggleTheme, onTriage,
}: TopNavProps) {
  const isOnline = status === 'online';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Thin emergency-status stripe at very top */}
      <div className={cn(
        'w-full px-4 py-1 text-center text-[10px] font-semibold tracking-widest uppercase transition-colors',
        isOnline
          ? 'bg-alert/90 text-white'
          : 'bg-warning/90 text-white',
      )}>
        <span className="inline-flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className={cn(
              'absolute inline-flex h-full w-full animate-ping-slow rounded-full opacity-75',
              isOnline ? 'bg-white' : 'bg-white',
            )} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          {isOnline
            ? 'Emergency Network Active — ResQLinkk Disaster Response System'
            : 'Offline Mode Active — Local Data Available — Will Sync on Reconnect'}
        </span>
      </div>

      {/* Main header bar */}
      <div className="w-full border-b border-border glass-strong">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-3 sm:px-6 gap-3">

          {/* ── LEFT: Brand ── */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            {/* Logo mark */}
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-alert/15 ring-1 ring-alert/30">
              <ShieldAlert className="h-5 w-5 text-alert" />
              <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping-slow rounded-full bg-alert opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-alert" />
              </span>
            </div>

            {/* Brand name */}
            <div className="leading-none">
              <div className="flex items-baseline gap-0.5">
                <span className="text-base font-extrabold tracking-tight text-foreground">
                  ResQ
                </span>
                <span className="text-base font-extrabold tracking-tight text-alert">
                  Linkk
                </span>
              </div>
              <span className="hidden text-[9px] font-semibold uppercase tracking-[0.15em] text-muted-foreground md:block">
                Offline Disaster Response
              </span>
            </div>

            {/* Separator */}
            <div className="hidden md:block h-7 w-px bg-border/60" />

            {/* Network pill */}
            <div className={cn(
              'hidden md:flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all',
              isOnline
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-warning/30 bg-warning/10 text-warning',
            )}>
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                    <WifiOff className="relative h-2.5 w-2.5" />
                  </span>
                  <span className="hidden lg:inline">Offline — Local Sync Active</span>
                  <span className="lg:hidden">Offline</span>
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT: Actions ── */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Mock network toggle — desktop */}
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-secondary/40 px-2.5 py-1.5 lg:flex">
              <Power className="h-3 w-3 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground">Mock</span>
              <Switch
                checked={isOnline}
                onCheckedChange={onToggleNetwork}
                aria-label="Toggle mock network"
              />
            </div>

            {/* Action buttons — md+ */}
            <div className="hidden items-center gap-1.5 md:flex">
              <NavButton
                onClick={onOfferHelp}
                icon={<BadgeCheck className="h-3.5 w-3.5 text-success" />}
                label="Offer Help"
                className="border-success/25 bg-success/[8%] hover:bg-success/15 text-foreground"
              />
              <NavButton
                onClick={onFindHelp}
                icon={<Search className="h-3.5 w-3.5 text-info" />}
                label="Find Help"
                className="border-info/25 bg-info/[8%] hover:bg-info/15 text-foreground"
              />
              {onTriage && (
                <NavButton
                  onClick={onTriage}
                  icon={<Brain className="h-3.5 w-3.5 text-warning" />}
                  label="AI Triage"
                  className="border-warning/25 bg-warning/[8%] hover:bg-warning/15 text-foreground"
                />
              )}
              <NavButton
                onClick={onShelter}
                icon={<Building2 className="h-3.5 w-3.5 text-info" />}
                label="Shelters"
                className="border-border bg-secondary/30 hover:bg-secondary text-foreground"
              />
            </div>

            {/* SOS — always visible */}
            <button
              onClick={onSos}
              className={cn(
                'relative flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3.5',
                'bg-alert text-white font-bold text-xs sm:text-sm',
                'shadow-lg shadow-alert/25 hover:bg-alert/90',
                'transition-all active:scale-95 animate-glow-pulse',
                'ring-2 ring-alert/20',
              )}
              aria-label="Request emergency aid"
            >
              <Siren className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Request Aid</span>
              <span className="sm:hidden">SOS</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                'border border-border bg-secondary/30 text-muted-foreground',
                'hover:bg-secondary hover:text-foreground active:scale-95 transition-all',
              )}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4 text-warning" />
                : <Moon className="h-4 w-4 text-info" />
              }
            </button>

            {/* Mobile menu */}
            <div className="md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl',
                      'border border-border bg-secondary/30',
                      'hover:bg-secondary transition-colors',
                    )}
                    aria-label="More navigation options"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-card border-border p-1.5 shadow-2xl rounded-xl"
                >
                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-2 py-1.5">
                    Quick Actions
                  </DropdownMenuLabel>
                  <MobileMenuItem
                    onClick={onOfferHelp}
                    icon={<BadgeCheck className="h-4 w-4 text-success" />}
                    label="Offer Help / Resources"
                  />
                  <MobileMenuItem
                    onClick={onFindHelp}
                    icon={<Search className="h-4 w-4 text-info" />}
                    label="Find Help Near You"
                  />
                  {onTriage && (
                    <MobileMenuItem
                      onClick={onTriage}
                      icon={<Brain className="h-4 w-4 text-warning" />}
                      label="AI Emergency Triage"
                    />
                  )}
                  <MobileMenuItem
                    onClick={onShelter}
                    icon={<Building2 className="h-4 w-4 text-info" />}
                    label="Shelter Portal"
                  />
                  <DropdownMenuSeparator className="my-1 bg-border" />
                  <MobileMenuItem
                    onClick={onToggleTheme}
                    icon={theme === 'dark'
                      ? <Sun className="h-4 w-4 text-warning" />
                      : <Moon className="h-4 w-4 text-info" />
                    }
                    label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  />
                  <DropdownMenuSeparator className="my-1 bg-border" />
                  {/* Network toggle inline */}
                  <div className="flex items-center justify-between rounded-md px-2 py-2 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Power className="h-3.5 w-3.5" />
                      <span className="font-medium">Mock Network</span>
                    </span>
                    <Switch
                      checked={isOnline}
                      onCheckedChange={onToggleNetwork}
                      aria-label="Toggle network mode"
                    />
                  </div>
                  {/* Mobile network status */}
                  <div className={cn(
                    'mx-2 mt-1 mb-0.5 flex items-center gap-1.5 rounded-lg px-2.5 py-2',
                    isOnline ? 'bg-success/10 border border-success/20' : 'bg-warning/10 border border-warning/20',
                  )}>
                    {isOnline
                      ? <Wifi className="h-3 w-3 text-success" />
                      : <WifiOff className="h-3 w-3 text-warning" />
                    }
                    <span className={cn('text-[11px] font-semibold', isOnline ? 'text-success' : 'text-warning')}>
                      {isOnline ? 'Online' : 'Offline — Local Data Active'}
                    </span>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}

/* ── Helpers ── */

function NavButton({
  onClick, icon, label, className,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold',
        'transition-all active:scale-95',
        className,
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileMenuItem({
  onClick, icon, label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex items-center gap-2.5 py-2 px-2 text-xs font-medium cursor-pointer rounded-lg focus:bg-secondary"
    >
      {icon}
      <span>{label}</span>
    </DropdownMenuItem>
  );
}
