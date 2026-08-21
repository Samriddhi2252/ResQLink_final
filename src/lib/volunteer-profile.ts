/**
 * volunteer-profile
 *
 * Lightweight local store for a volunteer's registration profile.
 *
 * The ResQLink board is a shared, no-auth emergency coordination tool, so we
 * recognise a returning volunteer by a profile persisted in localStorage after
 * their first successful registration. This lets every help/confirm flow skip a
 * redundant second registration while still completing the original action.
 *
 * This is a local convenience only — it never silently tracks location and only
 * exists because the volunteer explicitly completed registration before.
 */

const VOLUNTEER_PROFILE_KEY = 'resqlink-volunteer-profile-v1';

export interface VolunteerProfile {
  fullName: string;
  gender: string;
  phone: string;
  email: string;
  locationPermission: boolean;
  registeredAt: number;
}

export function getVolunteerProfile(): VolunteerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(VOLUNTEER_PROFILE_KEY);
    return saved ? (JSON.parse(saved) as VolunteerProfile) : null;
  } catch {
    return null;
  }
}

export function saveVolunteerProfile(profile: VolunteerProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOLUNTEER_PROFILE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to persist volunteer profile', e);
  }
}

export function hasVolunteerProfile(): boolean {
  return getVolunteerProfile() !== null;
}

export function clearVolunteerProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(VOLUNTEER_PROFILE_KEY);
  } catch (e) {
    console.error('Failed to clear volunteer profile', e);
  }
}
