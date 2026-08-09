import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import { DEMO_SAFETY_SIGNALS } from '../data/demoSafetySignals';
import type { SafetySignal } from '../data/demoSafetySignals';
import {
  MARKER_STROKE_COLOR,
  PENDING_REPORT_COLOR,
  SAFETY_SIGNAL_COLORS,
  USER_LOCATION_COLOR,
} from '../data/safetySignalPalette';
import type { PendingCommunitySignal } from '../types/pendingReport';
import type { CurrentLocationStatus } from '../hooks/useCurrentLocation';
import { countNearbySafetySignals } from '../utils/safetySignalCounts';
import { RiskDetailsSheet } from './RiskDetailsSheet';
import { PendingSignalDetailsSheet } from './PendingSignalDetailsSheet';
import { MapLegend } from './MapLegend';
import { Crosshair, FileWarning, Footprints, LocateFixed } from 'lucide-react';

const KOLKATA_CENTER: LatLngTuple = [22.5726, 88.3639];
const DEFAULT_ZOOM = 13;

interface SafetyMapProps {
  pendingReports: PendingCommunitySignal[];
  focusedPendingReportId: string | null;
  walkWithMeActive: boolean;
  journeyPosition: LatLngTuple | null;
  emergencyLocationActive: boolean;
  emergencyPosition: LatLngTuple | null;
  currentPosition: LatLngTuple | null;
  locationStatus: CurrentLocationStatus;
  onFocusedPendingReportClose: () => void;
  onNavigateToReport: () => void;
  onOpenEmergencyToolkit: () => void;
}

const InitialLocationController: React.FC<{ position: LatLngTuple | null }> = ({ position }) => {
  const map = useMap();
  const hasCentredRef = useRef(false);

  useEffect(() => {
    if (!position || hasCentredRef.current) return;
    hasCentredRef.current = true;
    map.setView(position, DEFAULT_ZOOM, { animate: false });
  }, [map, position]);

  return null;
};

// Sub-component to handle recentering the map
const RecenterController: React.FC<{ center: LatLngTuple; trigger: number }> = ({ center, trigger }) => {
  const map = useMap();
  useEffect(() => {
    if (trigger > 0) {
      map.setView(center, DEFAULT_ZOOM, { animate: true });
    }
  }, [map, center, trigger]);
  return null;
};

const PendingReportFocusController: React.FC<{ report: PendingCommunitySignal | null }> = ({ report }) => {
  const map = useMap();
  useEffect(() => {
    if (report) {
      map.setView([report.latitude, report.longitude], 15, { animate: true });
    }
  }, [map, report]);
  return null;
};

const JourneyPositionController: React.FC<{ position: LatLngTuple | null; active: boolean }> = ({ position, active }) => {
  const map = useMap();
  useEffect(() => {
    if (active && position) {
      map.setView(position, Math.max(map.getZoom(), 14), { animate: true });
    }
  }, [active, map, position]);
  return null;
};

// Sub-component to handle tile error detection
const TileErrorWatcher: React.FC<{ onError: () => void }> = ({ onError }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => onError();
    map.on('tileerror', handler);
    return () => { map.off('tileerror', handler); };
  }, [map, onError]);
  return null;
};

