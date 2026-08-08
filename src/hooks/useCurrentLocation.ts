import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLngTuple } from 'leaflet';

export type CurrentLocationStatus =
  | 'requesting'
  | 'available'
  | 'denied'
  | 'unavailable'
  | 'unsupported';

export interface CurrentLocationState {
  position: LatLngTuple | null;
  status: CurrentLocationStatus;
  rememberPosition: (position: LatLngTuple) => void;
}

export function useCurrentLocation(): CurrentLocationState {
  const [position, setPosition] = useState<LatLngTuple | null>(null);
  const [status, setStatus] = useState<CurrentLocationStatus>('requesting');
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;

    if (!navigator.geolocation) {
      setStatus('unsupported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition([result.coords.latitude, result.coords.longitude]);
        setStatus('available');
      },
      (error) => {
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    );
  }, []);

  const rememberPosition = useCallback((nextPosition: LatLngTuple) => {
    setPosition(nextPosition);
    setStatus('available');
  }, []);

  return { position, status, rememberPosition };
}
