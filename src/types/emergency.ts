export type EmergencyConfirmation = 'call-112' | 'call-trusted-contact' | 'siren' | null;

export type EmergencyLocationStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export interface EmergencyPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
}

export type EmergencyShareStatus = 'idle' | 'shared' | 'copied' | 'copy-failed';
