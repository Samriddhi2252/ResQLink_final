import { useCallback, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveVolunteerProfile } from '@/lib/volunteer-profile';
import type {
  VolunteerGender,
  VolunteerRegistrationInput,
  VolunteerStatus,
} from '@/types';

interface VolunteerRow {
  id: string;
  full_name: string;
  gender: VolunteerGender;
  phone: string;
  email: string;
  latitude: number | null;
  longitude: number | null;
  location_permission: boolean;
  volunteer_status: VolunteerStatus;
  created_at: string;
}

/**
 * useVolunteers
 *
 * Registers a volunteer into the existing Supabase backend (`volunteers` table).
 * Mirrors the no-auth shared emergency board model used by `useVolunteerOffers`,
 * so volunteers can register without an account.
 *
 * Location is stored ONLY when the volunteer explicitly grants browser geolocation
 * permission during registration. It is never requested or tracked silently.
 */
export function useVolunteers() {
  const [registering, setRegistering] = useState(false);
  const [registered, setRegistered] = useState(false);

  const registerVolunteer = useCallback(async (input: VolunteerRegistrationInput) => {
    setRegistering(true);
    try {
      const profile = {
        fullName: input.fullName.trim(),
        gender: input.gender,
        phone: input.phone.trim(),
        email: input.email.trim().toLowerCase(),
        locationPermission: input.locationPermission,
        registeredAt: Date.now(),
      };

      if (!isSupabaseConfigured) {
        // Supabase env vars are not present — allow the app to keep working in a
        // demo/offline mode by marking the volunteer as registered locally.
        console.warn('Supabase is not configured; volunteer registration was not persisted.');
        saveVolunteerProfile(profile);
        setRegistered(true);
        return;
      }

      const { data, error: insertError } = await supabase
        .from('volunteers')
        .insert({
          full_name: input.fullName.trim(),
          gender: input.gender,
          phone: input.phone.trim(),
          email: input.email.trim().toLowerCase(),
          latitude: input.locationPermission ? input.latitude : null,
          longitude: input.locationPermission ? input.longitude : null,
          location_permission: input.locationPermission,
          volunteer_status: 'registered',
        })
        .select('id, full_name, gender, phone, email, latitude, longitude, location_permission, volunteer_status, created_at')
        .maybeSingle();

      if (insertError || !data) {
        console.error('volunteer registration failed', insertError);
        throw new Error('We could not complete your registration. Please try again.');
      }

      // Persist a local profile so returning volunteers are recognised and not
      // forced through registration again on subsequent help-confirm actions.
      saveVolunteerProfile(profile);
      setRegistered(true);
      return data as VolunteerRow;
    } finally {
      setRegistering(false);
    }
  }, []);

  const resetRegistration = useCallback(() => {
    setRegistered(false);
    setRegistering(false);
  }, []);

  return { registerVolunteer, registering, registered, resetRegistration };
}
