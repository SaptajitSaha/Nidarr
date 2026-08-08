import React from 'react';
import type { SafetySignal, RiskLevel } from '../data/demoSafetySignals';
import { X, AlertTriangle, MapPin, Users, Clock, FlaskConical } from 'lucide-react';

interface RiskDetailsSheetProps {
  signal: SafetySignal;
  onClose: () => void;
}

const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string }> = {
  Low:      { text: '#065F46', bg: '#ECFDF5', border: '#10B981' },
  Moderate: { text: '#92400E', bg: '#FFFBEB', border: '#F59E0B' },
  Elevated: { text: '#9A3412', bg: '#FFF7ED', border: '#F97316' },
  High:     { text: '#991B1B', bg: '#FEF2F2', border: '#EF4444' },
};

export const RiskDetailsSheet: React.FC<RiskDetailsSheetProps> = ({ signal, onClose }) => {
  const colors = RISK_COLORS[signal.riskLevel];

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
            <MapPin size={16} style={{ color: colors.border, flexShrink: 0 }} />
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
        <div
          className="risk-level-badge"
          style={{ color: colors.text, backgroundColor: colors.bg, borderColor: colors.border }}
        >
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
