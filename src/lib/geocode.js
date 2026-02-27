const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// Cache geocoding results so we don't re-query the same address
const cache = new Map();

export async function geocodeAddress(addressString) {
  if (!MAPBOX_TOKEN || !addressString) return null;

  const key = addressString.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key);

  try {
    const encoded = encodeURIComponent(addressString);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    );
    if (!res.ok) return null;
    const data = await res.json();
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
