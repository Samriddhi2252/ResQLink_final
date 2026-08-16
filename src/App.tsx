import { useState, useMemo } from 'react';
import { TopNav } from '@/components/top-nav';
import { StatusBanner } from '@/components/status-banner';
import { MapView } from '@/components/map-view';
import type { MapRegion } from '@/components/map-view';
import { LiveFeed } from '@/components/live-feed';
import { SosDrawer } from '@/components/sos-drawer';
import { ShelterWidget } from '@/components/shelter-widget';
import { FindHelpPanel } from '@/components/find-help-panel';
import { OfferHelpPanel } from '@/components/offer-help-panel';
import { MobileNav } from '@/components/mobile-nav';
import type { MobileTab } from '@/components/mobile-nav';
import { useNetwork, useOfflineQueue } from '@/hooks/use-network';
import { useVolunteerOffers } from '@/hooks/use-volunteer-offers';
import { MOCK_REQUESTS, MOCK_SHELTERS, MOCK_VOLUNTEERS, MOCK_RESOURCES } from '@/mockData';
import { Navigation } from 'lucide-react';
import type { FilterCategory } from '@/types';
import { cn, openGoogleMapsDirections } from '@/lib/utils';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

function App() {
  const { status, toggle, isOnline } = useNetwork();
  const { queue, enqueue, clearQueue, queueCount } = useOfflineQueue(isOnline);
  const { offers, loading: offersLoading, error: offersError, createOffer } = useVolunteerOffers();

  const [filter, setFilter] = useState<FilterCategory>('all');
  const [region, setRegion] = useState<MapRegion>('ncr');
  const [sosOpen, setSosOpen] = useState(false);
  const [shelterOpen, setShelterOpen] = useState(false);
  const [findHelpOpen, setFindHelpOpen] = useState(false);
  const [offerHelpOpen, setOfferHelpOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');

  const requests = useMemo(() => MOCK_REQUESTS, []);
  const shelters = useMemo(() => MOCK_SHELTERS, []);
  const volunteers = useMemo(() => MOCK_VOLUNTEERS, []);
  const resources = useMemo(() => MOCK_RESOURCES, []);

  const handleEnqueue = (req: Parameters<typeof enqueue>[0]) => {
    enqueue(req);
    if (!isOnline) {
      toast.success('Request queued offline', {
        description: 'It will auto-sync when you reconnect.',
      });
    } else {
      toast.success('SOS request submitted', {
        description: 'Nearby responders have been notified.',
      });
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id || null);
    if (id) setMobileTab('map');
  };

  const handleRegionChange = (r: MapRegion) => {
    setRegion(r);
    setSelectedId(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav
        status={status}
        onToggleNetwork={toggle}
        onSos={() => setSosOpen(true)}
        onShelter={() => setShelterOpen(true)}
        onFindHelp={() => setFindHelpOpen(true)}
        onOfferHelp={() => setOfferHelpOpen(true)}
      />

      <StatusBanner
        activeFilter={filter}
        onFilterChange={setFilter}
        requestCount={requests.length}
        region={region}
        onRegionChange={handleRegionChange}
      />

      {/* Main content */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-3 sm:px-6 sm:py-4">
        {/* Desktop: 2-column grid */}
        <div className="hidden gap-4 lg:grid lg:grid-cols-[1.4fr_1fr]">
          {/* Map */}
          <div className="h-[calc(100vh-210px)] min-h-[500px]">
            <MapView
              requests={requests}
              shelters={shelters}
              volunteers={volunteers}
              isOnline={isOnline}
              selectedId={selectedId}
              onSelect={handleSelect}
              region={region}
            />
          </div>

          {/* Feed */}
          <div className="h-[calc(100vh-210px)] min-h-[500px] overflow-hidden rounded-xl border border-border bg-card">
            <LiveFeed
              requests={requests}
              filter={filter}
              isOnline={isOnline}
              queue={queue}
              queueCount={queueCount}
              onClearQueue={clearQueue}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>
        </div>

        {/* Mobile & Tablet: tabbed view */}
        <div className="lg:hidden">
          {mobileTab === 'map' && (
            <div className="h-[calc(100dvh-250px)] min-h-[380px]">
              <MapView
                requests={requests}
                shelters={shelters}
                volunteers={volunteers}
                isOnline={isOnline}
                selectedId={selectedId}
                onSelect={handleSelect}
                region={region}
              />
            </div>
          )}
          {mobileTab === 'feed' && (
            <div className="h-[calc(100dvh-250px)] min-h-[380px] overflow-hidden rounded-xl border border-border bg-card">
              <LiveFeed
                requests={requests}
                filter={filter}
                isOnline={isOnline}
                queue={queue}
                queueCount={queueCount}
                onClearQueue={clearQueue}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
          )}
          {mobileTab === 'shelters' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-4">
              <div className="sm:col-span-2 rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="font-semibold">Regional Capacity</span>
                  <span className="font-bold text-success">
                    {shelters.reduce((s, sh) => s + sh.occupied, 0)}/
                    {shelters.reduce((s, sh) => s + sh.capacity, 0)}
                  </span>
                </div>
              </div>
              {shelters.map((s) => {
                const pct = Math.round((s.occupied / s.capacity) * 100);
                const isFull = s.status === 'full';
                return (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold leading-tight break-words">{s.name}</h3>
                        <p className="text-xs text-muted-foreground break-words">{s.address}</p>
                      </div>
                      <span className={cn('shrink-0 text-[10px] font-bold uppercase', isFull ? 'text-alert' : 'text-success')}>
                        {isFull ? 'FULL' : 'OPEN'}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{s.occupied}/{s.capacity} beds</span>
                      <span className={isFull ? 'text-alert' : 'text-success'}>{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${isFull ? 'bg-alert' : 'bg-success'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <button
                      onClick={() => openGoogleMapsDirections(`${s.name}, ${s.address}, Delhi NCR`)}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 py-2 text-xs font-bold transition-colors hover:bg-secondary active:scale-[0.99]"
                    >
                      <Navigation className="h-3.5 w-3.5 text-info" /> Get Directions
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Drawers / Modals */}
      <SosDrawer
        open={sosOpen}
        onOpenChange={setSosOpen}
        isOnline={isOnline}
        onEnqueue={handleEnqueue}
      />
      <ShelterWidget
        shelters={shelters}
        open={shelterOpen}
        onOpenChange={setShelterOpen}
      />
      <FindHelpPanel
        open={findHelpOpen}
        onOpenChange={setFindHelpOpen}
        resources={resources}
      />
      <OfferHelpPanel
        open={offerHelpOpen}
        onOpenChange={setOfferHelpOpen}
        offers={offers}
        loading={offersLoading}
        error={offersError}
        onCreate={async (input) => {
          await createOffer(input);
          toast.success('Help offer posted', {
            description: 'People nearby can now see what you have available.',
          });
        }}
      />

      {/* Mobile bottom nav */}
      <MobileNav
        active={mobileTab}
        onChange={setMobileTab}
        onSos={() => setSosOpen(true)}
      />

      {/* Mobile bottom spacer */}
      <div className="h-20 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden" />

      <Toaster />
    </div>
  );
}

export default App;
