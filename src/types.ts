export type RequestCategory =
  | 'medical'
  | 'food'
  | 'shelter'
  | 'volunteers'
  | 'rescue';

export type RequestPriority = 'critical' | 'urgent' | 'moderate';

export type RequestStatus = 'active' | 'in-progress' | 'fulfilled' | 'queued';

export interface AidRequest {
  id: string;
  category: RequestCategory;
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  details: string;
  items: string[];
  contactName: string;
  contactPhone: string;
  distanceMiles: number;
  createdAt: number;
  coords: { x: number; y: number };
  peopleCount: number;
  isUserCreated?: boolean;
  region?: string;
  triage?: {
    priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    incidentType: string;
    people: number | null;
    vulnerable?: { elderly: number; children: number; pregnant: number; disabled: number; injured: number };
    dangerIndicators?: string[];
    priorityReasons?: string[];
    requiredResources?: string[];
    rawMessage?: string;
    parsedBy?: 'gemini' | 'fallback';
  };
}

export interface Shelter {
  id: string;
  name: string;
  address: string;
  capacity: number;
  occupied: number;
  coords: { x: number; y: number };
  amenities: string[];
  status: 'open' | 'full' | 'closing';
}

export interface Volunteer {
  id: string;
  name: string;
  skills: string[];
  coords: { x: number; y: number };
  distanceMiles: number;
  available: boolean;
}

export type ResourceType = 'hospital' | 'pharmacy' | 'food' | 'shelter' | 'rescue';

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  address: string;
  distanceMiles: number;
  coords: { x: number; y: number };
  open24h: boolean;
  phone: string;
  tags: string[];
  status: 'open' | 'limited' | 'closed';
  bedsAvailable?: number;
}

export type VolunteerOfferCategory = 'medical' | 'food' | 'water' | 'shelter' | 'transport' | 'rescue' | 'other';

export interface VolunteerOffer {
  id: string;
  category: VolunteerOfferCategory;
  title: string;
  details: string;
  quantity: string;
  contactName: string;
  contactPhone: string;
  location: string;
  photoPath: string | null;
  photoUrl: string | null;
  status: 'available' | 'limited' | 'fulfilled';
  createdAt: number;
}

export type FilterCategory = 'all' | RequestCategory;

export const CATEGORY_META: Record<
  RequestCategory,
  { label: string; icon: string; color: string; bg: string; text: string; border: string }
> = {
  medical: {
    label: 'Medical Aid',
    icon: 'HeartPulse',
    color: 'alert',
    bg: 'bg-alert/15',
    text: 'text-alert',
    border: 'border-alert/30',
  },
  food: {
    label: 'Food & Water',
    icon: 'Droplets',
    color: 'warning',
    bg: 'bg-warning/15',
    text: 'text-warning',
    border: 'border-warning/30',
  },
  shelter: {
    label: 'Shelter Beds',
    icon: 'BedDouble',
    color: 'info',
    bg: 'bg-info/15',
    text: 'text-info',
    border: 'border-info/30',
  },
  volunteers: {
    label: 'Volunteers Needed',
    icon: 'Users',
    color: 'success',
    bg: 'bg-success/15',
    text: 'text-success',
    border: 'border-success/30',
  },
  rescue: {
    label: 'Rescue',
    icon: 'LifeBuoy',
    color: 'alert',
    bg: 'bg-alert/15',
    text: 'text-alert',
    border: 'border-alert/30',
  },
};

export const PRIORITY_META: Record<
  RequestPriority,
  { label: string; color: string; bg: string; text: string }
> = {
  critical: { label: 'Critical', color: 'alert', bg: 'bg-alert', text: 'text-white' },
  urgent: { label: 'Urgent', color: 'warning', bg: 'bg-warning', text: 'text-white' },
  moderate: { label: 'Moderate', color: 'success', bg: 'bg-success', text: 'text-white' },
};

export const FILTER_TABS: { id: FilterCategory; label: string }[] = [
  { id: 'all', label: 'All Requests' },
  { id: 'medical', label: 'Medical Aid' },
  { id: 'food', label: 'Food & Water' },
  { id: 'shelter', label: 'Shelter Beds' },
  { id: 'volunteers', label: 'Volunteers Needed' },
];
