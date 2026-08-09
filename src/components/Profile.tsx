import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  MapPin,
  Navigation,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import type { CurrentLocationStatus } from '../hooks/useCurrentLocation';
import { USER_PROFILE_FIELD_LIMITS } from '../types/userProfile';
import type { UserProfile } from '../types/userProfile';

interface ProfileProps {
  profile: UserProfile | null;
  locationStatus: CurrentLocationStatus;
  pendingReportCount: number;
  onSaveProfile: (profile: UserProfile) => UserProfile;
  onResetDemoData: () => void;
}

const EMPTY_PROFILE: UserProfile = {
  displayName: '',
  trustedContactName: '',
  trustedContactPhone: '',
  homeArea: '',
};

const locationStatusCopy = (status: CurrentLocationStatus) => {
  switch (status) {
    case 'requesting': return { label: 'Checking location', detail: 'Nidarr is waiting for the browser location result already requested by the app.' };
    case 'available': return { label: 'Location available', detail: 'A current browser location is available to Nidarr for nearby prototype features.' };
    case 'denied': return { label: 'Location access denied', detail: 'The browser denied location access. Profile will not request it again.' };
    case 'unsupported': return { label: 'Location unavailable', detail: 'This browser does not support the location feature used by Nidarr.' };
    default: return { label: 'Location unavailable', detail: 'A current browser location is not available. Profile will not request it again.' };
  }
};

