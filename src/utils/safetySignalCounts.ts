import type { LatLngTuple } from 'leaflet';
import { DEMO_SAFETY_SIGNALS } from '../data/demoSafetySignals';
import type { PendingCommunitySignal } from '../types/pendingReport';

const NEARBY_THRESHOLD_DEGREES = 0.05;

const isNearPosition = (latitude: number, longitude: number, position: LatLngTuple) =>
  Math.abs(latitude - position[0]) < NEARBY_THRESHOLD_DEGREES &&
  Math.abs(longitude - position[1]) < NEARBY_THRESHOLD_DEGREES;

export interface NearbySignalCounts {
  demonstration: number;
  pending: number;
}

export function countNearbySafetySignals(
  position: LatLngTuple,
  pendingReports: PendingCommunitySignal[]
): NearbySignalCounts {
  return {
    demonstration: DEMO_SAFETY_SIGNALS.filter((signal) =>
      isNearPosition(signal.latitude, signal.longitude, position)
    ).length,
    pending: pendingReports.filter((report) =>
      isNearPosition(report.latitude, report.longitude, position)
    ).length,
  };
}
