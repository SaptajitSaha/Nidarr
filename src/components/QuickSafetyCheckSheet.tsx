import React, { useEffect, useRef } from 'react';
import { AlertCircle, FlaskConical, MapPinned, Navigation, ShieldCheck, ShieldQuestion, X } from 'lucide-react';
import type { CurrentLocationStatus } from '../hooks/useCurrentLocation';
import type { NearbySafetySignalSummary } from '../utils/safetySignalCounts';

interface QuickSafetyCheckSheetProps {
  locationStatus: CurrentLocationStatus;
  summary: NearbySafetySignalSummary | null;
  onClose: () => void;
  onViewSafetyMap: () => void;
}

const locationStatusLabel = (status: CurrentLocationStatus) => {
  switch (status) {
    case 'requesting': return 'Checking location';
    case 'available': return 'Location available';
    case 'denied': return 'Location access denied';
    case 'unsupported': return 'Location unavailable in this browser';
    default: return 'Location unavailable';
  }
};

export const QuickSafetyCheckSheet: React.FC<QuickSafetyCheckSheetProps> = ({
  locationStatus,
  summary,
  onClose,
  onViewSafetyMap,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const hasLocation = summary !== null;
  const effectiveLocationStatus = hasLocation ? 'available' : locationStatus;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, []);

  const riskClassName = summary?.highestDemonstrationSignal?.toLowerCase();

  return (
    <div
      className="quick-safety-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-safety-title"
      aria-describedby="quick-safety-location-status quick-safety-disclosure"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="quick-safety-sheet animate-slide-up">
        <div className="quick-safety-header">
          <div className="quick-safety-title-group">
            <div className="quick-safety-title-icon"><ShieldCheck size={21} /></div>
            <div>
              <span className="quick-safety-eyebrow">Quick safety check</span>
              <h2 id="quick-safety-title">Around you</h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            aria-label="Close quick safety check"
          >
            <X size={20} />
          </button>
        </div>

        <p
          className={`quick-safety-location-status quick-safety-location-status--${effectiveLocationStatus}`}
          id="quick-safety-location-status"
          aria-live="polite"
        >
          <Navigation size={15} />
          {locationStatusLabel(effectiveLocationStatus)}
        </p>

        {summary ? (
          <>
            <div className="quick-safety-metrics">
              <div className="quick-safety-metric quick-safety-metric--total">
                <span>Total nearby signals</span>
                <strong>{summary.total}</strong>
              </div>
              <div className="quick-safety-metric quick-safety-metric--demonstration">
                <FlaskConical size={16} />
                <span>Demonstration signals</span>
                <strong>{summary.demonstration}</strong>
              </div>
              <div className="quick-safety-metric quick-safety-metric--pending">
                <ShieldQuestion size={16} />
                <span>Pending community reports</span>
                <strong>{summary.pending}</strong>
                <small>Unverified</small>
              </div>
            </div>

            <div className="quick-safety-highest-signal">
              <div>
                <span>Highest nearby demonstration signal</span>
                <small>Based only on seeded demonstration data</small>
              </div>
              {summary.highestDemonstrationSignal && riskClassName ? (
                <span className={`risk-level-badge risk-level-badge--${riskClassName}`}>
                  {summary.highestDemonstrationSignal}
                </span>
              ) : (
                <strong>Not available</strong>
              )}
            </div>

            {summary.total === 0 ? (
              <p className="quick-safety-empty">
                <AlertCircle size={17} />
                No nearby safety signals are currently available.
              </p>
            ) : (
              <p className="quick-safety-explanation">
                This overview reflects nearby demonstration signals and unverified pending reports currently available on this device.
              </p>
            )}
          </>
        ) : (
          <div className="quick-safety-location-needed">
            <Navigation size={22} />
            <div>
              <strong>Location is needed to check signals around you.</strong>
              <span>No nearby counts have been calculated.</span>
            </div>
          </div>
        )}

        <p className="quick-safety-disclosure" id="quick-safety-disclosure">
          Safety signals provide context and do not determine whether an area is safe or unsafe.
        </p>

        <div className="quick-safety-actions">
          <button type="button" className="btn btn-primary" onClick={onViewSafetyMap}>
            <MapPinned size={17} />View Safety Map
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </section>
    </div>
  );
};
