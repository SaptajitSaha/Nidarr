import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EmergencyConfirmation, EmergencyShareStatus } from '../types/emergency';
import { createEmergencyLocationShareText, createEmergencyMapLink } from '../utils/emergencyLocationShare';
import { openTelephoneDialer } from '../utils/telephoneHandoff';
import { useEmergencyLocation } from './useEmergencyLocation';
import { useEmergencySiren } from './useEmergencySiren';

export function useEmergencyToolkit() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<EmergencyConfirmation>(null);
  const [shareStatus, setShareStatus] = useState<EmergencyShareStatus>('idle');
  const [shareError, setShareError] = useState<string | null>(null);
  const siren = useEmergencySiren();
  const location = useEmergencyLocation();
  const { startSiren, stopSiren } = siren;
  const { stopLocation } = location;

  const mapLink = useMemo(
    () => location.latestPosition ? createEmergencyMapLink(location.latestPosition) : null,
    [location.latestPosition]
  );
  const shareText = useMemo(
    () => location.latestPosition ? createEmergencyLocationShareText(location.latestPosition) : null,
    [location.latestPosition]
  );

  useEffect(() => {
    setShareStatus('idle');
    setShareError(null);
  }, [location.latestPosition]);

  const openToolkit = useCallback(() => {
    setConfirmation(null);
    setIsOpen(true);
  }, []);

  const closeToolkit = useCallback(() => {
    stopSiren();
    setConfirmation(null);
    setIsOpen(false);
  }, [stopSiren]);

  const stopEmergencyMode = useCallback(() => {
    stopSiren();
    stopLocation(true);
    setConfirmation(null);
    setShareStatus('idle');
    setShareError(null);
    setIsOpen(false);
  }, [stopLocation, stopSiren]);

  const requestConfirmation = useCallback((nextConfirmation: Exclude<EmergencyConfirmation, null>) => {
    setConfirmation(nextConfirmation);
  }, []);

  const cancelConfirmation = useCallback(() => setConfirmation(null), []);

  const confirm112Call = useCallback(() => {
    setConfirmation(null);
    openTelephoneDialer('112');
  }, []);

  const confirmTrustedContactCall = useCallback((phone: string) => {
    setConfirmation(null);
    openTelephoneDialer(phone);
  }, []);

  const confirmSiren = useCallback(() => {
    setConfirmation(null);
    void startSiren();
  }, [startSiren]);

  const copyLatestLocation = useCallback(async () => {
    if (!shareText) return;
    setShareError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareText);
      setShareStatus('copied');
    } catch {
      setShareStatus('copy-failed');
      setShareError('Automatic copying was unavailable. Select and copy the location link below.');
    }
  }, [shareText]);

  const shareLatestLocation = useCallback(async () => {
    if (!shareText) return;
    setShareError(null);
    if (!navigator.share) {
      await copyLatestLocation();
      return;
    }

    try {
      await navigator.share({ title: 'Nidarr emergency location snapshot', text: shareText });
      setShareStatus('shared');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('idle');
        return;
      }
      setShareStatus('idle');
      setShareError('The location snapshot could not be shared. You can copy its link instead.');
    }
  }, [copyLatestLocation, shareText]);

  return {
    isOpen,
    confirmation,
    siren,
    location,
    shareStatus,
    shareError,
    mapLink,
    canUseNativeShare: typeof navigator.share === 'function',
    openToolkit,
    closeToolkit,
    stopEmergencyMode,
    requestConfirmation,
    cancelConfirmation,
    confirm112Call,
    confirmTrustedContactCall,
    confirmSiren,
    shareLatestLocation,
    copyLatestLocation,
  };
}

export type EmergencyToolkitController = ReturnType<typeof useEmergencyToolkit>;
