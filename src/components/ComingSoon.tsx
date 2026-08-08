import React, { useState } from 'react';
import { AlertTriangle, RotateCcw, Sparkles, User, X } from 'lucide-react';

interface ComingSoonProps {
  tab: 'profile';
  onResetDemoData: () => void;
}

const CONFIGS = {
  profile: {
    icon: User,
    title: 'Your Profile',
    tagline: 'Your safety identity, your trusted circle.',
    features: [
      'Manage trusted contact list',
      'View your incident history',
      'Customise safety preferences',
      'Community safety contributions',
    ],
    color: '#C026D3',
  },
};

export const ComingSoon: React.FC<ComingSoonProps> = ({ tab, onResetDemoData }) => {
  const config = CONFIGS[tab];
  const Icon = config.icon;
  const [isResetConfirmationOpen, setIsResetConfirmationOpen] = useState(false);

  const handleConfirmReset = () => {
    setIsResetConfirmationOpen(false);
    onResetDemoData();
  };

  return (
    <div className="coming-soon-screen">
      <div className="coming-soon-icon-wrap" style={{ background: `linear-gradient(135deg, ${config.color}22 0%, ${config.color}11 100%)` }}>
        <Icon size={48} style={{ color: config.color }} />
      </div>

      <h2 className="coming-soon-title">{config.title}</h2>
      <p className="coming-soon-tagline">{config.tagline}</p>

      <div className="coming-soon-pill">
        <Sparkles size={13} />
        <span>Coming in the next prototype</span>
      </div>

      <div className="coming-soon-features">
        <p className="features-heading">What to expect</p>
        {config.features.map((f, i) => (
          <div key={i} className="feature-row">
            <span className="feature-dot" style={{ backgroundColor: config.color }} />
            <span>{f}</span>
          </div>
        ))}
      </div>

      <section className="prototype-controls" aria-labelledby="prototype-controls-title">
        <div className="prototype-controls-copy">
          <span id="prototype-controls-title">Prototype controls</span>
          <small>Developer and demo presenter tools</small>
        </div>
        <button
          type="button"
          className="prototype-reset-button"
          onClick={() => setIsResetConfirmationOpen(true)}
        >
          <RotateCcw size={15} />
          Reset Demo Data
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
              <button
                type="button"
                className="sheet-close-btn"
                onClick={() => setIsResetConfirmationOpen(false)}
                aria-label="Close reset confirmation"
              >
                <X size={17} />
              </button>
            </div>
            <h2 id="prototype-reset-title">Reset Nidarr prototype?</h2>
            <p id="prototype-reset-description">This will restore locally stored prototype data to a clean demonstration state.</p>
            <ul>
              <li>Delete locally stored pending community reports</li>
              <li>End and remove the current Walk With Me session</li>
              <li>Clear other Nidarr-specific transient prototype state</li>
            </ul>
            <p className="prototype-reset-preserved">Seeded demonstration safety signals will not be affected.</p>
            <div className="prototype-reset-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsResetConfirmationOpen(false)}>Cancel</button>
              <button type="button" className="btn prototype-reset-confirm" onClick={handleConfirmReset}>Reset Prototype</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
