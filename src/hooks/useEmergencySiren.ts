import { useCallback, useEffect, useRef, useState } from 'react';

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

const CONSERVATIVE_GAIN = 0.08;
const LOW_FREQUENCY = 620;
const HIGH_FREQUENCY = 880;
const FREQUENCY_INTERVAL_MS = 650;

export interface EmergencySirenController {
  isActive: boolean;
  error: string | null;
  startSiren: () => Promise<void>;
  stopSiren: () => void;
  clearError: () => void;
}

export function useEmergencySiren(): EmergencySirenController {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startingRef = useRef(false);
  const generationRef = useRef(0);

  const releaseAudioResources = useCallback(() => {
    generationRef.current += 1;
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const oscillator = oscillatorRef.current;
    oscillatorRef.current = null;
    if (oscillator) {
      try { oscillator.stop(); } catch { /* The node may already be stopped. */ }
      oscillator.disconnect();
    }

    const gain = gainRef.current;
    gainRef.current = null;
    gain?.disconnect();

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }
    startingRef.current = false;
  }, []);

  const stopSiren = useCallback(() => {
    releaseAudioResources();
    setIsActive(false);
  }, [releaseAudioResources]);

  const startSiren = useCallback(async () => {
    if (startingRef.current || oscillatorRef.current) return;
    startingRef.current = true;
    const startGeneration = generationRef.current + 1;
    generationRef.current = startGeneration;
    setError(null);

    const AudioContextConstructor = window.AudioContext
      ?? (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) {
      startingRef.current = false;
      setError('Emergency siren audio is not supported in this browser.');
      return;
    }

    try {
      const audioContext = new AudioContextConstructor();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      audioContextRef.current = audioContext;
      oscillatorRef.current = oscillator;
      gainRef.current = gain;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(LOW_FREQUENCY, audioContext.currentTime);
      gain.gain.setValueAtTime(CONSERVATIVE_GAIN, audioContext.currentTime);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();

      if (audioContext.state === 'suspended') await audioContext.resume();
      if (generationRef.current !== startGeneration || oscillatorRef.current !== oscillator) return;

      let useHighFrequency = true;
      intervalRef.current = window.setInterval(() => {
        const context = audioContextRef.current;
        const activeOscillator = oscillatorRef.current;
        if (!context || !activeOscillator) return;
        const frequency = useHighFrequency ? HIGH_FREQUENCY : LOW_FREQUENCY;
        activeOscillator.frequency.setTargetAtTime(frequency, context.currentTime, 0.18);
        useHighFrequency = !useHighFrequency;
      }, FREQUENCY_INTERVAL_MS);

      startingRef.current = false;
      setIsActive(true);
    } catch {
      if (generationRef.current !== startGeneration) return;
      releaseAudioResources();
      setIsActive(false);
      setError('The emergency siren could not start. Check browser audio permissions and try again.');
    }
  }, [releaseAudioResources]);

  useEffect(() => releaseAudioResources, [releaseAudioResources]);

  return {
    isActive,
    error,
    startSiren,
    stopSiren,
    clearError: () => setError(null),
  };
}
