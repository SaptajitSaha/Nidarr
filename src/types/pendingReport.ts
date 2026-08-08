import type { IncidentCategory } from './incident';

export interface PendingCommunitySignal {
  id: string;
  latitude: number;
  longitude: number;
  areaName: string;
  category: IncidentCategory;
  severity: number;
  timeContext: string;
  summary: string;
  sourceType: 'Community';
  verificationStatus: 'Pending';
  reportCount: 1;
  createdAt: string;
  originalLocationText: string;
  isDemoData: false;
}
