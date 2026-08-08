import React, { useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';

const KOLKATA_CENTER: LatLngTuple = [22.5726, 88.3639];

interface LocationConfirmationSheetProps {
  initialPosition: LatLngTuple | null;
  isSaving: boolean;
  saveError: string | null;
  onPositionKnown: (position: LatLngTuple) => void;
  onConfirm: (position: LatLngTuple) => Promise<void>;
  onCancel: () => void;
}

interface LocationClickHandlerProps {
  onSelect: (position: LatLngTuple) => void;
}

const LocationClickHandler: React.FC<LocationClickHandlerProps> = ({ onSelect }) => {
  useMapEvents({
    click: (event) => onSelect([event.latlng.lat, event.latlng.lng]),
  });
  return null;
};

export const LocationConfirmationSheet: React.FC<LocationConfirmationSheetProps> = ({
  initialPosition,
  isSaving,
  saveError,
  onPositionKnown,
  onConfirm,
  onCancel,
}) => {
  const [mode, setMode] = useState<'options' | 'gps' | 'map'>('options');
  const [selectedPosition, setSelectedPosition] = useState<LatLngTuple | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [tileLoadFailed, setTileLoadFailed] = useState(false);

  const handleUseCurrentLocation = () => {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Location is unavailable in this browser. Please select a point on the map.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: LatLngTuple = [position.coords.latitude, position.coords.longitude];
        setSelectedPosition(coordinates);
        onPositionKnown(coordinates);
        setMode('gps');
        setIsLocating(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can still select the location on the map.'
            : 'Your current location could not be determined. Please select it on the map.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleMapSelection = (position: LatLngTuple) => {
    setSelectedPosition(position);
    setLocationError(null);
  };

  const pickerCenter = initialPosition ?? KOLKATA_CENTER;

  return (
    <div className="location-confirmation-overlay" role="dialog" aria-modal="true" aria-labelledby="location-confirmation-title">
      <div className={`location-confirmation-sheet ${mode === 'map' ? 'location-confirmation-sheet--map' : ''}`}>
        <div className="location-confirmation-header">
          <div>
            <span className="location-step-label">Pending community report</span>
            <h2 id="location-confirmation-title">Confirm incident location</h2>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onCancel}
            disabled={isSaving}
            aria-label="Cancel location confirmation"
          >
            <X size={20} />
          </button>
        </div>

        {mode === 'options' && (
          <div className="location-options">
            <p className="location-helper-text">
              Gemini does not choose map coordinates. Confirm where the incident occurred before saving it as unverified.
            </p>

            <button
              type="button"
              className="location-option-button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating || isSaving}
            >
              {isLocating ? <span className="spinner spinner--purple" /> : <Navigation size={20} />}
              <span>
                <strong>{isLocating ? 'Finding your location…' : 'Use my current location'}</strong>
                <small>Uses your browser location permission</small>
              </span>
            </button>

            <button
              type="button"
              className="location-option-button"
              onClick={() => {
                setMode('map');
                setLocationError(null);
              }}
              disabled={isSaving}
            >
              <MapPin size={20} />
              <span>
                <strong>Select on map</strong>
                <small>Tap the map to place or move the marker</small>
              </span>
            </button>

            {locationError && <div className="location-error" role="alert">{locationError}</div>}

            <button type="button" className="btn btn-secondary btn-full" onClick={onCancel} disabled={isSaving}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'gps' && selectedPosition && (
          <div className="location-gps-confirmation">
            <div className="location-confirmed-icon"><Crosshair size={28} /></div>
            <h3>Current location found</h3>
            <p className="location-coordinate-text">
              {selectedPosition[0].toFixed(5)}, {selectedPosition[1].toFixed(5)}
            </p>
            <p className="location-helper-text">Confirm to save this report as pending community information.</p>
            {saveError && <div className="location-error" role="alert">{saveError}</div>}
            <div className="location-confirmation-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMode('options')} disabled={isSaving}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onConfirm(selectedPosition)}
                disabled={isSaving}
              >
                {isSaving ? <><span className="spinner" /> Saving…</> : 'Confirm location'}
              </button>
            </div>
          </div>
        )}

        {mode === 'map' && (
          <div className="location-map-picker">
            <p className="location-helper-text">Tap the map to place the pending report marker.</p>
            <div className="location-picker-map-wrap">
              {tileLoadFailed && (
                <div className="location-picker-tile-error" role="status">
                  Map background could not load. You can go back or cancel and try again when connected.
                </div>
              )}
              <MapContainer center={pickerCenter} zoom={14} className="location-picker-map" zoomControl={false}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  eventHandlers={{
                    tileerror: () => setTileLoadFailed(true),
                    loading: () => setTileLoadFailed(false),
                  }}
                />
                <LocationClickHandler onSelect={handleMapSelection} />
                {selectedPosition && (
                  <CircleMarker
                    center={selectedPosition}
                    radius={12}
                    pathOptions={{ fillColor: '#7E22CE', fillOpacity: 0.9, color: '#FFFFFF', weight: 3 }}
                  />
                )}
              </MapContainer>
            </div>

            <p className="location-coordinate-text" aria-live="polite">
              {selectedPosition
                ? `Selected: ${selectedPosition[0].toFixed(5)}, ${selectedPosition[1].toFixed(5)}`
                : 'No location selected yet'}
            </p>
            {saveError && <div className="location-error" role="alert">{saveError}</div>}
            <div className="location-confirmation-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setMode('options')} disabled={isSaving}>
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => selectedPosition && onConfirm(selectedPosition)}
                disabled={!selectedPosition || isSaving}
              >
                {isSaving ? <><span className="spinner" /> Saving…</> : 'Confirm location'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
