export type WalkSessionStatus =
  | 'SETUP'
  | 'ACTIVE'
  | 'CHECK_IN_REQUIRED'
  | 'HELP_REQUESTED'
  | 'COMPLETED_SAFE'
  | 'ENDED';

export type PersistedWalkSessionStatus = Exclude<WalkSessionStatus, 'SETUP'>;

export type WalkLocationAvailability =
  | 'idle'
  | 'requesting'
  | 'available'
  | 'denied'
  | 'unavailable'
  | 'unsupported';

export interface WalkCoordinates {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

export interface WalkTrustedContact {
  name: string;
  phone?: string;
}

export interface WalkSession {
  id: string;
  destination: string;
  startedAt: string;
  expectedArrivalAt: string;
  trustedContact: WalkTrustedContact;
  status: PersistedWalkSessionStatus;
  startingCoordinates?: WalkCoordinates;
  latestCoordinates?: WalkCoordinates;
  completedAt?: string;
}

export interface StartWalkSessionInput {
  destination: string;
  durationMinutes: number;
  trustedContact: WalkTrustedContact;
}
