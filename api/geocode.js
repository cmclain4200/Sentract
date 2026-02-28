export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.MAPBOX_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "Mapbox token not configured" });
  }

  const { query, types } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query parameter required" });
  }

  try {
    const typesParam = types ? `&types=${encodeURIComponent(types)}` : "";
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=1${typesParam}`
    );

    if (!response.ok) {
      return res.status(response.status).json({ error: "Geocoding request failed" });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error("Geocode proxy error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