export const Profile: React.FC<ProfileProps> = ({
  profile,
  locationStatus,
  pendingReportCount,
  onSaveProfile,
  onResetDemoData,
}) => {
  const [draft, setDraft] = useState<UserProfile>(() => profile ?? EMPTY_PROFILE);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);
  const successTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (successTimeoutRef.current !== null) window.clearTimeout(successTimeoutRef.current);
  }, []);

  const updateDraft = (field: keyof UserProfile, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveSuccess(false);
    setSaveError(null);
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  };

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const savedProfile = onSaveProfile(draft);
      setDraft(savedProfile);
      setSaveSuccess(true);
      if (successTimeoutRef.current !== null) window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = window.setTimeout(() => {
        setSaveSuccess(false);
        successTimeoutRef.current = null;
      }, 3500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Your profile could not be saved to this device. Please try again.');
    }
  };

  const handleConfirmReset = () => {
    setIsResetConfirmationOpen(false);
    onResetDemoData();
  };

  const locationCopy = locationStatusCopy(locationStatus);
  const reportLabel = pendingReportCount === 1 ? 'pending community report' : 'pending community reports';

  return (
    <section className="profile-screen" aria-labelledby="profile-title">
      <div className="screen-title-container profile-title-container">
        <span className="profile-eyebrow">Stored on this device</span>
        <h2 className="screen-title" id="profile-title">Your Profile</h2>
        <p className="screen-subtitle">Keep lightweight details ready for Nidarr's prototype safety tools.</p>
      </div>

      <form className="profile-form" onSubmit={handleSave}>
        <section className="profile-card" aria-labelledby="profile-details-title">
          <div className="profile-section-heading">
            <UserRound size={18} />
            <div><h3 id="profile-details-title">Profile details</h3><span>Optional personalisation</span></div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-display-name">Display name</label>
            <input
              id="profile-display-name"
              className="form-input"
              value={draft.displayName}
              onChange={(event) => updateDraft('displayName', event.target.value)}
              maxLength={USER_PROFILE_FIELD_LIMITS.displayName}
              autoComplete="name"
              placeholder="How Nidarr should greet you"
            />
            <small className="profile-field-note">Used only for the optional Home greeting.</small>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-home-area">
              Home area <span className="optional-label">Optional</span>
            </label>
            <input
              id="profile-home-area"
              className="form-input"
              value={draft.homeArea}
              onChange={(event) => updateDraft('homeArea', event.target.value)}
              maxLength={USER_PROFILE_FIELD_LIMITS.homeArea}
              autoComplete="off"
              placeholder="e.g. South Kolkata"
            />
            <small className="profile-field-note"><MapPin size={12} />Plain text only. It is never used as your current location or map position.</small>
          </div>
        </section>

        <section className="profile-card" aria-labelledby="trusted-contact-title">
          <div className="profile-section-heading">
            <UsersRound size={18} />
            <div><h3 id="trusted-contact-title">Trusted contact</h3><span>Walk With Me default</span></div>
          </div>
          <p className="profile-section-copy">These details pre-fill new Walk With Me setups and can be changed for each journey.</p>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-contact-name">Contact name</label>
            <input
              id="profile-contact-name"
              className="form-input"
              value={draft.trustedContactName}
              onChange={(event) => updateDraft('trustedContactName', event.target.value)}
              maxLength={USER_PROFILE_FIELD_LIMITS.trustedContactName}
              autoComplete="off"
              placeholder="e.g. Ananya"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="profile-contact-phone">Phone number</label>
            <input
              id="profile-contact-phone"
              className="form-input"
              type="tel"
              value={draft.trustedContactPhone}
              onChange={(event) => updateDraft('trustedContactPhone', event.target.value)}
              maxLength={USER_PROFILE_FIELD_LIMITS.trustedContactPhone}
              autoComplete="off"
              placeholder="For prototype display only"
            />
          </div>

          <div className="profile-simulation-notice">
            <ShieldCheck size={16} />
            <span>Prototype only — trusted-contact alerts, calls, and messages are simulated and are not sent.</span>
          </div>
        </section>

        {saveError && <div className="profile-save-error" role="alert"><AlertTriangle size={16} />{saveError}</div>}
        {saveSuccess && <div className="profile-save-success" role="status" aria-live="polite"><CheckCircle2 size={16} />Profile saved on this device.</div>}

        <button type="submit" className="btn btn-primary btn-full profile-save-button">
          <Save size={17} />Save Profile
        </button>
      </form>

      <section className="profile-card profile-information-card" aria-labelledby="profile-permissions-title">
        <div className="profile-section-heading">
          <Navigation size={18} />
          <div><h3 id="profile-permissions-title">Safety &amp; permissions</h3><span>Current browser state</span></div>
        </div>
        <div className={`profile-location-state profile-location-state--${locationStatus}`}>
          <strong>{locationCopy.label}</strong>
          <span>{locationCopy.detail}</span>
        </div>
      </section>

      <section className="profile-card profile-information-card" aria-labelledby="profile-activity-title">
        <div className="profile-section-heading">
          <Activity size={18} />
          <div><h3 id="profile-activity-title">Activity</h3><span>This device only</span></div>
        </div>
        <div className="profile-activity-count"><strong>{pendingReportCount}</strong><span>{reportLabel} stored on this device</span></div>
        <p className="profile-section-copy">Community reports remain unverified and pending verification.</p>
      </section>

      <section className="profile-card profile-information-card" aria-labelledby="profile-about-title">
        <div className="profile-section-heading">
          <Info size={18} />
          <div><h3 id="profile-about-title">About Nidarr</h3><span>Hackathon prototype</span></div>
        </div>
        <p className="profile-section-copy">Nidarr brings together prototype incident analysis, clearly labelled safety signals, and foreground journey check-ins. It is not a production safety or emergency service.</p>
      </section>

      <section className="prototype-controls" aria-labelledby="prototype-controls-title">
        <div className="prototype-controls-copy">
          <span id="prototype-controls-title">Prototype controls</span>
          <small>Developer and demo presenter tools</small>
        </div>
        <button type="button" className="prototype-reset-button" onClick={() => setIsResetConfirmationOpen(true)}>
          <RotateCcw size={15} />Reset Demo Data
        </button>
      </section>

      {isResetConfirmationOpen && (
        <div className="prototype-reset-overlay" role="presentation">
          <section
            className="prototype-reset-dialog animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prototype-reset-title"
            aria-describedby="prototype-reset-description"
          >
            <div className="prototype-reset-dialog-header">
              <div className="prototype-reset-warning"><AlertTriangle size={22} /></div>
              <button type="button" className="sheet-close-btn" onClick={() => setIsResetConfirmationOpen(false)} aria-label="Close reset confirmation">
                <X size={17} />
              </button>
            </div>
            <h2 id="prototype-reset-title">Reset Nidarr prototype?</h2>
            <p id="prototype-reset-description">This will restore locally stored prototype data to a clean demonstration state.</p>
            <ul>
              <li>Delete locally stored pending community reports</li>
              <li>End and remove the current Walk With Me session</li>
              <li>Delete the profile saved on this device</li>
              <li>Clear other Nidarr-specific transient prototype state</li>
            </ul>
            <p className="prototype-reset-preserved">Seeded demonstration safety signals and browser permission state will not be affected.</p>
            <div className="prototype-reset-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsResetConfirmationOpen(false)}>Cancel</button>
              <button type="button" className="btn prototype-reset-confirm" onClick={handleConfirmReset}>Reset Prototype</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
