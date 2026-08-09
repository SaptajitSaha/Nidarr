import React, { useMemo } from 'react';
import {
  AlertCircle,
  Ambulance,
  Clock3,
  Footprints,
  MapPinned,
  Navigation,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';
import type { CurrentLocationStatus } from '../hooks/useCurrentLocation';
import type { WalkSessionController } from '../hooks/useWalkSession';
import type { PendingCommunitySignal } from '../types/pendingReport';
import type { NearbySignalCounts } from '../utils/safetySignalCounts';

interface HomeDashboardProps {
  displayName: string;
  locationStatus: CurrentLocationStatus;
  nearbyCounts: NearbySignalCounts | null;
  pendingReports: PendingCommunitySignal[];
  walkController: WalkSessionController;
  emergencyLocationActive: boolean;
  onOpenEmergencyToolkit: () => void;
  onOpenQuickSafetyCheck: () => void;
  onViewSafetyMap: () => void;
  onReportIncident: () => void;
  onOpenWalkWithMe: () => void;
  onViewPendingReport: (reportId: string) => void;
}

const pluralize = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

const greetingForHour = (hour: number) => {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatRemaining = (remainingMs: number) => {
  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60_000));
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}h ${minutes}m remaining` : `${hours}h remaining`;
  }
  return `${totalMinutes} min remaining`;
};

const formatSubmittedTime = (createdAt: string) => {
  const submittedAt = Date.parse(createdAt);
  if (!Number.isFinite(submittedAt)) return 'Submitted recently';
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - submittedAt) / 60_000));
  if (elapsedMinutes < 1) return 'Submitted just now';
  if (elapsedMinutes < 60) return `Submitted ${elapsedMinutes}m ago`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `Submitted ${elapsedHours}h ago`;
  return `Submitted ${Math.floor(elapsedHours / 24)}d ago`;
};

const locationMessage = (status: CurrentLocationStatus) => {
  switch (status) {
    case 'requesting': return 'Checking location availability…';
    case 'available': return 'Location available for nearby signal counts.';
    case 'denied': return 'Enable location to see nearby safety signals.';
    case 'unsupported': return 'Location is not supported in this browser.';
    default: return 'Location is unavailable. Nearby counts are not calculated.';
  }
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  displayName,
  locationStatus,
  nearbyCounts,
  pendingReports,
  walkController,
  emergencyLocationActive,
  onOpenEmergencyToolkit,
  onOpenQuickSafetyCheck,
  onViewSafetyMap,
  onReportIncident,
  onOpenWalkWithMe,
  onViewPendingReport,
}) => {
  const recentReports = useMemo(
    () => [...pendingReports]
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt))
      .slice(0, 3),
    [pendingReports]
  );

  const activeWalk = walkController.isActiveOnMap && walkController.session
    ? walkController.session
    : null;

  const walkStatusText = activeWalk?.status === 'CHECK_IN_REQUIRED'
    ? 'Check-in required'
    : activeWalk?.status === 'HELP_REQUESTED'
      ? 'Help requested — simulated status only'
      : formatRemaining(walkController.remainingMs);
  const trimmedDisplayName = displayName.trim();
  const homeHeading = trimmedDisplayName
    ? `${greetingForHour(new Date().getHours())}, ${trimmedDisplayName}`
    : 'Your safety tools, in one place.';

  return (
    <div className="home-dashboard animate-fade-in">
      <section className="home-greeting" aria-labelledby="home-title">
        <span className="home-eyebrow">Nidarr</span>
        <h2 id="home-title">{homeHeading}</h2>
        <p>Review nearby safety signals or quickly open a safety feature.</p>
      </section>

      <section className="home-overview" aria-labelledby="home-overview-title">
        <div className="home-section-heading">
          <div><Navigation size={18} /><h3 id="home-overview-title">Current safety overview</h3></div>
          <button type="button" onClick={onViewSafetyMap}>Open map</button>
        </div>

        <p className={`home-location-status home-location-status--${locationStatus}`}>
          {locationMessage(locationStatus)}
        </p>

        {nearbyCounts && (
          <div className="home-signal-summary">
            <span>Safety signals near you</span>
            <div className="home-signal-counts">
              <div className="home-signal-count home-signal-count--demo">
                <strong>{nearbyCounts.demonstration}</strong>
                <span>{pluralize(nearbyCounts.demonstration, 'demonstration safety signal nearby', 'demonstration safety signals nearby').replace(/^\d+ /, '')}</span>
              </div>
              <div className="home-signal-count home-signal-count--pending">
                <strong>{nearbyCounts.pending}</strong>
                <span>{pluralize(nearbyCounts.pending, 'pending community report nearby', 'pending community reports nearby').replace(/^\d+ /, '')}</span>
              </div>
            </div>
          </div>
        )}

        <div className="home-walk-overview">
          <Footprints size={16} />
          <span>{activeWalk ? `Walk With Me active · ${activeWalk.destination}` : 'No active Walk With Me session'}</span>
        </div>
      </section>

      <section className="home-quick-actions" aria-labelledby="home-actions-title">
        <div className="home-section-title-row"><h3 id="home-actions-title">Quick actions</h3></div>
        <div className="home-action-grid">
          <button type="button" className="home-action home-action--emergency" onClick={onOpenEmergencyToolkit}>
            <span className="home-action-icon"><Ambulance size={22} /></span>
            <span>
              <strong>Emergency Toolkit</strong>
              <small>{emergencyLocationActive ? 'Foreground location tracking active' : 'Calls, siren and foreground location tools'}</small>
            </span>
          </button>
          <button type="button" className="home-action home-action--quick-check" onClick={onOpenQuickSafetyCheck}>
            <span className="home-action-icon"><ShieldCheck size={22} /></span>
            <span>
              <strong>Check my surroundings</strong>
              <small>Get a quick overview of safety signals near your current location.</small>
            </span>
          </button>
          <button type="button" className="home-action home-action--map" onClick={onViewSafetyMap}>
            <span className="home-action-icon"><MapPinned size={22} /></span>
            <span><strong>View Safety Map</strong><small>See demonstration and pending signals</small></span>
          </button>
          <button type="button" className="home-action" onClick={onReportIncident}>
            <span className="home-action-icon"><PlusCircle size={21} /></span>
            <span><strong>Report an Incident</strong><small>Analyse and submit a report</small></span>
          </button>
          <button type="button" className="home-action" onClick={onOpenWalkWithMe}>
            <span className="home-action-icon"><Footprints size={21} /></span>
            <span><strong>{activeWalk ? 'Resume Walk With Me' : 'Start Walk With Me'}</strong><small>{activeWalk ? 'Resume the current session' : 'Start a journey check-in'}</small></span>
          </button>
        </div>
      </section>

      {activeWalk && (
        <section className="home-active-walk" aria-labelledby="home-active-walk-title">
          <div className="home-active-walk-icon"><Footprints size={22} /></div>
          <div className="home-active-walk-copy">
            <span>Walk With Me active</span>
            <h3 id="home-active-walk-title">{activeWalk.destination}</h3>
            <p><Clock3 size={13} />{walkStatusText}</p>
          </div>
          <button type="button" onClick={onOpenWalkWithMe}>Resume Session</button>
        </section>
      )}

      <section className="home-recent-reports" aria-labelledby="home-reports-title">
        <div className="home-section-title-row">
          <h3 id="home-reports-title">Recent pending reports</h3>
          <span>Unverified community data</span>
        </div>

        {recentReports.length === 0 ? (
          <div className="home-empty-state">
            <ShieldCheck size={19} />
            <span>No pending community reports saved on this device.</span>
          </div>
        ) : (
          <div className="home-report-list">
            {recentReports.map((report) => (
              <article className="home-report-item" key={report.id}>
                <div className="home-report-main">
                  <span className="home-pending-label"><AlertCircle size={12} />Pending verification</span>
                  <strong>{report.category}</strong>
                  <span>{report.originalLocationText || report.areaName || 'User-selected location'}</span>
                  <small>{formatSubmittedTime(report.createdAt)}</small>
                </div>
                <button type="button" onClick={() => onViewPendingReport(report.id)}>View on Map</button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
