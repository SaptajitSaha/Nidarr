import { useCallback, useEffect, useRef, useState } from 'react';
import type { EmergencyLocationStatus, EmergencyPosition } from '../types/emergency';

const toEmergencyPosition = (position: GeolocationPosition): EmergencyPosition => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 0,
  capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
});

const statusForError = (error: GeolocationPositionError): EmergencyLocationStatus => {
  if (error.code === error.PERMISSION_DENIED) return 'denied';
  if (error.code === error.TIMEOUT) return 'timeout';
  return 'unavailable';
};

const messageForStatus = (status: EmergencyLocationStatus) => {
  switch (status) {
    case 'denied': return 'Location access was denied. Foreground location tracking did not start.';
    case 'timeout': return 'Location timed out. You can try foreground location tracking again.';
    case 'unsupported': return 'Foreground location tracking is not supported in this browser.';
    default: return 'Location is unavailable. You can try foreground location tracking again.';
  }
};

export interface EmergencyLocationController {
  status: EmergencyLocationStatus;
  latestPosition: EmergencyPosition | null;
  error: string | null;
  isTracking: boolean;
  startLocation: () => void;
  stopLocation: (clearLatest?: boolean) => void;
  clearError: () => void;
}

export function useEmergencyLocation(): EmergencyLocationController {
  const [status, setStatus] = useState<EmergencyLocationStatus>('idle');
  const [latestPosition, setLatestPosition] = useState<EmergencyPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watcherRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  const clearWatcher = useCallback(() => {
    const watcherId = watcherRef.current;
    watcherRef.current = null;
    startingRef.current = false;
    if (watcherId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watcherId);
  }, []);

  const stopLocation = useCallback((clearLatest = false) => {
    clearWatcher();
    setStatus('idle');
    setError(null);
    if (clearLatest) setLatestPosition(null);
  }, [clearWatcher]);

  const startLocation = useCallback(() => {
    if (watcherRef.current !== null || startingRef.current) return;
    setError(null);

    if (!navigator.geolocation) {
      setStatus('unsupported');
      setError(messageForStatus('unsupported'));
      return;
    }

    startingRef.current = true;
    setStatus('requesting');
    try {
      let failedSynchronously = false;
      const watcherId = navigator.geolocation.watchPosition(
        (position) => {
          startingRef.current = false;
          setLatestPosition(toEmergencyPosition(position));
          setStatus('active');
          setError(null);
        },
        (geolocationError) => {
          if (watcherRef.current === null) failedSynchronously = true;
          const errorStatus = statusForError(geolocationError);
          clearWatcher();
          setStatus(errorStatus);
          setError(messageForStatus(errorStatus));
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
      if (failedSynchronously) navigator.geolocation.clearWatch(watcherId);
      else watcherRef.current = watcherId;
    } catch {
      clearWatcher();
      setStatus('unavailable');
      setError(messageForStatus('unavailable'));
    }
  }, [clearWatcher]);

  useEffect(() => clearWatcher, [clearWatcher]);

  return {
    status,
    latestPosition,
    error,
    isTracking: status === 'requesting' || status === 'active',
    startLocation,
    stopLocation,
    clearError: () => setError(null),
  };
}
