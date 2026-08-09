import React from 'react';
import type { SafetySignal } from '../data/demoSafetySignals';
import { X, AlertTriangle, MapPin, Users, Clock, FlaskConical } from 'lucide-react';

interface RiskDetailsSheetProps {
  signal: SafetySignal;
  onClose: () => void;
}

export const RiskDetailsSheet: React.FC<RiskDetailsSheetProps> = ({ signal, onClose }) => {
  const riskClassName = signal.riskLevel.toLowerCase();

  return (
    <>
      {/* Backdrop */}
      <div className="sheet-backdrop" onClick={onClose} />

      {/* Bottom Sheet */}
      <div className="details-sheet animate-slide-up">
        {/* Handle bar */}
        <div className="sheet-handle" />

        {/* Header */}
        <div className="sheet-header">
          <div className="sheet-title-group">
            <MapPin size={16} className={`risk-marker-color risk-marker-color--${riskClassName}`} />
            <h3 className="sheet-title">{signal.areaName}</h3>
          </div>
          <button type="button" className="sheet-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Demo data warning */}
        <div className="demo-badge">
          <FlaskConical size={13} />
          <span>Demonstration data — not real safety information</span>
        </div>

        {/* Risk level badge */}
        <div className={`risk-level-badge risk-level-badge--${riskClassName}`}>
          <AlertTriangle size={14} />
          <span>{signal.riskLevel} Risk</span>
        </div>

        {/* Detail rows */}
        <div className="sheet-details">
          <div className="detail-row">
            <span className="detail-label">Source</span>
            <span className="detail-value">{signal.sourceType}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">
              <Users size={13} style={{ display: 'inline', marginRight: 4 }} />
              Reports
            </span>
            <span className="detail-value">{signal.reportCount} community reports</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">
              <Clock size={13} style={{ display: 'inline', marginRight: 4 }} />
              Updated
            </span>
            <span className="detail-value">{signal.lastUpdated}</span>
          </div>
        </div>

        {/* Summary */}
        <div className="sheet-summary">
          <p>{signal.shortSummary}</p>
        </div>
      </div>
    </>
  );
};
