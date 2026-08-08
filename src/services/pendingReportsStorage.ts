import type { IncidentCategory } from '../types/incident';
import type { PendingCommunitySignal } from '../types/pendingReport';

export const PENDING_REPORTS_STORAGE_KEY = 'nidarr_pending_reports_v1';

const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'Harassment',
  'Stalking',
  'Assault',
  'Suspicious Activity',
  'Unsafe Infrastructure',
  'Other',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidCoordinate = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const isValidCreatedAt = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));

export function isPendingCommunitySignal(value: unknown): value is PendingCommunitySignal {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    isValidCoordinate(value.latitude, -90, 90) &&
    isValidCoordinate(value.longitude, -180, 180) &&
    typeof value.areaName === 'string' &&
    value.areaName.length > 0 &&
    typeof value.category === 'string' &&
    INCIDENT_CATEGORIES.includes(value.category as IncidentCategory) &&
    typeof value.severity === 'number' &&
    Number.isInteger(value.severity) &&
    value.severity >= 1 &&
    value.severity <= 5 &&
    typeof value.timeContext === 'string' &&
    typeof value.summary === 'string' &&
    value.summary.length > 0 &&
    value.sourceType === 'Community' &&
    value.verificationStatus === 'Pending' &&
    value.reportCount === 1 &&
    isValidCreatedAt(value.createdAt) &&
    typeof value.originalLocationText === 'string' &&
    value.isDemoData === false
  );
}

export function createPendingReportId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadPendingReports(): PendingCommunitySignal[] {
  if (typeof window === 'undefined') return [];

  try {
    const storedValue = window.localStorage.getItem(PENDING_REPORTS_STORAGE_KEY);
    if (!storedValue) return [];

    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];

    const seenIds = new Set<string>();
    return parsed.filter((report): report is PendingCommunitySignal => {
      if (!isPendingCommunitySignal(report) || seenIds.has(report.id)) return false;
      seenIds.add(report.id);
      return true;
    });
  } catch {
    return [];
  }
}

export function savePendingReport(report: PendingCommunitySignal): PendingCommunitySignal[] {
  if (!isPendingCommunitySignal(report)) {
    throw new Error('The pending report is invalid and could not be saved.');
  }
  if (typeof window === 'undefined') {
    throw new Error('Local storage is unavailable.');
  }

  const reports = loadPendingReports();
  if (reports.some((existingReport) => existingReport.id === report.id)) {
    return reports;
  }

  const nextReports = [...reports, report];
  window.localStorage.setItem(PENDING_REPORTS_STORAGE_KEY, JSON.stringify(nextReports));
  return nextReports;
}

export function deletePendingReport(reportId: string): PendingCommunitySignal[] {
  if (typeof window === 'undefined') return [];

  const nextReports = loadPendingReports().filter((report) => report.id !== reportId);
  try {
    window.localStorage.setItem(PENDING_REPORTS_STORAGE_KEY, JSON.stringify(nextReports));
  } catch {
    // Deletion is best-effort; return the validated in-memory result safely.
  }
  return nextReports;
}

export function clearPendingReports(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(PENDING_REPORTS_STORAGE_KEY);
  } catch {
    // Storage cleanup is best-effort for this local-only prototype.
  }
}
