import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  applyResolvedAppearance,
  DARK_APPEARANCE_MEDIA_QUERY,
  getSystemDarkAppearance,
  resolveAppearance,
  saveAppearancePreference,
} from '../services/appearanceStorage';
import type { AppearancePreference, ResolvedAppearance } from '../types/appearance';

export interface AppearanceController {
  preference: AppearancePreference;
  resolvedAppearance: ResolvedAppearance;
  saveError: string | null;
  selectAppearance: (preference: AppearancePreference) => void;
}

export function useAppearance(initialPreference: AppearancePreference): AppearanceController {
  const [preference, setPreference] = useState(initialPreference);
  const [systemIsDark, setSystemIsDark] = useState(getSystemDarkAppearance);
  const [saveError, setSaveError] = useState<string | null>(null);

  const resolvedAppearance = useMemo(
    () => resolveAppearance(preference, systemIsDark),
    [preference, systemIsDark]
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia(DARK_APPEARANCE_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => setSystemIsDark(event.matches);
    setSystemIsDark(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useLayoutEffect(() => {
    applyResolvedAppearance(resolvedAppearance);
  }, [resolvedAppearance]);

  const selectAppearance = useCallback((nextPreference: AppearancePreference) => {
    setSaveError(null);
    try {
      saveAppearancePreference(nextPreference);
      setPreference(nextPreference);
    } catch (error) {
      setSaveError(error instanceof Error
        ? error.message
        : 'Your appearance preference could not be saved. Please try again.');
    }
  }, []);

  return { preference, resolvedAppearance, saveError, selectAppearance };
}
