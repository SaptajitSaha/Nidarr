export const USER_PROFILE_FIELD_LIMITS = {
  displayName: 60,
  trustedContactName: 80,
  trustedContactPhone: 30,
  homeArea: 120,
} as const;

export interface UserProfile {
  displayName: string;
  trustedContactName: string;
  trustedContactPhone: string;
  homeArea: string;
}
