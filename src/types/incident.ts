export type IncidentCategory =
  | 'Harassment'
  | 'Stalking'
  | 'Assault'
  | 'Suspicious Activity'
  | 'Unsafe Infrastructure'
  | 'Other';

export interface IncidentFormData {
  category: IncidentCategory;
  description: string;
  location: string;
}

export interface AnalysisResult {
  category: IncidentCategory;
  severity: number; // 1 to 5
  timeContext?: string;
  location?: string;
  summary: string;
  isSafetyRelevant?: boolean;
  requiresVerification: boolean;
}
