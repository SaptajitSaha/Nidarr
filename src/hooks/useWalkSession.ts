import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearStoredWalkSession,
  createWalkSessionId,
  loadWalkSession,
  saveWalkSession,
} from '../services/walkSessionStorage';
import type {
  StartWalkSessionInput,
  WalkCoordinates,
  WalkLocationAvailability,
  WalkSession,
  WalkSessionStatus,
} from '../types/walkSession';

const LIVE_STATUSES: WalkSessionStatus[] = ['ACTIVE', 'CHECK_IN_REQUIRED', 'HELP_REQUESTED'];

const toCoordinates = (position: GeolocationPosition): WalkCoordinates => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
});

export interface WalkSessionController {
  session: WalkSession | null;
  status: WalkSessionStatus;
  locationAvailability: WalkLocationAvailability;
  remainingMs: number;
  isStarting: boolean;
  isActiveOnMap: boolean;
  startSession: (input: StartWalkSessionInput) => Promise<void>;
  markSafe: () => void;
  requestHelp: () => void;
  endSession: () => void;
  triggerDemoCheckIn: () => void;
  resetSession: () => void;
}

export function useWalkSession(): WalkSessionController {
  const [session, setSession] = useState<WalkSession | null>(() => loadWalkSession());
  const [locationAvailability, setLocationAvailability] = useState<WalkLocationAvailability>(() => {
    const restored = loadWalkSession();
    return restored?.latestCoordinates || restored?.startingCoordinates ? 'available' : 'idle';
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isStarting, setIsStarting] = useState(false);
  const watcherRef = useRef<number | null>(null);
  const startingRef = useRef(false);

  const stopLocationWatcher = useCallback(() => {
    const watcherId = watcherRef.current;
    watcherRef.current = null;
    if (watcherId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watcherId);
    }
  }, []);

  const updateSession = useCallback((updater: (current: WalkSession) => WalkSession) => {
    setSession((current) => {
      if (!current) return current;
      const next = updater(current);
      saveWalkSession(next);
      return next;
    });
  }, []);

  const updateLatestCoordinates = useCallback((position: GeolocationPosition) => {
    const coordinates = toCoordinates(position);
    setLocationAvailability('available');
    updateSession((current) => ({ ...current, latestCoordinates: coordinates }));
  }, [updateSession]);

  const locationTrackingBlocked = locationAvailability === 'denied' || locationAvailability === 'unsupported';
  const isLiveSession = Boolean(session && LIVE_STATUSES.includes(session.status));
  const shouldWatchLocation = isLiveSession && !locationTrackingBlocked;
  const sessionId = session?.id ?? null;

  useEffect(() => {
    stopLocationWatcher();
    if (!shouldWatchLocation || !sessionId) return;

    let cancelled = false;
    const startWatcherTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (!navigator.geolocation) {
        setLocationAvailability('unsupported');
        return;
      }

      try {
        const watcherId = navigator.geolocation.watchPosition(
          updateLatestCoordinates,
          (error) => {
            setLocationAvailability(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
          },
          { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
        );
        watcherRef.current = watcherId;
      } catch {
        setLocationAvailability('unavailable');
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startWatcherTimer);
      stopLocationWatcher();
    };
  }, [sessionId, shouldWatchLocation, stopLocationWatcher, updateLatestCoordinates]);

  useEffect(() => {
    if (session?.status !== 'ACTIVE') return;
    setNowMs(Date.now());
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [session?.id, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'ACTIVE') return;
    if (Date.parse(session.expectedArrivalAt) <= nowMs) {
      updateSession((current) =>
        current.status === 'ACTIVE' ? { ...current, status: 'CHECK_IN_REQUIRED' } : current
      );
    }
  }, [nowMs, session, updateSession]);

  useEffect(() => stopLocationWatcher, [stopLocationWatcher]);

  const startSession = useCallback(async (input: StartWalkSessionInput) => {
    if (startingRef.current) return;
    startingRef.current = true;
    setIsStarting(true);
    setLocationAvailability('requesting');

    const beginSession = (coordinates: WalkCoordinates | undefined, availability: WalkLocationAvailability) => {
      const startedAtMs = Date.now();
      const nextSession: WalkSession = {
        id: createWalkSessionId(),
        destination: input.destination.trim(),
        startedAt: new Date(startedAtMs).toISOString(),
        expectedArrivalAt: new Date(startedAtMs + input.durationMinutes * 60_000).toISOString(),
        trustedContact: {
          name: input.trustedContact.name.trim(),
          ...(input.trustedContact.phone?.trim() ? { phone: input.trustedContact.phone.trim() } : {}),
        },
        status: 'ACTIVE',
        ...(coordinates ? { startingCoordinates: coordinates, latestCoordinates: coordinates } : {}),
      };
      saveWalkSession(nextSession);
      setSession(nextSession);
      setNowMs(startedAtMs);
      setLocationAvailability(availability);
    };

    if (!navigator.geolocation) {
      beginSession(undefined, 'unsupported');
      startingRef.current = false;
      setIsStarting(false);
      return;
    }

    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          beginSession(toCoordinates(position), 'available');
          resolve();
        },
        (error) => {
          beginSession(undefined, error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
          resolve();
        },
        { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 }
      );
    });

    startingRef.current = false;
    setIsStarting(false);
  }, []);

  const markSafe = useCallback(() => {
    stopLocationWatcher();
    clearStoredWalkSession();
    setSession((current) => current ? {
      ...current,
      status: 'COMPLETED_SAFE',
      completedAt: new Date().toISOString(),
    } : current);
  }, [stopLocationWatcher]);

  const requestHelp = useCallback(() => {
    updateSession((current) => ({ ...current, status: 'HELP_REQUESTED' }));
  }, [updateSession]);

  const endSession = useCallback(() => {
    stopLocationWatcher();
    clearStoredWalkSession();
    setSession((current) => current ? { ...current, status: 'ENDED' } : current);
  }, [stopLocationWatcher]);

  const triggerDemoCheckIn = useCallback(() => {
    updateSession((current) =>
      current.status === 'ACTIVE' ? { ...current, status: 'CHECK_IN_REQUIRED' } : current
    );
  }, [updateSession]);

  const resetSession = useCallback(() => {
    stopLocationWatcher();
    clearStoredWalkSession();
    setSession(null);
    setLocationAvailability('idle');
    setNowMs(Date.now());
  }, [stopLocationWatcher]);

  const remainingMs = useMemo(() => {
    if (!session) return 0;
    const startedAtMs = Date.parse(session.startedAt);
    const expectedArrivalAtMs = Date.parse(session.expectedArrivalAt);
    const effectiveNow = Math.max(nowMs, startedAtMs);
    return Math.max(0, expectedArrivalAtMs - effectiveNow);
  }, [nowMs, session]);

  return {
    session,
    status: session?.status ?? 'SETUP',
    locationAvailability,
    remainingMs,
    isStarting,
    isActiveOnMap: isLiveSession,
    startSession,
    markSafe,
    requestHelp,
    endSession,
    triggerDemoCheckIn,
    resetSession,
  };
}
