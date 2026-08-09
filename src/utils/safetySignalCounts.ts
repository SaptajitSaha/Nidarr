import type { LatLngTuple } from 'leaflet';
import { DEMO_SAFETY_SIGNALS } from '../data/demoSafetySignals';
import type { RiskLevel, SafetySignal } from '../data/demoSafetySignals';
import type { PendingCommunitySignal } from '../types/pendingReport';

const NEARBY_THRESHOLD_DEGREES = 0.05;

const isNearPosition = (latitude: number, longitude: number, position: LatLngTuple) =>
  Math.abs(latitude - position[0]) < NEARBY_THRESHOLD_DEGREES &&
  Math.abs(longitude - position[1]) < NEARBY_THRESHOLD_DEGREES;

export interface NearbySignalCounts {
  demonstration: number;
  pending: number;
}

export interface NearbySafetySignalSummary extends NearbySignalCounts {
  total: number;
  demonstrationSignals: SafetySignal[];
  pendingReports: PendingCommunitySignal[];
  highestDemonstrationSignal: RiskLevel | null;
}

const RISK_LEVEL_PRIORITY: Record<RiskLevel, number> = {
  Low: 1,
  Moderate: 2,
  Elevated: 3,
  High: 4,
};

export function summarizeNearbySafetySignals(
  position: LatLngTuple,
  pendingReports: PendingCommunitySignal[]
): NearbySafetySignalSummary {
  const demonstrationSignals = DEMO_SAFETY_SIGNALS.filter((signal) =>
    isNearPosition(signal.latitude, signal.longitude, position)
  );
  const nearbyPendingReports = pendingReports.filter((report) =>
    isNearPosition(report.latitude, report.longitude, position)
  );
  const highestDemonstrationSignal = demonstrationSignals.reduce<RiskLevel | null>(
    (highest, signal) => highest === null || RISK_LEVEL_PRIORITY[signal.riskLevel] > RISK_LEVEL_PRIORITY[highest]
      ? signal.riskLevel
      : highest,
    null
  );

  return {
    demonstration: demonstrationSignals.length,
    pending: nearbyPendingReports.length,
    total: demonstrationSignals.length + nearbyPendingReports.length,
    demonstrationSignals,
    pendingReports: nearbyPendingReports,
    highestDemonstrationSignal,
  };
}

export function countNearbySafetySignals(
  position: LatLngTuple,
  pendingReports: PendingCommunitySignal[]
): NearbySignalCounts {
  const { demonstration, pending } = summarizeNearbySafetySignals(position, pendingReports);
  return { demonstration, pending };
}
