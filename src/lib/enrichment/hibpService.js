import { supabase } from '../supabase';

const HIBP_API_KEY = import.meta.env.VITE_HIBP_API_KEY;

// Rate limiter — max 1 request per 1.5 seconds
let lastRequestTime = 0;

async function rateLimitedCall(email) {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1500) {
    await new Promise((resolve) => setTimeout(resolve, 1500 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();

  const { data, error } = await supabase.functions.invoke('hibp-proxy', {
    body: { email, hibp_api_key: HIBP_API_KEY },
  });

  if (error) {
    // Edge function invocation error
    return { error: 'network_error', message: error.message || 'Edge function call failed' };
  }

  return data;
}

export function hasHibpKey() {
  return !!HIBP_API_KEY;
}

export async function checkEmailBreaches(email) {
  if (!HIBP_API_KEY) {
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
