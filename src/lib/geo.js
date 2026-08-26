import { BRAZIL_CITIES } from './cities';

const cityIndex = new Map(BRAZIL_CITIES.map((c) => [`${c.city}, ${c.uf}`, c]));

// Looks up a "Cidade, UF" string (as stored in profiles.location) against
// the known city list to get its centroid coordinates.
export const findCityCoords = (cityUf) => cityIndex.get(cityUf) || null;

// Great-circle distance between two coordinates, in kilometers.
export const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Whether `otherLocation` falls within `radiusKm` of `originLocation`
// (both "Cidade, UF" strings). Unknown/blank locations are treated as a
// match — we only filter people out when we can actually compute a
// distance, never hide someone just because geodata is missing.
export const isWithinRadius = (originLocation, otherLocation, radiusKm) => {
  if (!radiusKm || !originLocation || !otherLocation) return true;
  const origin = findCityCoords(originLocation);
  const other = findCityCoords(otherLocation);
  if (!origin || !other) return true;
  return distanceKm(origin.lat, origin.lng, other.lat, other.lng) <= radiusKm;
};
