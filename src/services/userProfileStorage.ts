import { USER_PROFILE_FIELD_LIMITS } from '../types/userProfile';
import type { UserProfile } from '../types/userProfile';

export const USER_PROFILE_STORAGE_KEY = 'nidarr_user_profile_v1';

const PROFILE_FIELDS: (keyof UserProfile)[] = [
  'displayName',
  'trustedContactName',
  'trustedContactPhone',
  'homeArea',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isBoundedString = (value: unknown, maximumLength: number): value is string =>
  typeof value === 'string' && value.length <= maximumLength;

export function isUserProfile(value: unknown): value is UserProfile {
  if (!isRecord(value)) return false;

  const keys = Object.keys(value);
  return (
    keys.length === PROFILE_FIELDS.length &&
    PROFILE_FIELDS.every((field) => Object.hasOwn(value, field)) &&
    isBoundedString(value.displayName, USER_PROFILE_FIELD_LIMITS.displayName) &&
    isBoundedString(value.trustedContactName, USER_PROFILE_FIELD_LIMITS.trustedContactName) &&
    isBoundedString(value.trustedContactPhone, USER_PROFILE_FIELD_LIMITS.trustedContactPhone) &&
    isBoundedString(value.homeArea, USER_PROFILE_FIELD_LIMITS.homeArea)
  );
}

const normalizeUserProfile = (profile: UserProfile): UserProfile => ({
  displayName: profile.displayName.trim(),
  trustedContactName: profile.trustedContactName.trim(),
  trustedContactPhone: profile.trustedContactPhone.trim(),
  homeArea: profile.homeArea.trim(),
});

export function clearUserProfile(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  } catch {
    // Storage cleanup is best-effort for this local-only prototype.
  }
}

export function loadUserProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedValue = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
    if (!storedValue) return null;

    const parsed: unknown = JSON.parse(storedValue);
    if (!isUserProfile(parsed)) {
      clearUserProfile();
      return null;
    }

    return parsed;
  } catch {
    clearUserProfile();
    return null;
  }
}

export function saveUserProfile(profile: UserProfile): UserProfile {
  if (typeof window === 'undefined') {
    throw new Error('Local storage is unavailable. Your profile was not saved.');
  }

  const normalizedProfile = normalizeUserProfile(profile);
  if (!isUserProfile(normalizedProfile)) {
    throw new Error('The profile contains invalid details and was not saved.');
  }

  try {
    window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
    return normalizedProfile;
  } catch {
    throw new Error('Local storage is unavailable. Your profile was not saved. Keep this page open and try again.');
  }
}
