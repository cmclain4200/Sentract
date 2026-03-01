export const MITRE_TECHNIQUES = {
  T1589: { name: "Gather Victim Identity Info", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1589/" },
  "T1589.001": { name: "Credentials", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1589/001/" },
  "T1589.002": { name: "Email Addresses", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1589/002/" },
  T1593: { name: "Search Open Websites/Domains", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1593/" },
  "T1593.001": { name: "Social Media", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1593/001/" },
  T1598: { name: "Phishing for Information", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1598/" },
  T1591: { name: "Gather Victim Org Information", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1591/" },
  "T1591.004": { name: "Identify Roles", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1591/004/" },
  T1592: { name: "Gather Victim Host Information", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1592/" },
  T1594: { name: "Search Victim-Owned Websites", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1594/" },
  T1595: { name: "Active Scanning", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1595/" },
  T1590: { name: "Gather Victim Network Information", tactic: "Reconnaissance", url: "https://attack.mitre.org/techniques/T1590/" },
  T1566: { name: "Phishing", tactic: "Initial Access", url: "https://attack.mitre.org/techniques/T1566/" },
  "T1566.001": { name: "Spearphishing Attachment", tactic: "Initial Access", url: "https://attack.mitre.org/techniques/T1566/001/" },
  "T1566.002": { name: "Spearphishing Link", tactic: "Initial Access", url: "https://attack.mitre.org/techniques/T1566/002/" },
  T1078: { name: "Valid Accounts", tactic: "Persistence", url: "https://attack.mitre.org/techniques/T1078/" },
  T1114: { name: "Email Collection", tactic: "Collection", url: "https://attack.mitre.org/techniques/T1114/" },
  T1213: { name: "Data from Information Repositories", tactic: "Collection", url: "https://attack.mitre.org/techniques/T1213/" },
  T1530: { name: "Data from Cloud Storage", tactic: "Collection", url: "https://attack.mitre.org/techniques/T1530/" },
  T1565: { name: "Data Manipulation", tactic: "Impact", url: "https://attack.mitre.org/techniques/T1565/" },
  T1499: { name: "Endpoint Denial of Service", tactic: "Impact", url: "https://attack.mitre.org/techniques/T1499/" },
  T1199: { name: "Trusted Relationship", tactic: "Initial Access", url: "https://attack.mitre.org/techniques/T1199/" },
  T1534: { name: "Internal Spearphishing", tactic: "Lateral Movement", url: "https://attack.mitre.org/techniques/T1534/" },
  T1656: { name: "Impersonation", tactic: "Defense Evasion", url: "https://attack.mitre.org/techniques/T1656/" },
};

const PHASE_KEYWORDS = {
  T1589: ["identity", "personal info", "name", "dob", "date of birth", "alias", "pii"],
  "T1589.001": ["credential", "password", "login", "breach", "compromised account"],
  "T1589.002": ["email", "e-mail", "inbox", "mail"],
  T1593: ["osint", "open source", "google", "search engine", "public record", "web search"],
  "T1593.001": ["social media", "facebook", "twitter", "linkedin", "instagram", "tiktok", "social account"],
  T1598: ["phish", "pretext", "social engineer", "elicit", "lure"],
  T1591: ["organization", "company", "employer", "corporate", "business"],
  "T1591.004": ["role", "title", "position", "executive", "ceo", "cto", "director"],
  T1592: ["device", "phone", "laptop", "computer", "host"],
  T1594: ["website", "domain", "web presence", "site"],
  T1595: ["scan", "probe", "enumerate", "port"],
  T1590: ["network", "ip address", "infrastructure"],
  T1566: ["phishing", "spear", "malicious email", "link"],
  "T1566.001": ["attachment", "malware", "payload", "document"],
  "T1566.002": ["link", "url", "click", "redirect"],
  T1078: ["account", "credential", "valid account", "stolen credential", "breach data", "reuse"],
  T1114: ["email collection", "inbox", "mail harvest", "email access"],
  T1213: ["repository", "sharepoint", "wiki", "document store", "cloud docs"],
  T1530: ["cloud storage", "s3", "cloud", "bucket", "drive"],
  T1565: ["manipulat", "tamper", "alter", "forge", "falsif"],
  T1499: ["denial", "dos", "disrupt", "overwhelm"],
  T1199: ["trust", "vendor", "third party", "partner", "supplier"],
  T1534: ["internal", "lateral", "pivot", "inside"],
  T1656: ["impersonat", "pretend", "pose as", "disguise", "fake identity"],
};

function matchKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export function mapPhasesToMitre(phases) {
  if (!phases || !Array.isArray(phases)) return phases;
  return phases.map((phase) => {
    const text = `${phase.name || ""} ${phase.narrative || ""} ${phase.key_vulnerability || ""}`;
    const techniques = [];
    const seen = new Set();
    for (const [id, keywords] of Object.entries(PHASE_KEYWORDS)) {
      if (matchKeywords(text, keywords) && !seen.has(id)) {
        seen.add(id);
        const tech = MITRE_TECHNIQUES[id];
        if (tech) techniques.push({ id, name: tech.name, tactic: tech.tactic });
      }
    }
    return { ...phase, mitre_techniques: techniques };
  });
}

export function mapVulnerabilitiesToMitre(vulnerabilities) {
  if (!vulnerabilities || !Array.isArray(vulnerabilities)) return vulnerabilities;
  return vulnerabilities.map((vuln) => {
    const text = `${vuln.title || ""} ${vuln.risk_mechanism || ""} ${vuln.data_exposed || ""}`;
    const techniques = [];
    const seen = new Set();
    for (const [id, keywords] of Object.entries(PHASE_KEYWORDS)) {
      if (matchKeywords(text, keywords) && !seen.has(id)) {
        seen.add(id);
        const tech = MITRE_TECHNIQUES[id];
        if (tech) techniques.push({ id, name: tech.name, tactic: tech.tactic });
      }
    }
    return { ...vuln, mitre_techniques: techniques };
  });
}

export function collectAllMitreTechniques(phases, vulnerabilities) {
  const byTactic = {};
  const seen = new Set();
  const allItems = [...(phases || []), ...(vulnerabilities || [])];
  for (const item of allItems) {
    for (const t of item.mitre_techniques || []) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      if (!byTactic[t.tactic]) byTactic[t.tactic] = [];
      byTactic[t.tactic].push(t);
    }
  }
  return byTactic;
}
