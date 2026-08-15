import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function openGoogleMapsDirections(destination: string) {
  if (!destination) return;
  const encoded = encodeURIComponent(destination);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