export const SafetyMap: React.FC<SafetyMapProps> = ({
  pendingReports,
  focusedPendingReportId,
  walkWithMeActive,
  journeyPosition,
  emergencyLocationActive,
  emergencyPosition,
  currentPosition,
  locationStatus,
  onFocusedPendingReportClose,
  onNavigateToReport,
  onOpenEmergencyToolkit,
}) => {
  const [userPosition, setUserPosition] = useState<LatLngTuple | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngTuple>(KOLKATA_CENTER);
  const [selectedSignal, setSelectedSignal] = useState<SafetySignal | null>(null);
  const [selectedPendingReport, setSelectedPendingReport] = useState<PendingCommunitySignal | null>(null);
  const [tileError, setTileError] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const displayPosition = emergencyPosition ?? journeyPosition ?? currentPosition;
  const displayLatitude = displayPosition?.[0];
  const displayLongitude = displayPosition?.[1];

  // Reuse the App-level location result; the map never requests permission itself.
  useEffect(() => {
    if (displayLatitude !== undefined && displayLongitude !== undefined) {
      const position: LatLngTuple = [displayLatitude, displayLongitude];
      setUserPosition(position);
      setMapCenter(position);
      return;
    }
    setUserPosition(null);
  }, [displayLatitude, displayLongitude]);

  const focusedPendingReport = pendingReports.find((report) => report.id === focusedPendingReportId) ?? null;

  useEffect(() => {
    if (focusedPendingReport) {
      setSelectedSignal(null);
      setSelectedPendingReport(focusedPendingReport);
      setMapCenter([focusedPendingReport.latitude, focusedPendingReport.longitude]);
    }
  }, [focusedPendingReport]);

  const handleRecenter = () => {
    setRecenterTrigger((n) => n + 1);
  };

  const nearbyCountPosition = displayPosition ?? KOLKATA_CENTER;
  const nearbyCounts = countNearbySafetySignals(nearbyCountPosition, pendingReports);
  const nearbyLocationLabel = displayPosition ? 'near your location' : 'near the Kolkata map start';

  return (
    <div className="safety-map-container">
      <div className="map-status-stack">
        <div className="map-prototype-chip">
          <FileWarning size={13} />
          <span>Demonstration and unverified community data</span>
        </div>

        {walkWithMeActive && (
          <div className="walk-map-status-chip">
            <Footprints size={13} />
            <span>Walk With Me active · Safety signals around your journey</span>
          </div>
        )}

        {emergencyLocationActive && (
          <button type="button" className="emergency-map-status-chip" onClick={onOpenEmergencyToolkit}>
            <LocateFixed size={13} />
            <span>Emergency location active</span>
          </button>
        )}

        {!displayPosition && (locationStatus === 'denied' || locationStatus === 'unavailable' || locationStatus === 'unsupported') && (
          <div className="geo-toast animate-fade-in">
            {locationStatus === 'denied'
              ? 'Location access denied. Centred on Kolkata.'
              : 'Location unavailable. Centred on Kolkata.'}
          </div>
        )}

        {tileError && (
          <div className="tile-error-banner">
            Map tiles could not be loaded. Please check your internet connection.
          </div>
        )}
      </div>

      {/* Map */}
      <MapContainer
        center={KOLKATA_CENTER}
        zoom={DEFAULT_ZOOM}
        className="leaflet-map"
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />

        <TileErrorWatcher onError={() => setTileError(true)} />
        <InitialLocationController position={emergencyPosition ?? currentPosition} />
        <RecenterController center={mapCenter} trigger={recenterTrigger} />
        <PendingReportFocusController report={focusedPendingReport} />
        <JourneyPositionController position={journeyPosition} active={walkWithMeActive} />
        <JourneyPositionController position={emergencyPosition} active={emergencyLocationActive} />

        {/* Demo safety signal markers */}
        {DEMO_SAFETY_SIGNALS.map((signal) => (
          <CircleMarker
            key={signal.id}
            center={[signal.latitude, signal.longitude]}
            radius={12}
            pathOptions={{
              fillColor: SAFETY_SIGNAL_COLORS[signal.riskLevel],
              fillOpacity: 0.85,
              color: MARKER_STROKE_COLOR,
              weight: 2,
            }}
            eventHandlers={{
              click: () => {
                setSelectedPendingReport(null);
                setSelectedSignal(signal);
              },
            }}
          />
        ))}

        {/* User-submitted reports remain visually distinct and unverified. */}
        {pendingReports.map((report) => (
          <React.Fragment key={report.id}>
            {report.id === focusedPendingReportId && (
              <CircleMarker
                center={[report.latitude, report.longitude]}
                radius={19}
                pathOptions={{
                  fillColor: PENDING_REPORT_COLOR,
                  fillOpacity: 0.12,
                  color: PENDING_REPORT_COLOR,
                  opacity: 0.8,
                  weight: 2,
                  dashArray: '4 4',
                }}
              />
            )}
            <CircleMarker
              center={[report.latitude, report.longitude]}
              radius={12}
              pathOptions={{
                fillColor: PENDING_REPORT_COLOR,
                fillOpacity: 0.9,
                color: MARKER_STROKE_COLOR,
                weight: 3,
              }}
              eventHandlers={{
                click: () => {
                  setSelectedSignal(null);
                  setSelectedPendingReport(report);
                },
              }}
            />
          </React.Fragment>
        ))}

        {/* "You are here" marker */}
        {userPosition && (
          <>
            {/* Outer pulse ring */}
            <CircleMarker
              center={userPosition}
              radius={18}
              pathOptions={{
                fillColor: USER_LOCATION_COLOR,
                fillOpacity: 0.15,
                color: USER_LOCATION_COLOR,
                weight: 1.5,
              }}
            />
            {/* Inner dot */}
            <CircleMarker
              center={userPosition}
              radius={7}
              pathOptions={{
                fillColor: USER_LOCATION_COLOR,
                fillOpacity: 1,
                color: MARKER_STROKE_COLOR,
                weight: 2.5,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Floating controls layer */}
      <div className="map-controls">
        <MapLegend />

        <div className="map-controls-right">
          {/* Nearby signal count */}
          <div className="nearby-count-stack">
            <div className="nearby-count-chip">
              <span className="nearby-count-num">{nearbyCounts.demonstration}</span>
              <span>demonstration signals {nearbyLocationLabel}</span>
            </div>
            <div className="nearby-count-chip nearby-count-chip--pending">
              <span className="nearby-count-num">{nearbyCounts.pending}</span>
              <span>pending reports {nearbyLocationLabel}</span>
            </div>
          </div>

          {/* Recenter button */}
          <button type="button" className="map-fab recenter-btn" onClick={handleRecenter} title="Recenter map">
            <Crosshair size={20} />
          </button>

          {/* Report button */}
          <button
            type="button"
            className="map-fab report-btn"
            onClick={onNavigateToReport}
            title="Report an incident"
          >
            <span className="report-fab-icon">+</span>
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Risk details bottom sheet */}
      {selectedSignal && (
        <RiskDetailsSheet signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}
      {selectedPendingReport && (
        <PendingSignalDetailsSheet
          signal={selectedPendingReport}
          onClose={() => {
            setSelectedPendingReport(null);
            if (selectedPendingReport.id === focusedPendingReportId) {
              setMapCenter(displayPosition ?? KOLKATA_CENTER);
              onFocusedPendingReportClose();
            }
          }}
        />
      )}
    </div>
  );
};
