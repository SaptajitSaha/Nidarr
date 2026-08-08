import React, { useState } from 'react';
import type { IncidentCategory, IncidentFormData } from '../types/incident';
import { MapPin, FileText, Send, AlertTriangle } from 'lucide-react';

interface IncidentFormProps {
  onSubmit: (data: IncidentFormData) => void;
  isAnalyzing: boolean;
}

const CATEGORIES: IncidentCategory[] = [
  'Harassment',
  'Stalking',
  'Assault',
  'Suspicious Activity',
  'Unsafe Infrastructure',
  'Other',
];

export const IncidentForm: React.FC<IncidentFormProps> = ({ onSubmit, isAnalyzing }) => {
  const [category, setCategory] = useState<IncidentCategory>('Harassment');
  const [description, setDescription] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide a brief description of the incident.');
      return;
    }
    setError('');
    onSubmit({ category, description: description.trim(), location: location.trim() });
  };

  return (
    <div className="card form-card">
      <div className="screen-title-container">
        <h2 className="screen-title">Report an Incident</h2>
        <p className="screen-subtitle">Help make your community safer</p>
      </div>

      <form onSubmit={handleSubmit} className="incident-form">
        {/* Category Selector */}
        <div className="form-group">
          <label className="form-label">
            Incident Category <span className="required">*</span>
          </label>
          <div className="category-chips">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                className={`chip ${category === cat ? 'chip-active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Incident Description */}
        <div className="form-group">
          <label className="form-label" htmlFor="description">
            <FileText size={16} className="input-label-icon" />
            Incident Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            className="form-textarea"
            rows={4}
            placeholder="Describe what happened, individuals involved, or any relevant safety details..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError('');
            }}
          />
          {error && (
            <div className="form-error">
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Approximate Location */}
        <div className="form-group">
          <label className="form-label" htmlFor="location">
            <MapPin size={16} className="input-label-icon" />
            Approximate Location
          </label>
          <input
            id="location"
            type="text"
            className="form-input"
            placeholder="e.g. Near Metro Station Gate 2, Oak Street"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary btn-analyse"
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <span className="spinner"></span>
              Analyzing Report...
            </>
          ) : (
            <>
              <Send size={18} />
              Analyse Report
            </>
          )}
        </button>
      </form>
    </div>
  );
};
