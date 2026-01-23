export type LatLng = { lat: number; lng: number };

export type UserLocation = LatLng & { accuracy: number; ts: number };

const EARTH_RADIUS_M = 6371000;

const toRad = (value: number) => (value * Math.PI) / 180;

export const distanceInMeters = (a: LatLng, b: LatLng): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);

  const h =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

  return EARTH_RADIUS_M * c;
};

export const isWithinRadius = (
  a: LatLng,
  b: LatLng,
  radiusM: number,
): boolean => distanceInMeters(a, b) <= radiusM;
