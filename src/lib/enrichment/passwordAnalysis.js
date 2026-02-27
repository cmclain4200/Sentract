export function analyzeCredentialRisk(profileData) {
  const breaches = profileData.breaches?.records || [];
  const emails = profileData.contact?.email_addresses || [];

  if (breaches.length === 0) return null;

  const findings = [];

  // 1. Password exposure across multiple breaches
  const passwordBreaches = breaches.filter((b) =>
    b.data_types?.some((dt) => dt.toLowerCase().includes('password'))
  );

  if (passwordBreaches.length >= 2) {
    findings.push({
      type: 'credential_reuse_risk',
      severity: 'critical',
      title: 'Multi-Breach Password Exposure',
      detail: `Passwords exposed in ${passwordBreaches.length} separate breaches (${passwordBreaches.map((b) => b.breach_name).join(', ')}). High probability of credential reuse across services. Credential stuffing attacks are likely to succeed.`,
      aegis_impact: passwordBreaches.length * 5,
    });
  } else if (passwordBreaches.length === 1) {
    findings.push({
      type: 'single_password_exposure',
      severity: 'high',
      title: 'Password Exposed in Breach',
      detail: `Password exposed in ${passwordBreaches[0].breach_name}. If the subject reuses passwords, all accounts using this credential are compromised.`,
      aegis_impact: 8,
    });
  }

  // 2. Password hints
  const hintBreaches = breaches.filter(
    (b) =>
      b.data_types?.some((dt) => dt.toLowerCase().includes('hint')) ||
      b.notes?.toLowerCase().includes('hint')
  );

  if (hintBreaches.length > 0) {
    findings.push({
      type: 'password_hint_exposed',
      severity: 'high',
      title: 'Password Hint Available',
      detail: `Password hints exposed in ${hintBreaches.map((b) => b.breach_name).join(', ')}. Hints often reveal the password pattern (e.g., "college + year", "pet name + numbers"). Enables targeted guessing attacks.`,
      aegis_impact: 10,
    });
  }

  // 3. Plaintext password exposure
  const plaintextBreaches = breaches.filter((b) =>
    b.data_types?.some((dt) => {
      const lower = dt.toLowerCase();
      return (
        lower === 'passwords' ||
        lower === 'plaintext passwords' ||
        (lower.includes('password') && !lower.includes('hash') && !lower.includes('encrypt'))
      );
    })
  );

  if (plaintextBreaches.length > 0) {
    findings.push({
      type: 'plaintext_password',
      severity: 'critical',
      title: 'Plaintext Password Exposed',
      detail: `Plaintext (unhashed) passwords exposed in ${plaintextBreaches.map((b) => b.breach_name).join(', ')}. These require zero effort to exploit — no cracking needed.`,
      aegis_impact: 15,
    });
  }

  // 4. Email + phone combo (SIM swap risk)
  const phoneBreaches = breaches.filter((b) =>
    b.data_types?.some((dt) => dt.toLowerCase().includes('phone'))
  );
  const emailBreaches = breaches.filter((b) =>
    b.data_types?.some((dt) => dt.toLowerCase().includes('email'))
  );

  if (phoneBreaches.length > 0 && emailBreaches.length > 0) {
    findings.push({
      type: 'sim_swap_risk',
      severity: 'high',
      title: 'SIM Swap Attack Risk',
      detail: `Both email and phone number exposed in breaches. This combination enables SIM swap attacks — an attacker ports the phone number to their device, then uses SMS-based 2FA to access email and financial accounts.`,
      aegis_impact: 12,
    });
  }

  // 5. Corporate email in breaches
  const personalDomains = new Set([
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
    'icloud.com', 'protonmail.com', 'proton.me',
  ]);
  const corporateEmails = emails.filter((e) => {
    const domain = e.address?.split('@')[1]?.toLowerCase();
    return domain && !personalDomains.has(domain);
  });

  const corpEmailsInBreaches = corporateEmails.filter((corpEmail) =>
    breaches.some((b) => b.email_exposed?.toLowerCase() === corpEmail.address?.toLowerCase())
  );

  if (corpEmailsInBreaches.length > 0) {
    findings.push({
      type: 'corporate_credential_risk',
      severity: 'high',
      title: 'Corporate Email Compromised',
      detail: `Corporate email${corpEmailsInBreaches.length > 1 ? 's' : ''} (${corpEmailsInBreaches.map((e) => e.address).join(', ')}) found in breach data. If corporate SSO or email passwords overlap with breached credentials, organizational systems may be accessible.`,
      aegis_impact: 10,
    });
  }

  // 6. Temporal analysis — recent breaches
  const recentBreaches = breaches.filter((b) => {
    const year = parseInt(b.date?.match(/(\d{4})/)?.[1]);
    return year && year >= 2022;
  });

  if (recentBreaches.length > 0) {
    findings.push({
      type: 'recent_exposure',
      severity: 'warning',
      title: 'Recent Breach Exposure',
      detail: `${recentBreaches.length} breach${recentBreaches.length > 1 ? 'es' : ''} from 2022 or later (${recentBreaches.map((b) => b.breach_name).join(', ')}). Recent breaches have higher exploitation probability — data has not yet been widely circulated or rotated.`,
      aegis_impact: recentBreaches.length * 3,
    });
  }

  // 7. Total exposure surface
  const allExposedDataTypes = new Set();
  breaches.forEach((b) => b.data_types?.forEach((dt) => allExposedDataTypes.add(dt.toLowerCase())));

  if (allExposedDataTypes.size >= 5) {
    findings.push({
      type: 'broad_data_exposure',
      severity: 'warning',
      title: 'Broad Personal Data Exposure',
      detail: `Across all breaches, ${allExposedDataTypes.size} distinct data types are exposed: ${Array.from(allExposedDataTypes).join(', ')}. This breadth of data enables highly personalized social engineering attacks.`,
      aegis_impact: 5,
    });
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, warning: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    findings,
    total_breaches: breaches.length,
    password_exposed: passwordBreaches.length > 0,
    total_risk_contribution: findings.reduce((sum, f) => sum + (f.aegis_impact || 0), 0),
  };
}
