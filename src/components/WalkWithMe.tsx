import React, { useState } from 'react';
import {
  AlertTriangle,
  Ambulance,
  CheckCircle2,
  Clock3,
  Footprints,
  MapPinned,
  Navigation,
  Phone,
  ShieldCheck,
  Square,
  UserRound,
} from 'lucide-react';
import type { WalkSessionController } from '../hooks/useWalkSession';
import type { WalkLocationAvailability } from '../types/walkSession';
import { USER_PROFILE_FIELD_LIMITS } from '../types/userProfile';
import { HelpRequestConfirmationSheet } from './HelpRequestConfirmationSheet';
import { maskPhoneNumber } from '../utils/phoneNumber';

interface WalkWithMeProps {
  controller: WalkSessionController;
  defaultTrustedContact: {
    name: string;
    phone: string;
  };
  onViewSafetyMap: () => void;
  onOpenEmergencyToolkit: () => void;
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '45', label: '45 min' },
  { value: '60', label: '1 hour' },
  { value: 'custom', label: 'Custom' },
] as const;

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const formatCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    : `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const locationMessage = (availability: WalkLocationAvailability) => {
  switch (availability) {
    case 'available': return 'Current location available in this foreground session.';
    case 'denied': return 'Location permission denied — continuing in limited mode.';
    case 'unsupported': return 'Location is unsupported — continuing in limited mode.';
    case 'unavailable': return 'Location is temporarily unavailable — the session remains active.';
    case 'requesting': return 'Requesting browser location…';
    default: return 'Waiting for a location update.';
  }
};

export const WalkWithMe: React.FC<WalkWithMeProps> = ({ controller, defaultTrustedContact, onViewSafetyMap, onOpenEmergencyToolkit }) => {
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState<(typeof DURATION_OPTIONS)[number]['value']>('30');
  const [customMinutes, setCustomMinutes] = useState('');
  const [contactName, setContactName] = useState(() => defaultTrustedContact.name);
  const [contactPhone, setContactPhone] = useState(() => defaultTrustedContact.phone);
  const [formError, setFormError] = useState<string | null>(null);
  const [isHelpConfirmationOpen, setIsHelpConfirmationOpen] = useState(false);

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedDestination = destination.trim();
    const durationMinutes = duration === 'custom' ? Number(customMinutes) : Number(duration);

    if (!trimmedDestination) {
      setFormError('Destination is required.');
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
      setFormError('Enter a custom duration between 1 and 1440 minutes.');
      return;
    }

    setFormError(null);
    await controller.startSession({
      destination: trimmedDestination,
      durationMinutes,
      trustedContact: { name: contactName.trim(), phone: contactPhone.trim() || undefined },
    });
  };

  const handleStartAnotherSession = () => {
    setDestination('');
    setDuration('30');
    setCustomMinutes('');
    setContactName(defaultTrustedContact.name);
    setContactPhone(defaultTrustedContact.phone);
    setFormError(null);
    setIsHelpConfirmationOpen(false);
    controller.resetSession();
  };

  if (controller.status === 'SETUP' || !controller.session) {
    return (
      <section className="walk-screen walk-setup-screen" aria-labelledby="walk-setup-title">
        <div className="screen-title-container">
          <h2 className="screen-title" id="walk-setup-title">Walk With Me</h2>
          <p className="screen-subtitle">Start a foreground-only safety check-in for your journey.</p>
        </div>

        <div className="walk-prototype-notice">
          <ShieldCheck size={18} />
          <span>Trusted-contact alerts and emergency integrations are simulated. No real alert is sent.</span>
        </div>

        <form className="walk-setup-form" onSubmit={handleStart}>
          <div className="form-group">
            <label className="form-label" htmlFor="walk-destination">
              <MapPinned size={16} className="input-label-icon" />
              Destination <span className="required">*</span>
            </label>
            <input
              id="walk-destination"
              className="form-input"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="e.g. Jadavpur 8B"
            />
          </div>

          <fieldset className="form-group walk-duration-fieldset">
            <legend className="form-label"><Clock3 size={16} className="input-label-icon" />Expected arrival</legend>
            <div className="walk-duration-options">
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip ${duration === option.value ? 'chip-active' : ''}`}
                  onClick={() => setDuration(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {duration === 'custom' && (
              <input
                className="form-input"
                type="number"
                min="1"
                max="1440"
                inputMode="numeric"
                value={customMinutes}
                onChange={(event) => setCustomMinutes(event.target.value)}
                placeholder="Custom minutes"
                aria-label="Custom expected arrival in minutes"
              />
            )}
          </fieldset>

          <div className="walk-contact-section">
            <div className="walk-contact-heading">
              <UserRound size={17} />
              <div><strong>Trusted contact</strong><span>Simulated alerts</span></div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="walk-contact-name">Contact name</label>
              <input
                id="walk-contact-name"
                className="form-input"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                maxLength={USER_PROFILE_FIELD_LIMITS.trustedContactName}
                placeholder="e.g. Ananya"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="walk-contact-phone">Phone number <span className="optional-label">Optional</span></label>
              <input
                id="walk-contact-phone"
                className="form-input"
                type="tel"
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                maxLength={USER_PROFILE_FIELD_LIMITS.trustedContactPhone}
                placeholder="Optional contact number"
                autoComplete="off"
              />
            </div>
          </div>

          {formError && <div className="form-error" role="alert"><AlertTriangle size={14} />{formError}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={controller.isStarting}>
            {controller.isStarting ? <><span className="spinner" /> Requesting location…</> : <><Footprints size={19} /> Start Walk With Me</>}
          </button>
        </form>
      </section>
    );
  }

  const { session } = controller;
  const contactNameDisplay = session.trustedContact.name || 'Not provided';
  const latestCoordinates = session.latestCoordinates ?? session.startingCoordinates;

  if (session.status === 'COMPLETED_SAFE') {
    return (
      <section className="walk-screen walk-terminal-state walk-terminal-state--safe">
        <div className="walk-terminal-icon"><CheckCircle2 size={42} /></div>
        <h2>Walk completed</h2>
        <p>Your Walk With Me session is marked completed safely.</p>
        <div className="walk-terminal-summary"><strong>{session.destination}</strong><span>Completed at {formatTime(session.completedAt ?? new Date().toISOString())}</span></div>
        <button type="button" className="btn btn-primary btn-full" onClick={handleStartAnotherSession}>Start another session</button>
      </section>
    );
  }

  if (session.status === 'ENDED') {
    return (
      <section className="walk-screen walk-terminal-state">
        <div className="walk-terminal-icon walk-terminal-icon--ended"><Square size={34} /></div>
        <h2>Session ended</h2>
        <p>No contact or emergency service was notified.</p>
        <button type="button" className="btn btn-primary btn-full" onClick={handleStartAnotherSession}>Start another session</button>
      </section>
    );
  }

  if (session.status === 'HELP_REQUESTED') {
    return (
      <section className="walk-screen walk-help-state">
        <div className="walk-help-state-icon"><AlertTriangle size={34} /></div>
        <h2>Help requested</h2>
        <p className="walk-help-prototype-copy">Simulated status only — no trusted-contact alert was sent.</p>
        <div className="walk-help-location-copy">
          <Navigation size={17} />
          <span>{latestCoordinates ? 'Your current location would be shared.' : 'No current location is available to share.'}</span>
        </div>
        <div className="walk-help-actions">
          <button type="button" className="btn btn-emergency btn-full" onClick={onOpenEmergencyToolkit}><Ambulance size={17} />Open Emergency Toolkit</button>
          <button type="button" className="btn btn-primary btn-full" onClick={onViewSafetyMap}><MapPinned size={17} />Return to Safety Map</button>
          <button type="button" className="btn btn-secondary btn-full" onClick={controller.endSession}>End Session</button>
        </div>
      </section>
    );
  }

  const checkInRequired = session.status === 'CHECK_IN_REQUIRED';

  return (
    <section className="walk-screen walk-active-screen">
      <div className={`walk-active-header ${checkInRequired ? 'walk-active-header--overdue' : ''}`}>
        <div className="walk-active-title"><span className="walk-active-pulse" /><h2>Walk With Me Active</h2></div>
        <span className="walk-status-pill">{checkInRequired ? 'Check-in required' : 'Journey active'}</span>
      </div>

      {checkInRequired ? (
        <div className="walk-checkin-card" role="alert">
          <Clock3 size={28} />
          <h3>Have you arrived safely?</h3>
          <p>The expected arrival time has passed. No notification has been sent.</p>
          <div className="walk-checkin-actions">
            <button type="button" className="btn walk-btn-safe" onClick={controller.markSafe}>I'M SAFE</button>
            <button type="button" className="btn walk-btn-help" onClick={() => setIsHelpConfirmationOpen(true)}>NEED HELP</button>
          </div>
        </div>
      ) : (
        <div className="walk-countdown-card">
          <span>Time remaining</span>
          <strong aria-label="Time remaining">{formatCountdown(controller.remainingMs)}</strong>
          <small>Expected by {formatTime(session.expectedArrivalAt)}</small>
        </div>
      )}

      <div className="walk-session-details">
        <div className="walk-detail-row"><span><MapPinned size={15} />Destination</span><strong>{session.destination}</strong></div>
        <div className="walk-detail-row"><span><Clock3 size={15} />Started</span><strong>{formatTime(session.startedAt)}</strong></div>
        <div className="walk-detail-row"><span><UserRound size={15} />Trusted contact</span><strong>{contactNameDisplay}</strong></div>
        {session.trustedContact.phone && (
          <div className="walk-detail-row"><span><Phone size={15} />Phone</span><strong>{maskPhoneNumber(session.trustedContact.phone)}</strong></div>
        )}
        <div className="walk-detail-row walk-detail-row--stacked"><span><Navigation size={15} />Location</span><strong>{locationMessage(controller.locationAvailability)}</strong></div>
        <div className="walk-detail-row"><span><ShieldCheck size={15} />Safety status</span><strong>{checkInRequired ? 'CHECK_IN_REQUIRED' : 'ACTIVE'}</strong></div>
      </div>

      {!checkInRequired && (
        <div className="walk-primary-actions">
          <button type="button" className="btn walk-btn-safe" onClick={controller.markSafe}><CheckCircle2 size={18} />I'm Safe</button>
          <button type="button" className="btn walk-btn-help" onClick={() => setIsHelpConfirmationOpen(true)}><AlertTriangle size={18} />Need Help</button>
        </div>
      )}

      <button type="button" className="btn btn-secondary btn-full" onClick={onViewSafetyMap}><MapPinned size={17} />View Safety Map</button>
      <button type="button" className="walk-end-button" onClick={controller.endSession}>End Session</button>

      {session.status === 'ACTIVE' && (
        <div className="walk-demo-control">
          <span>Demo control</span>
          <button type="button" onClick={controller.triggerDemoCheckIn}>Trigger check-in</button>
        </div>
      )}

      {isHelpConfirmationOpen && (
        <HelpRequestConfirmationSheet
          onCancel={() => setIsHelpConfirmationOpen(false)}
          onConfirm={() => {
            setIsHelpConfirmationOpen(false);
            controller.requestHelp();
          }}
        />
      )}
    </section>
  );
};
