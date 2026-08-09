export const APPEARANCE_PREFERENCES = ['system', 'light', 'dark'] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type ResolvedAppearance = Exclude<AppearancePreference, 'system'>;
