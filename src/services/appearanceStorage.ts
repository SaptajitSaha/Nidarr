import { APPEARANCE_PREFERENCES } from '../types/appearance';
import type { AppearancePreference, ResolvedAppearance } from '../types/appearance';

export const APPEARANCE_STORAGE_KEY = 'nidarr_appearance_v1';
export const DARK_APPEARANCE_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export function isAppearancePreference(value: unknown): value is AppearancePreference {
  return typeof value === 'string' && APPEARANCE_PREFERENCES.includes(value as AppearancePreference);
}

const removeMalformedAppearance = () => {
  try {
    window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
  } catch {
    // Malformed preference cleanup is best-effort.
  }
};

export function loadAppearancePreference(): AppearancePreference {
  if (typeof window === 'undefined') return 'system';

  try {
    const storedValue = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (storedValue === null) return 'system';
    if (isAppearancePreference(storedValue)) return storedValue;
    removeMalformedAppearance();
    return 'system';
  } catch {
    return 'system';
  }
}

export function saveAppearancePreference(preference: AppearancePreference): void {
  if (!isAppearancePreference(preference)) {
    throw new Error('The selected appearance is invalid and was not saved.');
  }
  if (typeof window === 'undefined') {
    throw new Error('Local storage is unavailable. Your appearance preference was not saved.');
  }

  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  } catch {
    throw new Error('Local storage is unavailable. Your appearance preference was not saved.');
  }
}

export function getSystemDarkAppearance(): boolean {
  return typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia(DARK_APPEARANCE_MEDIA_QUERY).matches;
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemIsDark = getSystemDarkAppearance()
): ResolvedAppearance {
  if (preference === 'system') return systemIsDark ? 'dark' : 'light';
  return preference;
}

export function applyResolvedAppearance(appearance: ResolvedAppearance): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = appearance;
}

export function initializeAppearance(): AppearancePreference {
  const preference = loadAppearancePreference();
  applyResolvedAppearance(resolveAppearance(preference));
  return preference;
}
