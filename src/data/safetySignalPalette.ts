import type { RiskLevel } from './demoSafetySignals';

export const SAFETY_SIGNAL_COLORS: Record<RiskLevel, string> = {
  Low: '#10B981',
  Moderate: '#F59E0B',
  Elevated: '#F97316',
  High: '#EF4444',
};

export const PENDING_REPORT_COLOR = '#7E22CE';
export const USER_LOCATION_COLOR = '#3B82F6';
export const MARKER_STROKE_COLOR = '#FFFFFF';
