const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'proton.me', 'tutanota.com',
  'zoho.com', 'yandex.com', 'gmx.com', 'fastmail.com', 'hey.com',
  'live.com', 'msn.com', 'me.com', 'mac.com',
]);

const ENCRYPTED_DOMAINS = new Set([
  'protonmail.com', 'proton.me', 'tutanota.com', 'tutamail.com',
  'ctemplar.com', 'mailfence.com',
]);

export function analyzeEmailDomain(email) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();

  return {
    domain,
    type: PERSONAL_DOMAINS.has(domain) ? 'personal' : 'corporate',
    encrypted: ENCRYPTED_DOMAINS.has(domain),
    orgName: PERSONAL_DOMAINS.has(domain) ? null : domain.split('.')[0],
  };
}

export function calculateAge(dob) {
  if (!dob) return null;
  const yearMatch = dob.match(/(\d{4})/);
  if (!yearMatch) return null;

  const birthYear = parseInt(yearMatch[1]);
  const currentYear = new Date().getFullYear();

  // If full date (YYYY-MM-DD), calculate precisely
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  // Approximate from year only
  return currentYear - birthYear;
}

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

export function formatAddress(addr) {
  if (!addr) return addr;
  const updates = {};

  // Uppercase state abbreviation
  if (addr.state) {
    const upper = addr.state.trim().toUpperCase();
    if (upper.length === 2) {
      updates.state = upper;
    }
  }

  // Title-case city
  if (addr.city) {
    updates.city = addr.city.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Format ZIP
  if (addr.zip) {
    const digits = addr.zip.replace(/\D/g, '');
    if (digits.length === 9) {
      updates.zip = digits.slice(0, 5) + '-' + digits.slice(5);
    } else if (digits.length === 5) {
      updates.zip = digits;
    }
  }

  // Auto-fill country from US state
  if (!addr.country && addr.state) {
    const st = (updates.state || addr.state).toUpperCase();
    if (US_STATES.has(st)) {
      updates.country = 'US';
    }
  }

  return { ...addr, ...updates };
}
