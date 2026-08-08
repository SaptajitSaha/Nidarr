import React from 'react';
import { Sparkles } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="app-header">
      <div className="brand-container">
        <div className="logo-icon-wrapper">
          <img src="/nidarr-logo.jpg" alt="Nidarr Safety Logo" className="brand-logo-img" />
        </div>
        <div className="brand-text">
          <h1 className="brand-title">
            Nidarr <span className="brand-badge">PROTOTYPE</span>
          </h1>
          <span className="brand-tagline">Personal Safety Network</span>
        </div>
      </div>
      <div className="header-status">
        <Sparkles size={16} className="ai-status-icon" />
        <span>Gemini-powered analysis</span>
      </div>
    </header>
  );
};
