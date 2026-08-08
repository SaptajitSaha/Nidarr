import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface HelpRequestConfirmationSheetProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export const HelpRequestConfirmationSheet: React.FC<HelpRequestConfirmationSheetProps> = ({
  onCancel,
  onConfirm,
}) => (
  <div className="walk-help-overlay" role="dialog" aria-modal="true" aria-labelledby="walk-help-title">
    <div className="walk-help-sheet animate-slide-up">
      <div className="walk-help-sheet-header">
        <div className="walk-help-warning-icon"><AlertTriangle size={24} /></div>
        <button type="button" className="sheet-close-btn" onClick={onCancel} aria-label="Cancel help request">
          <X size={20} />
        </button>
      </div>
      <h2 id="walk-help-title">Request prototype help?</h2>
      <p>
        This changes the session status for demonstration only. No message, phone call, notification,
        police alert, or emergency-service request will be sent.
      </p>
      <div className="walk-help-sheet-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn walk-btn-help" onClick={onConfirm}>Confirm Need Help</button>
      </div>
    </div>
  </div>
);
