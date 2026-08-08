import type {
  PersistedWalkSessionStatus,
  WalkCoordinates,
  WalkSession,
  WalkTrustedContact,
} from '../types/walkSession';

export const WALK_SESSION_STORAGE_KEY = 'nidarr_walk_session_v1';

const VALID_STATUSES: PersistedWalkSessionStatus[] = [
  'ACTIVE',
  'CHECK_IN_REQUIRED',
  'HELP_REQUESTED',
  'COMPLETED_SAFE',
  'ENDED',
];

const TERMINAL_STATUSES: PersistedWalkSessionStatus[] = ['COMPLETED_SAFE', 'ENDED'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));

const isCoordinates = (value: unknown): value is WalkCoordinates => {
  if (!isRecord(value)) return false;
  return (
    typeof value.latitude === 'number' &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === 'number' &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180 &&
    isTimestamp(value.capturedAt)
  );
};

const isTrustedContact = (value: unknown): value is WalkTrustedContact => {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  return value.phone === undefined || typeof value.phone === 'string';
};

export function isWalkSession(value: unknown): value is WalkSession {
  if (!isRecord(value)) return false;

  const startedAt = isTimestamp(value.startedAt) ? Date.parse(value.startedAt) : Number.NaN;
  const expectedArrivalAt = isTimestamp(value.expectedArrivalAt)
    ? Date.parse(value.expectedArrivalAt)
    : Number.NaN;

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.destination === 'string' &&
    value.destination.trim().length > 0 &&
    Number.isFinite(startedAt) &&
    Number.isFinite(expectedArrivalAt) &&
    expectedArrivalAt >= startedAt &&
    typeof value.status === 'string' &&
    VALID_STATUSES.includes(value.status as PersistedWalkSessionStatus) &&
    isTrustedContact(value.trustedContact) &&
    (value.startingCoordinates === undefined || isCoordinates(value.startingCoordinates)) &&
    (value.latestCoordinates === undefined || isCoordinates(value.latestCoordinates)) &&
    (value.completedAt === undefined || isTimestamp(value.completedAt))
  );
}

export function createWalkSessionId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `walk-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clearStoredWalkSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(WALK_SESSION_STORAGE_KEY);
  } catch {
    // Storage cleanup is best-effort for this local-only prototype.
  }
}

export function loadWalkSession(): WalkSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const storedValue = window.localStorage.getItem(WALK_SESSION_STORAGE_KEY);
    if (!storedValue) return null;
    const parsed: unknown = JSON.parse(storedValue);
    if (!isWalkSession(parsed) || TERMINAL_STATUSES.includes(parsed.status)) {
      clearStoredWalkSession();
      return null;
    }
    return parsed;
  } catch {
    clearStoredWalkSession();
    return null;
  }
}

export function saveWalkSession(session: WalkSession): boolean {
  if (TERMINAL_STATUSES.includes(session.status)) {
    clearStoredWalkSession();
    return true;
  }
  if (!isWalkSession(session) || typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(WALK_SESSION_STORAGE_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}
