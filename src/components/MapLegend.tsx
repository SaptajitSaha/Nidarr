import React from 'react';
import { PENDING_REPORT_COLOR, SAFETY_SIGNAL_COLORS } from '../data/safetySignalPalette';

const LEGEND_ITEMS = [
  { level: 'Low', color: SAFETY_SIGNAL_COLORS.Low },
  { level: 'Moderate', color: SAFETY_SIGNAL_COLORS.Moderate },
  { level: 'Elevated', color: SAFETY_SIGNAL_COLORS.Elevated },
  { level: 'High', color: SAFETY_SIGNAL_COLORS.High },
  { level: 'Pending report', color: PENDING_REPORT_COLOR },
];

export const MapLegend: React.FC = () => {
  return (
    <div className="map-legend">
      <span className="legend-title">Map signals</span>
      {LEGEND_ITEMS.map(({ level, color }) => (
        <div key={level} className="legend-item">
          <span className="legend-dot" style={{ backgroundColor: color }} />
          <span className="legend-label">{level}</span>
        </div>
      ))}
    </div>
  );
};
