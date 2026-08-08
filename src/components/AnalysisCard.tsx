import React from 'react';
import type { AnalysisResult } from '../types/incident';
import { ShieldCheck, AlertCircle, RefreshCw, Clock, MapPin, MapPinned, CheckCircle2 } from 'lucide-react';

interface AnalysisCardProps {
  analysis: AnalysisResult;
  onReset: () => void;
  onAddToMap: () => void;
  isAddedToMap: boolean;
}

export const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, onReset, onAddToMap, isAddedToMap }) => {
  // Determine severity color badge & indicator text
  const getSeverityStyle = (level: number) => {
    switch (level) {
      case 1:
        return { label: 'Low', colorClass: 'severity-1' };
      case 2:
        return { label: 'Moderate', colorClass: 'severity-2' };
      case 3:
        return { label: 'Substantial', colorClass: 'severity-3' };
      case 4:
        return { label: 'High', colorClass: 'severity-4' };
      case 5:
        return { label: 'Critical', colorClass: 'severity-5' };
      default:
        return { label: 'Moderate', colorClass: 'severity-2' };
    }
  };

  const severityStyle = getSeverityStyle(analysis.severity);

  return (
    <div className="card analysis-card animate-fade-in">
      <div className="analysis-header">
        <div className="analysis-title-group">
          <ShieldCheck className="analysis-icon" size={24} />
          <h3>Safety Analysis Complete</h3>
        </div>
        <span className="ai-badge">Gemini AI</span>
      </div>

      <div className="analysis-content">
        {/* Category Row */}
        <div className="analysis-item">
          <span className="item-label">Category</span>
          <span className="category-tag">{analysis.category}</span>
        </div>

        {/* Severity Level Indicator */}
        <div className="analysis-item">
          <span className="item-label">Severity Level</span>
          <div className="severity-container">
            <div className="severity-dots">
              {[1, 2, 3, 4, 5].map((step) => (
                <div
                  key={step}
                  className={`severity-dot ${
                    step <= analysis.severity ? severityStyle.colorClass : 'inactive'
                  }`}
                />
              ))}
            </div>
            <span className={`severity-text ${severityStyle.colorClass}`}>
              {analysis.severity} / 5 ({severityStyle.label})
            </span>
          </div>
        </div>

        {/* Time Context & Location details */}
        <div className="analysis-meta-row">
          {analysis.timeContext && (
            <div className="meta-badge">
              <Clock size={13} />
              <span>Time: {analysis.timeContext}</span>
            </div>
          )}
          {analysis.location && (
            <div className="meta-badge">
              <MapPin size={13} />
              <span>Location: {analysis.location}</span>
            </div>
          )}
        </div>

        {/* Short Summary */}
        <div className="analysis-item summary-item">
          <span className="item-label">Summary</span>
          <p className="summary-text">{analysis.summary}</p>
        </div>

        {/* Verification Status */}
        {analysis.requiresVerification && (
          <div className="verification-banner">
            <AlertCircle size={18} className="banner-icon" />
            <div className="banner-text">
              <strong>Status:</strong> Requires community verification
            </div>
          </div>
        )}
      </div>

      <div className="analysis-actions">
        {analysis.isSafetyRelevant === true && (
          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={onAddToMap}
            disabled={isAddedToMap}
          >
            {isAddedToMap ? <CheckCircle2 size={17} /> : <MapPinned size={17} />}
            {isAddedToMap ? 'Added to Safety Map' : 'Add to Safety Map'}
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-full" onClick={onReset}>
          <RefreshCw size={16} />
          Submit Another Report
        </button>
      </div>
    </div>
  );
};
