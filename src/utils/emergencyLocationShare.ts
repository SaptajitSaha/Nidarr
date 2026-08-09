import type { EmergencyPosition } from '../types/emergency';

const formatCoordinate = (coordinate: number) => coordinate.toFixed(6);

export const createEmergencyMapLink = (position: EmergencyPosition) => {
  const latitude = formatCoordinate(position.latitude);
  const longitude = formatCoordinate(position.longitude);
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
};

export const createEmergencyLocationShareText = (position: EmergencyPosition) => {
  const latitude = formatCoordinate(position.latitude);
  const longitude = formatCoordinate(position.longitude);
  const accuracy = Math.max(0, Math.round(position.accuracy));
  const timestamp = new Date(position.capturedAt).toLocaleString();

  return [
    'Nidarr emergency location snapshot',
    `Coordinates: ${latitude}, ${longitude}`,
    `Accuracy: approximately ${accuracy} metres`,
    `Captured: ${timestamp}`,
    createEmergencyMapLink(position),
    'This is a location snapshot, not a continuously updating tracking link.',
  ].join('\n');
};
