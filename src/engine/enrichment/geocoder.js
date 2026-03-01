import { geocodeQuery, hasGeocodingAccess } from "../../lib/api";

export function hasMapboxToken() {
  return hasGeocodingAccess();
}

export async function geocodeAddress(address) {
  if (!hasGeocodingAccess()) return null;

  const query = [address.street, address.city, address.state, address.zip, address.country]
    .filter(Boolean)
    .join(', ');

  if (!query || query.length < 5) return null;

  try {
    const data = await geocodeQuery(query, "address,place");
    if (!data) return null;

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
