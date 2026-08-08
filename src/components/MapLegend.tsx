import React from 'react';

const LEGEND_ITEMS = [
  { level: 'Low', color: '#10B981', bg: '#ECFDF5' },
  { level: 'Moderate', color: '#F59E0B', bg: '#FFFBEB' },
  { level: 'Elevated', color: '#F97316', bg: '#FFF7ED' },
  { level: 'High', color: '#EF4444', bg: '#FEF2F2' },
  { level: 'Pending report', color: '#7E22CE', bg: '#F3E8FF' },
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
