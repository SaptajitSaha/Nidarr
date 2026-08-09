import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  LocateFixed,
  MapPinned,
  Navigation,
  Phone,
  Radio,
  ShieldAlert,
  Square,
  UserRound,
  Volume2,
  X,
} from 'lucide-react';
import type { EmergencyToolkitController } from '../hooks/useEmergencyToolkit';
import { EmergencyConfirmationSheet } from './EmergencyConfirmationSheet';

interface EmergencyToolkitProps {
  controller: EmergencyToolkitController;
  trustedContactName: string;
  maskedTrustedContactNumber: string;
  hasTrustedContactPhone: boolean;
  onConfirmTrustedContactCall: () => void;
  onViewSafetyMap: () => void;
}

const formatCoordinate = (value: number) => value.toFixed(6);

const formatUpdatedTime = (capturedAt: string) =>
  new Date(capturedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });

const locationStatusCopy = (status: EmergencyToolkitController['location']['status']) => {
  switch (status) {
    case 'requesting': return 'Starting foreground location tracking…';
    case 'active': return 'Foreground location tracking active';
    case 'denied': return 'Location access denied';
    case 'timeout': return 'Location request timed out';
    case 'unsupported': return 'Foreground location tracking unsupported';
    case 'unavailable': return 'Location unavailable';
    default: return 'Foreground location tracking is off';
  }
};

