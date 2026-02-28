// Centralized API helper — uses direct calls in dev, Vercel proxy in production.
// Keys never touch the browser in production builds.

const isDev = import.meta.env.DEV;

// ── Anthropic (Claude) ──

export async function callAnthropic({ model, max_tokens, messages, system, stream, signal }) {
  const devKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

  if (isDev && devKey) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": devKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: max_tokens || 4096,
        messages,
        system: system || undefined,
        stream: stream || undefined,
      }),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API error ${response.status}: ${errBody}`);
    }

    if (stream) return response;
    return response.json();
  }

  // Production: use serverless proxy
  const response = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens, messages, system, stream }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  if (stream) return response;
  return response.json();
}

export function hasAnthropicKey() {
  if (isDev) return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
  return true; // In production, the proxy has the key
}

// ── HIBP (HaveIBeenPwned) ──

export async function checkBreaches(email) {
  const devKey = import.meta.env.VITE_HIBP_API_KEY;

  if (isDev && devKey) {
    // In dev, call via Supabase edge function (existing behavior)
    return null; // Returning null signals hibpService to use its existing Supabase edge function path
  }

  // Production: use serverless proxy
  const response = await fetch(`/api/hibp?email=${encodeURIComponent(email)}`);

  if (response.status === 429) {
    throw new Error("Rate limited. Wait a few seconds and try again.");
  }

  if (!response.ok) {
    throw new Error("Breach check failed");
  }

  return response.json();
}

export function hasHibpApiKey() {
  if (isDev) return !!import.meta.env.VITE_HIBP_API_KEY;
  return true;
}

// ── Mapbox Geocoding ──

export async function geocodeQuery(query, types) {
  const devToken = import.meta.env.VITE_MAPBOX_TOKEN;

  if (isDev && devToken) {
    const typesParam = types ? `&types=${encodeURIComponent(types)}` : "";
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${devToken}&limit=1${typesParam}`
    );
    if (!response.ok) return null;
    return response.json();
  }

  // Production: use serverless proxy
  const params = new URLSearchParams({ query });
  if (types) params.set("types", types);
  const response = await fetch(`/api/geocode?${params}`);

  if (!response.ok) return null;
  return response.json();
}

export function hasGeocodingAccess() {
  if (isDev) return !!import.meta.env.VITE_MAPBOX_TOKEN;
  return true;
}

// ── OpenCorporates ──

export async function searchCompanyApi(query) {
  if (isDev) {
    // In dev, call OpenCorporates directly (no key needed)
    const response = await fetch(
      `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&per_page=5`
    );
    if (!response.ok) return null;
    return response.json();
  }

  // Production: use serverless proxy
  const response = await fetch(`/api/company?query=${encodeURIComponent(query)}`);
  if (!response.ok) return null;
  return response.json();
}

export async function getCompanyDetailsApi(jurisdictionCode, companyNumber) {
  if (isDev) {
    const response = await fetch(
      `https://api.opencorporates.com/v0.4/companies/${jurisdictionCode.toLowerCase()}/${companyNumber}`
    );
    if (!response.ok) return null;
    return response.json();
  }

  const response = await fetch(
    `/api/company?jurisdiction=${encodeURIComponent(jurisdictionCode)}&number=${encodeURIComponent(companyNumber)}`
  );
  if (!response.ok) return null;
  return response.json();
}
