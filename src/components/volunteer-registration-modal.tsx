import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Loader2,
  CheckCircle2,
  MapPin,
  LocateFixed,
  MapPinOff,
  User,
  Mail,
  Phone,
  X,
  ShieldCheck,
  Send,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useModalBack } from '@/hooks/use-modal-back';
import { useVolunteers } from '@/hooks/use-volunteers';
import type { VolunteerGender } from '@/types';

/**
 * VolunteerRegistrationModal
 *
 * The single, shared volunteer registration popup used everywhere a user offers
 * to help in ResQLink — the top-level "Offer Help" action and every
 * "I Can Help" → "Confirm Help" flow. Hosts control it via `open`/`onOpenChange`
 * and receive `onComplete` once a volunteer finishes registering, so they can
 * proceed with the original help-confirmation action.
 */
interface VolunteerRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires when a volunteer finishes registration (Done). Lets the host complete the original action. */
  onComplete?: () => void;
}

const GENDER_OPTIONS: { value: VolunteerGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const PHONE_RE = /^[+]?[\d][\d\s() -]{4,18}[\d]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type LocationState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface FieldErrors {
  fullName?: string;
  gender?: string;
  phone?: string;
  email?: string;
}

export function VolunteerRegistrationModal({ open, onOpenChange, onComplete }: VolunteerRegistrationModalProps) {
  useModalBack(open, () => onOpenChange(false));

  const { registerVolunteer, registering, registered, resetRegistration } = useVolunteers();

  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<VolunteerGender | ''>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(fullName.trim() && gender && phone.trim() && email.trim()),
    [fullName, gender, phone, email]
  );

  // ── Reset success + form state once the modal has finished closing so the
  //    next open (from any help-confirm flow) starts on a fresh form. The short
  //    delay lets the close animation play out without flickering the success view.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      resetRegistration();
      setFullName('');
      setGender('');
      setPhone('');
      setEmail('');
      setCoords(null);
      setLocationPermission(false);
      setLocationState('idle');
      setErrors({});
      setSubmitError(null);
      setTriedSubmit(false);
    }, 250);
    return () => clearTimeout(t);
  }, [open, resetRegistration]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.fullName = 'Please enter your full name.';
    if (!gender) next.gender = 'Please select a gender.';
    if (!phone.trim()) next.phone = 'A phone number is required for coordination.';
    else if (!PHONE_RE.test(phone.trim())) next.phone = 'Enter a valid phone number.';
    if (!email.trim()) next.email = 'An email address is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    return next;
  };

  // ── Explicit, permission-based geolocation (one-shot, never continuous) ──
  const handleAllowLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationState('unsupported');
      return;
    }
    setLocationState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationPermission(true);
        setLocationState('granted');
      },
      () => {
        // Permission denied or unavailable — user may still continue without location.
        setCoords(null);
        setLocationPermission(false);
        setLocationState('denied');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registering) return;
    setTriedSubmit(true);
    const nextErrors = validate();
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      await registerVolunteer({
        fullName: fullName.trim(),
        gender: gender as VolunteerGender,
        phone: phone.trim(),
        email: email.trim(),
        latitude: locationPermission && coords ? coords.lat : null,
        longitude: locationPermission && coords ? coords.lng : null,
        locationPermission,
      });
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Registration failed. Please try again.');
    }
  };

  // Completing registration closes this modal and notifies the host so it can
  // finish the original "Confirm Help" action. Closing without registration keeps
  // the host popup untouched so the user can retry — nothing is confirmed yet.
  const handleDone = () => {
    onOpenChange(false);
    onComplete?.();
  };

  const showFieldError = (field: keyof FieldErrors) => triedSubmit && errors[field];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* ── Header ── */}
        <div className="flex items-center gap-2.5 border-b border-border bg-card/95 px-4 py-3.5 backdrop-blur-xl sm:px-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/15 ring-1 ring-success/30">
            <BadgeCheck className="h-4 w-4 text-success" />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <DialogTitle className="text-base font-bold">Become a Volunteer</DialogTitle>
            <DialogDescription className="text-xs">
              Thank you for being willing to help. Please provide a few basic details so we can coordinate assistance safely.
            </DialogDescription>
          </div>
        </div>

        {registered ? (
          <SuccessView onDone={handleDone} fullName={fullName} sharedLocation={locationPermission} />
        ) : (
          <ScrollArea className="max-h-[calc(90dvh-92px)]">
            <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4 sm:px-5">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="vol-fullname" className="text-xs font-medium sm:text-sm">
                  Full Name <span className="text-alert">*</span>
                </Label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="vol-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    autoComplete="name"
                    className={cn(
                      'h-10 border-border bg-secondary/30 pl-9 text-xs sm:text-sm',
                      showFieldError('fullName') && 'border-alert/50 ring-1 ring-alert/20'
                    )}
                  />
                </div>
                {showFieldError('fullName') && <p className="text-xs text-alert">{errors.fullName}</p>}
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium sm:text-sm">
                  Gender <span className="text-alert">*</span>
                </Label>
                <Select
                  value={gender}
                  onValueChange={(value) => setGender(value as VolunteerGender)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-10 border-border bg-secondary/30 text-xs sm:text-sm',
                      showFieldError('gender') && 'border-alert/50 ring-1 ring-alert/20'
                    )}
                  >
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="text-xs sm:text-sm">{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {showFieldError('gender') && <p className="text-xs text-alert">{errors.gender}</p>}
              </div>

              {/* Phone + Email grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="vol-phone" className="text-xs font-medium sm:text-sm">
                    Phone Number <span className="text-alert">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="vol-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98100 00112"
                      autoComplete="tel"
                      className={cn(
                        'h-10 border-border bg-secondary/30 pl-9 text-xs sm:text-sm',
                        showFieldError('phone') && 'border-alert/50 ring-1 ring-alert/20'
                      )}
                    />
                  </div>
                  {showFieldError('phone') && <p className="text-xs text-alert">{errors.phone}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="vol-email" className="text-xs font-medium sm:text-sm">
                    Email Address <span className="text-alert">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="vol-email"
                      type="email"
                      inputMode="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className={cn(
                        'h-10 border-border bg-secondary/30 pl-9 text-xs sm:text-sm',
                        showFieldError('email') && 'border-alert/50 ring-1 ring-alert/20'
                      )}
                    />
                  </div>
                  {showFieldError('email') && <p className="text-xs text-alert">{errors.email}</p>}
                </div>
              </div>

              {/* Location permission section */}
              <div className="rounded-xl border border-info/25 bg-info/[0.05] p-3.5">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      Allow access to your current location for volunteer safety and coordination.
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      We ask only once, right now, with your explicit permission. We never silently track you and do not continuously monitor your location.
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAllowLocation}
                    disabled={locationState === 'requesting' || locationState === 'granted'}
                    className="border-info/30 bg-info/10 text-info hover:bg-info/20"
                  >
                    {locationState === 'requesting' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : locationState === 'granted' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <LocateFixed className="h-3.5 w-3.5" />
                    )}
                    {locationState === 'requesting'
                      ? 'Locating…'
                      : locationState === 'granted'
                      ? 'Location shared'
                      : 'Allow Location Access'}
                  </Button>

                  {locationState === 'granted' && coords && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-success">
                      <MapPin className="h-3 w-3" />
                      {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                    </span>
                  )}
                  {locationState === 'denied' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-warning">
                      <MapPinOff className="h-3 w-3" />
                      Location sharing unavailable — you can still register.
                    </span>
                  )}
                  {locationState === 'unsupported' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <MapPinOff className="h-3 w-3" />
                      Geolocation not supported on this device.
                    </span>
                  )}
                </div>
              </div>

              {/* Submit / error states */}
              {submitError && (
                <p className="rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-xs font-medium text-alert">
                  {submitError}
                </p>
              )}

              <div className="space-y-2 pt-1">
                <Button
                  type="submit"
                  disabled={!canSubmit || registering}
                  className="h-11 w-full bg-success font-bold text-white hover:bg-success/90"
                >
                  {registering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Register as Volunteer
                    </>
                  )}
                </Button>
                <p className="text-center text-[10px] text-muted-foreground">
                  Fields marked <span className="text-alert">*</span> are required. Your details are kept private and used only for emergency coordination.
                </p>
              </div>
            </form>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Success confirmation view ── */
function SuccessView({
  onDone,
  fullName,
  sharedLocation,
}: {
  onDone: () => void;
  fullName: string;
  sharedLocation: boolean;
}) {
  return (
    <div className="px-4 py-8 text-center sm:px-6">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 ring-1 ring-success/30">
        <CheckCircle2 className="h-7 w-7 text-success" />
      </div>
      <h3 className="mt-4 text-base font-bold text-foreground">
        You’re now registered as a volunteer{fullName ? `, ${fullName.split(' ')[0]}` : ''}!
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Thank you for helping during emergencies. We’ll use your details to coordinate assistance and keep you informed.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 font-semibold text-success">
          <BadgeCheck className="h-3 w-3" /> Status: Registered
        </span>
        {sharedLocation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2.5 py-1 font-semibold text-info">
            <MapPin className="h-3 w-3" /> Location shared
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-semibold text-muted-foreground">
            <MapPinOff className="h-3 w-3" /> Location not shared
          </span>
        )}
      </div>
      <Button onClick={onDone} className="mt-6 h-11 w-full bg-success font-bold text-white hover:bg-success/90 sm:w-auto sm:px-10">
        <X className="h-4 w-4" />
        Done
      </Button>
    </div>
  );
}