export const EmergencyToolkit: React.FC<EmergencyToolkitProps> = ({
  controller,
  trustedContactName,
  maskedTrustedContactNumber,
  hasTrustedContactPhone,
  onConfirmTrustedContactCall,
  onViewSafetyMap,
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeToolkitRef = useRef(controller.closeToolkit);
  const latestPosition = controller.location.latestPosition;

  useEffect(() => { closeToolkitRef.current = controller.closeToolkit; }, [controller.closeToolkit]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !controller.confirmation) closeToolkitRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [controller.confirmation]);

  return (
    <div
      className="emergency-toolkit-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-toolkit-title"
      aria-describedby="emergency-toolkit-disclosure"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) controller.closeToolkit();
      }}
    >
      <section className="emergency-toolkit-sheet animate-slide-up">
        <div className="emergency-toolkit-header">
          <div className="emergency-toolkit-title-group">
            <div className="emergency-toolkit-title-icon"><ShieldAlert size={23} /></div>
            <div><span>Immediate tools</span><h2 id="emergency-toolkit-title">Emergency Toolkit</h2></div>
          </div>
          <button ref={closeButtonRef} type="button" className="sheet-close-btn" onClick={controller.closeToolkit} aria-label="Close Emergency Toolkit">
            <X size={20} />
          </button>
        </div>

        <p className="emergency-toolkit-disclosure" id="emergency-toolkit-disclosure">
          <AlertTriangle size={17} />
          Nidarr does not automatically call, message or contact emergency services.
        </p>

        <section className="emergency-toolkit-section" aria-labelledby="emergency-calls-title">
          <div className="emergency-section-heading"><Phone size={17} /><h3 id="emergency-calls-title">Calls</h3></div>
          <button type="button" className="emergency-action emergency-action--critical" onClick={() => controller.requestConfirmation('call-112')}>
            <span className="emergency-action-icon"><Phone size={20} /></span>
            <span><strong>Call 112</strong><small>Opens your device dialer after confirmation</small></span>
          </button>
          <button
            type="button"
            className="emergency-action emergency-action--critical"
            onClick={() => controller.requestConfirmation('call-trusted-contact')}
            disabled={!hasTrustedContactPhone}
          >
            <span className="emergency-action-icon"><UserRound size={20} /></span>
            <span>
              <strong>Call trusted contact</strong>
              <small>{hasTrustedContactPhone
                ? `${trustedContactName.trim() || 'Saved contact'} · ${maskedTrustedContactNumber}`
                : 'Add a trusted contact in Profile'}</small>
            </span>
          </button>
        </section>

        <section className="emergency-toolkit-section" aria-labelledby="emergency-siren-title">
          <div className="emergency-section-heading"><Volume2 size={17} /><h3 id="emergency-siren-title">Emergency siren</h3></div>
          {controller.siren.isActive ? (
            <button type="button" className="btn btn-emergency btn-full" onClick={controller.siren.stopSiren}><Square size={18} />Stop Siren</button>
          ) : (
            <button type="button" className="emergency-action" onClick={() => controller.requestConfirmation('siren')}>
              <span className="emergency-action-icon"><Volume2 size={20} /></span>
              <span><strong>Start emergency siren</strong><small>Requires confirmation before audio starts</small></span>
            </button>
          )}
          {controller.siren.isActive && <p className="emergency-active-status" role="status"><Radio size={15} />Emergency siren active</p>}
          {controller.siren.error && <p className="emergency-error" role="alert">{controller.siren.error}</p>}
        </section>

        <section className="emergency-toolkit-section" aria-labelledby="emergency-location-title">
          <div className="emergency-section-heading"><LocateFixed size={17} /><h3 id="emergency-location-title">Foreground location tracking</h3></div>
          <p className={`emergency-location-status emergency-location-status--${controller.location.status}`} aria-live="polite">
            <Navigation size={15} />{locationStatusCopy(controller.location.status)}
          </p>

          {controller.location.isTracking ? (
            <button type="button" className="btn btn-secondary btn-full" onClick={() => controller.location.stopLocation(false)}><Square size={17} />Stop foreground location</button>
          ) : (
            <button type="button" className="emergency-action" onClick={controller.location.startLocation} disabled={controller.location.status === 'requesting'}>
              <span className="emergency-action-icon"><LocateFixed size={20} /></span>
              <span><strong>Start foreground location</strong><small>Tracks only in this browser session</small></span>
            </button>
          )}

          {controller.location.error && <p className="emergency-error" role="alert">{controller.location.error}</p>}

          {latestPosition && (
            <div className="emergency-position-card">
              <dl>
                <div><dt>Latitude</dt><dd>{formatCoordinate(latestPosition.latitude)}</dd></div>
                <div><dt>Longitude</dt><dd>{formatCoordinate(latestPosition.longitude)}</dd></div>
                <div><dt>Accuracy</dt><dd>Approximately {Math.max(0, Math.round(latestPosition.accuracy))} m</dd></div>
                <div><dt>Last updated</dt><dd>{formatUpdatedTime(latestPosition.capturedAt)}</dd></div>
              </dl>
              {controller.location.isTracking && (
                <button type="button" className="btn btn-secondary btn-full" onClick={onViewSafetyMap}><MapPinned size={17} />View current position on Safety Map</button>
              )}
            </div>
          )}
        </section>

        {latestPosition && (
          <section className="emergency-toolkit-section" aria-labelledby="emergency-share-title">
            <div className="emergency-section-heading"><Clipboard size={17} /><h3 id="emergency-share-title">Share latest location</h3></div>
            <p className="emergency-snapshot-disclosure">This shares the latest location snapshot. It is not a continuously updating link and does not share foreground location tracking.</p>
            <button type="button" className="btn btn-primary btn-full" onClick={controller.shareLatestLocation}>
              {controller.canUseNativeShare ? <><Navigation size={17} />Share latest location</> : <><Clipboard size={17} />Copy location link</>}
            </button>
            {controller.canUseNativeShare && controller.shareError && (
              <button type="button" className="btn btn-secondary btn-full" onClick={controller.copyLatestLocation}><Clipboard size={17} />Copy location link</button>
            )}
            {controller.shareStatus === 'shared' && <p className="emergency-success" role="status"><CheckCircle2 size={15} />Location snapshot shared.</p>}
            {controller.shareStatus === 'copied' && <p className="emergency-success" role="status"><CheckCircle2 size={15} />Location snapshot copied.</p>}
            {controller.shareError && <p className="emergency-error" role="alert">{controller.shareError}</p>}
            {controller.mapLink && (!controller.canUseNativeShare || controller.shareStatus === 'copy-failed') && (
              <label className="emergency-copy-fallback">
                <span>Select and copy this location link</span>
                <input type="text" readOnly value={controller.mapLink} onFocus={(event) => event.currentTarget.select()} />
              </label>
            )}
          </section>
        )}

        <button type="button" className="btn btn-emergency-outline btn-full emergency-stop-mode" onClick={controller.stopEmergencyMode}>
          <Square size={18} />Stop Emergency Mode
        </button>
        <p className="emergency-toolkit-limit">These browser tools do not guarantee safety, emergency response, or successful contact.</p>
      </section>

      {controller.confirmation && (
        <EmergencyConfirmationSheet
          confirmation={controller.confirmation}
          maskedTrustedContactNumber={maskedTrustedContactNumber}
          onCancel={controller.cancelConfirmation}
          onConfirm112={controller.confirm112Call}
          onConfirmTrustedContact={onConfirmTrustedContactCall}
          onConfirmSiren={controller.confirmSiren}
        />
      )}
    </div>
  );
};
