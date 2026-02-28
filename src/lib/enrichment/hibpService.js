import { supabase } from '../supabase';

const isDev = import.meta.env.DEV;

// Rate limiter — max 1 request per 1.5 seconds
let lastRequestTime = 0;

async function rateLimitedCall(email) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1500) {
    await new Promise((resolve) => setTimeout(resolve, 1500 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  if (isDev) {
    // In dev, call HIBP API directly with the client-side key
    const hibpKey = import.meta.env.VITE_HIBP_API_KEY;
    if (!hibpKey) return { error: 'no_api_key', message: 'HIBP API key not configured' };

    const resp = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
      {
        headers: {
          'hibp-api-key': hibpKey,
          'User-Agent': 'Sentract-Security-Platform',
        },
      }
    );

    if (resp.status === 404) return { found: false, breaches: [] };
    if (resp.status === 429) return { error: 'rate_limited', message: 'Rate limited. Try again in a few seconds.' };
    if (!resp.ok) return { error: 'network_error', message: `HIBP returned ${resp.status}` };

    const breaches = await resp.json();
    if (!Array.isArray(breaches) || breaches.length === 0) return { found: false, breaches: [] };
    return { found: true, breaches };
  }

  // Production: use Vercel serverless proxy
  const response = await fetch(`/api/hibp?email=${encodeURIComponent(email)}`);

  if (response.status === 429) {
    return { error: 'rate_limited', message: 'Rate limited. Try again in a few seconds.' };
  }

  if (!response.ok) {
    return { error: 'network_error', message: 'Breach check failed' };
  }

  const breaches = await response.json();

  if (!Array.isArray(breaches) || breaches.length === 0) {
    return { found: false, breaches: [] };
  }

  return { found: true, breaches };
}

export function hasHibpKey() {
  if (isDev) return !!import.meta.env.VITE_HIBP_API_KEY;
  return true; // In production, the proxy has the key
}

export async function checkEmailBreaches(email) {
  if (!hasHibpKey()) {
    return { error: 'no_api_key', message: 'HIBP API key not configured' };
  }

  if (!email || !email.includes('@')) {
    return { error: 'invalid_email', message: 'Invalid email address' };
  }

  try {
    const data = await rateLimitedCall(email);

    if (data.error) {
      return data;
    }

    if (!data.found) {
      return { breaches: [], found: false };
    }

    const enrichedBreaches = data.breaches.map((breach) => ({
      breach_name: `${breach.Name} (${new Date(breach.BreachDate).getFullYear()})`,
      date: breach.BreachDate,
      email_exposed: email,
      data_types: breach.DataClasses || [],
      severity: classifyBreachSeverity(breach),
      notes: `${breach.PwnCount?.toLocaleString() || 'Unknown'} accounts affected. ${breach.Description ? stripHtml(breach.Description).slice(0, 150) : ''}`,
      source: 'HaveIBeenPwned',
      hibp_name: breach.Name,
    }));

    return { breaches: enrichedBreaches, found: true, count: enrichedBreaches.length };
  } catch (err) {
    return { error: 'network_error', message: err.message };
  }
}

function classifyBreachSeverity(breach) {
  const classes = (breach.DataClasses || []).map((d) => d.toLowerCase());

  if (classes.some((c) => c.includes('password') && !c.includes('hash'))) return 'high';
  if (classes.some((c) => c.includes('password'))) return 'high';
  if (classes.some((c) => c.includes('credit card') || c.includes('financial'))) return 'high';
  if (classes.some((c) => c.includes('phone') || c.includes('address') || c.includes('ssn'))) return 'high';
  if (classes.some((c) => c.includes('email'))) return 'medium';
  return 'low';
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '');
}

export async function checkMultipleEmails(emails, onProgress) {
  const results = {};
  for (let i = 0; i < emails.length; i++) {
    if (onProgress) onProgress(i, emails.length, emails[i]);
    results[emails[i]] = await checkEmailBreaches(emails[i]);
  }
  if (onProgress) onProgress(emails.length, emails.length, null);
  return results;
}

export function isDuplicateBreach(existingBreaches, newBreach) {
  return existingBreaches.some((existing) => {
    const existingName = existing.breach_name?.toLowerCase().replace(/\s*\(\d{4}\)\s*/g, '');
    const newName =
      newBreach.hibp_name?.toLowerCase() ||
      newBreach.breach_name?.toLowerCase().replace(/\s*\(\d{4}\)\s*/g, '');
    return existingName === newName && existing.email_exposed === newBreach.email_exposed;
  });
}
