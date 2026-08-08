import React from 'react';
import { AlertCircle, Clock, MapPin, ShieldQuestion, UserRound, X } from 'lucide-react';
import type { PendingCommunitySignal } from '../types/pendingReport';

interface PendingSignalDetailsSheetProps {
  signal: PendingCommunitySignal;
  onClose: () => void;
}

const formatSubmittedTime = (createdAt: string) => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
};

export const PendingSignalDetailsSheet: React.FC<PendingSignalDetailsSheetProps> = ({ signal, onClose }) => (
  <>
    <div className="sheet-backdrop" onClick={onClose} />

    <div className="details-sheet pending-details-sheet animate-slide-up" role="dialog" aria-modal="true" aria-labelledby="pending-signal-title">
      <div className="sheet-handle" />

      <div className="sheet-header">
        <div className="sheet-title-group">
          <MapPin size={16} className="pending-marker-color" />
          <h3 className="sheet-title" id="pending-signal-title">{signal.areaName}</h3>
        </div>
        <button type="button" className="sheet-close-btn" onClick={onClose} aria-label="Close pending report details">
          <X size={20} />
        </button>
      </div>

      <div className="pending-unverified-badge">
        <ShieldQuestion size={14} />
        <span>User-submitted and unverified</span>
      </div>

      <div className="pending-status-badge">
        <AlertCircle size={14} />
        <span>Pending community verification</span>
      </div>

      <div className="sheet-details pending-sheet-details">
        <div className="detail-row">
          <span className="detail-label">Category</span>
          <span className="detail-value">{signal.category}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Provisional severity</span>
          <span className="detail-value">{signal.severity} / 5</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">
            <Clock size={13} style={{ marginRight: 4 }} />
            Time context
          </span>
          <span className="detail-value">{signal.timeContext || 'Unknown'}</span>
        </div>
        <div className="detail-row detail-row--stacked">
          <span className="detail-label">Original location text</span>
          <span className="detail-value">{signal.originalLocationText || 'Not provided'}</span>
        </div>
        <div className="detail-row detail-row--stacked">
          <span className="detail-label">
            <Clock size={13} style={{ marginRight: 4 }} />
            Submitted
          </span>
          <span className="detail-value">{formatSubmittedTime(signal.createdAt)}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">
            <UserRound size={13} style={{ marginRight: 4 }} />
            Source
          </span>
          <span className="detail-value">Community</span>
        </div>
      </div>

      <div className="sheet-summary pending-sheet-summary">
        <span className="item-label">Report summary</span>
        <p>{signal.summary}</p>
      </div>
    </div>
  </>
);
