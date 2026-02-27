const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export function hasMapboxToken() {
  return !!MAPBOX_TOKEN;
}

export async function geocodeAddress(address) {
  if (!MAPBOX_TOKEN) return null;

  const query = [address.street, address.city, address.state, address.zip, address.country]
    .filter(Boolean)
    .join(', ');

  if (!query || query.length < 5) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1&types=address,place`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return {
        coordinates: [lng, lat],
        formatted_address: data.features[0].place_name,
        confidence: data.features[0].relevance,
      };
    }

    return null;
  } catch {
    return null;
  }
}
