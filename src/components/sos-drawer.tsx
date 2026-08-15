import { useState } from 'react';
import {
  Siren,
  HeartPulse,
  Droplets,
  BedDouble,
  Users,
  LifeBuoy,
  MapPin,
  LocateFixed,
  CloudOff,
  Send,
  Loader2,
  CheckCircle2,
  Mic,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { NetworkStatus, QueuedRequest } from '@/hooks/use-network';
import { useVoiceInput } from '@/hooks/use-voice-input';
import { VoiceMicButton } from '@/components/voice-mic-button';

interface SosDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOnline: boolean;
  onEnqueue: (req: QueuedRequest) => void;
}

const CATEGORIES = [
  { value: 'medical', label: 'Medical Aid', icon: HeartPulse },
  { value: 'food', label: 'Food & Water', icon: Droplets },
  { value: 'shelter', label: 'Shelter Beds', icon: BedDouble },
  { value: 'volunteers', label: 'Volunteers Needed', icon: Users },
  { value: 'rescue', label: 'Rescue', icon: LifeBuoy },
];

export function SosDrawer({ open, onOpenChange, isOnline, onEnqueue }: SosDrawerProps) {
  const [category, setCategory] = useState('');
  const [details, setDetails] = useState('');
  const [items, setItems] = useState('');
  const [contact, setContact] = useState('');
  const [coords, setCoords] = useState('');
  const [locating, setLocating] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const voice = useVoiceInput();

  const handleVoice = (field: 'details' | 'items' | 'contact') => {
    if (voice.listening) {
      voice.stop();
      setVoiceActive(false);
      return;
    }
    setVoiceActive(true);
    const setters = { details: setDetails, items: setItems, contact: setContact };
    const current = { details, items, contact };
    voice.start((text) => {
      setters[field](text || current[field]);
    });
  };

  const reset = () => {
    setCategory('');
    setDetails('');
    setItems('');
    setContact('');
    setCoords('');
    setSubmitted(false);
  };

  const handleLocate = () => {
    setLocating(true);
    setTimeout(() => {
      const lat = (Math.random() * 0.02 + 30.27).toFixed(5);
      const lng = (Math.random() * 0.02 - 97.74).toFixed(5);
      setCoords(`${lat}, ${lng}`);
      setLocating(false);
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const req: QueuedRequest = {
      id: `local-${Date.now()}`,
      category: category || 'general',
      details,
      items,
      contact,
      coords,
      createdAt: Date.now(),
    };
    onEnqueue(req);
    setSubmitted(true);
    setTimeout(() => {
      onOpenChange(false);
      reset();
    }, 1600);
  };

  const canSubmit = category && details.trim();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-md"
      >
        <div className="sticky top-0 z-10 border-b border-border bg-card/95 px-6 py-4 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-alert/15 ring-1 ring-alert/30">
              <Siren className="h-5 w-5 text-alert" />
            </div>
            <div>
              <SheetTitle className="text-lg font-bold">Request Aid (SOS)</SheetTitle>
              <SheetDescription className="text-xs">
                {isOnline ? 'Submitting live to response network' : 'Offline — will queue and sync automatically'}
              </SheetDescription>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15 ring-1 ring-success/30">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Request {isOnline ? 'Submitted' : 'Queued'}</h3>
            <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">
              {isOnline
                ? 'Your request is now visible to nearby responders and volunteers.'
                : 'Saved locally. It will be sent automatically once you reconnect.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
            {/* Category */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Need Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-11 border-border bg-secondary/30">
                  <SelectValue placeholder="Select what you need" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => {
                    const Icon = c.icon;
                    return (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {c.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Situation Details
                </Label>
                <VoiceMicButton
                  listening={voice.listening && voiceActive}
                  supported={voice.supported}
                  onStart={() => handleVoice('details')}
                  onStop={() => { voice.stop(); setVoiceActive(false); }}
                  size="sm"
                />
              </div>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the situation — who needs help, what's happening, urgency level..."
                className={cn('min-h-[90px] resize-none border-border bg-secondary/30', voice.listening && voiceActive && 'border-alert/40 ring-1 ring-alert/20')}
              />
              {voice.listening && voiceActive && (
                <p className="-mt-1 flex items-center gap-1 text-[11px] font-medium text-alert">
                  <Mic className="h-3 w-3 animate-pulse" /> Listening… speak now
                </p>
              )}
            </div>

            {/* Items needed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Specific Items Needed
                </Label>
                <VoiceMicButton
                  listening={voice.listening && voiceActive}
                  supported={voice.supported}
                  onStart={() => handleVoice('items')}
                  onStop={() => { voice.stop(); setVoiceActive(false); }}
                  size="sm"
                />
              </div>
              <Input
                value={items}
                onChange={(e) => setItems(e.target.value)}
                placeholder="e.g. Insulin, bottled water, baby formula..."
                className="border-border bg-secondary/30"
              />
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Contact Information
                </Label>
                <VoiceMicButton
                  listening={voice.listening && voiceActive}
                  supported={voice.supported}
                  onStart={() => handleVoice('contact')}
                  onStop={() => { voice.stop(); setVoiceActive(false); }}
                  size="sm"
                />
              </div>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Name and phone number"
                className="border-border bg-secondary/30"
              />
            </div>

            {/* GPS */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                GPS Coordinates
              </Label>
              <div className="flex gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-md border border-border bg-secondary/30 px-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className={cn('text-sm', coords ? 'text-foreground' : 'text-muted-foreground')}>
                    {coords || 'Not detected'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLocate}
                  disabled={locating}
                  className="border-border bg-secondary/40"
                >
                  {locating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LocateFixed className="h-4 w-4 text-info" />
                  )}
                  <span className="ml-1.5 text-xs font-semibold">Detect</span>
                </Button>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={!canSubmit}
                className={cn(
                  'h-12 w-full text-sm font-bold shadow-lg',
                  isOnline
                    ? 'bg-alert text-white shadow-alert/20 hover:bg-alert/90'
                    : 'bg-warning text-white shadow-warning/20 hover:bg-warning/90'
                )}
              >
                {isOnline ? (
                  <>
                    <Send className="h-4 w-4" /> Submit SOS Request
                  </>
                ) : (
                  <>
                    <CloudOff className="h-4 w-4" /> Submit Offline (Queue)
                  </>
                )}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {isOnline
                  ? 'Your request will be broadcast to responders immediately.'
                  : 'Request saved to device. Auto-syncs when network is restored.'}
              </p>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
