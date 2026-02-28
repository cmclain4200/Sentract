import { geocodeQuery, hasGeocodingAccess } from "./api";

// Cache geocoding results so we don't re-query the same address
const cache = new Map();

// Strip internal building designators (floor, suite, unit, apt, room)
// that confuse geocoders — these are irrelevant to street-level coordinates
function normalizeAddressForGeocoding(address) {
  if (!address) return address;
  return address
    .replace(/\b(\d+)(st|nd|rd|th)\s+floor\b/gi, '')
    .replace(/\bfloor\s*\d+\b/gi, '')
    .replace(/\bfl\.?\s*\d+\b/gi, '')
    .replace(/\bsuite\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\bste\.?\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\bunit\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\bapt\.?\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\bapartment\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\broom\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\brm\.?\s*[#]?\s*[\w-]+\b/gi, '')
    .replace(/\bbldg\.?\s*[\w-]+\b/gi, '')
    .replace(/\bbuilding\s*[\w-]+\b/gi, '')
    .replace(/\b#\s*[\w-]+\b/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/,\s*$/, '')
    .trim();
}

export async function geocodeAddress(addressString) {
  if (!hasGeocodingAccess() || !addressString) return null;

  const normalized = normalizeAddressForGeocoding(addressString);
  if (!normalized) return null;

  const key = normalized.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const data = await geocodeQuery(normalized);
    if (!data) return null;
    const feature = data.features?.[0];
    if (!feature) return null;

    const result = {
      lng: feature.center[0],
      lat: feature.center[1],
      place_name: feature.place_name,
    };
    cache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export async function geocodeProfileLocations(profileData) {
  if (!profileData) return [];
  const results = [];

  // Geocode addresses
  const addresses = profileData.locations?.addresses || [];
  for (const addr of addresses) {
    const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ');
    if (!parts) continue;
    const geo = await geocodeAddress(parts);
    if (geo) {
      results.push({
        label: `${(addr.type || 'address').toUpperCase()}: ${parts}`,
        type: addr.type || 'unknown',
        address: parts,
        lng: geo.lng,
        lat: geo.lat,
        source: addr.source,
        confidence: addr.confidence,
      });
    }
  }

  // Geocode property records
  const properties = profileData.public_records?.properties || [];
  for (const prop of properties) {
    if (!prop.address) continue;
    const geo = await geocodeAddress(prop.address);
    if (geo) {
      results.push({
        label: `PROPERTY: ${prop.address}`,
        type: 'property',
        address: prop.address,
        lng: geo.lng,
        lat: geo.lat,
        source: 'public_records',
      });
    }
  }

  // Geocode organization if we have enough info
  const org = profileData.professional?.organization;
  const orgCity = profileData.locations?.addresses?.find(a => a.type === 'work');
  if (org && orgCity) {
    const parts = [org, orgCity.city, orgCity.state].filter(Boolean).join(', ');
    const geo = await geocodeAddress(parts);
    if (geo) {
      results.push({
        label: `WORKPLACE: ${org}`,
        type: 'work',
        address: parts,
        lng: geo.lng,
        lat: geo.lat,
        source: 'professional',
      });
    }
  }

  return results;
}

export function formatGeocodedLocations(locations) {
  if (!locations.length) return '';
  const lines = ['GEOCODED COORDINATES (use these exact coordinates in the scenario JSON):'];
  locations.forEach((loc, i) => {
    lines.push(`  ${i + 1}. ${loc.label}`);
    lines.push(`     Coordinates: [${loc.lng.toFixed(6)}, ${loc.lat.toFixed(6)}] (longitude, latitude)`);
  });
  return lines.join('\n');
}

// Deduplicate key_locations that are within ~50 meters of each other.
// Snaps later locations to the coordinates of the first nearby match.
const DEDUP_THRESHOLD = 0.0005; // ~50m in lat/lng degrees

export function deduplicateKeyLocations(locations) {
  if (!locations?.length) return locations;
  return locations.map((loc, i) => {
    if (!loc.coordinates) return loc;
    const [lng, lat] = loc.coordinates;
    for (let j = 0; j < i; j++) {
      const prev = locations[j];
      if (!prev.coordinates) continue;
      const [pLng, pLat] = prev.coordinates;
      if (Math.abs(lng - pLng) < DEDUP_THRESHOLD && Math.abs(lat - pLat) < DEDUP_THRESHOLD) {
        return { ...loc, coordinates: prev.coordinates };
      }
    }
    return loc;
  });
}
