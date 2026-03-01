export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function parseLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export function mapCSVToProfiles(rows, headers, mapping) {
  return rows.map((row) => {
    // First pass: collect flat field values by section
    const flat = {};
    for (const [colIdx, field] of Object.entries(mapping)) {
      if (!field || field === "skip") continue;
      const value = row[parseInt(colIdx)] || "";
      if (!value) continue;

      const parts = field.split(".");
      if (parts.length === 2) {
        const [section, key] = parts;
        if (!flat[section]) flat[section] = {};
        flat[section][key] = value;
      } else {
        flat[field] = value;
      }
    }

    // Second pass: build profile in the structure ProfilePage expects
    const profile = {};

    // Identity
    if (flat.identity) {
      profile.identity = {};
      if (flat.identity.full_name) profile.identity.full_name = flat.identity.full_name;
      if (flat.identity.date_of_birth) profile.identity.date_of_birth = flat.identity.date_of_birth;
      if (flat.identity.nationality) profile.identity.nationality = flat.identity.nationality;
      if (flat.identity.aliases) {
        profile.identity.aliases = flat.identity.aliases
          .split(/[,;]/)
          .map((a) => a.trim())
          .filter(Boolean);
      }
    }

    // Professional
    if (flat.professional) {
      profile.professional = {};
      if (flat.professional.title) profile.professional.title = flat.professional.title;
      if (flat.professional.organization) profile.professional.organization = flat.professional.organization;
      if (flat.professional.industry) profile.professional.industry = flat.professional.industry;
    }

    // Contact — convert flat email/phone into structured arrays
    if (flat.contact) {
      profile.contact = {};
      if (flat.contact.email) {
        profile.contact.email_addresses = [
          { type: "personal", address: flat.contact.email, source: "Import" },
        ];
      }
      if (flat.contact.phone) {
        profile.contact.phone_numbers = [
          { type: "personal", number: flat.contact.phone, source: "Import" },
        ];
      }
    }

    // Locations — convert flat street/city/state/zip/country into addresses array
    if (flat.locations) {
      const addr = {};
      if (flat.locations.street) addr.street = flat.locations.street;
      if (flat.locations.city) addr.city = flat.locations.city;
      if (flat.locations.state) addr.state = flat.locations.state;
      if (flat.locations.zip) addr.zip = flat.locations.zip;
      if (flat.locations.country) addr.country = flat.locations.country;
      if (Object.keys(addr).length > 0) {
        profile.locations = {
          addresses: [{ type: "home", ...addr, source: "Import", confidence: "unverified" }],
        };
      }
    }

    // Digital — convert flat platform/handle into social_accounts array
    if (flat.digital) {
      if (flat.digital.platform || flat.digital.handle) {
        profile.digital = {
          social_accounts: [
            {
              platform: flat.digital.platform || "Other",
              username: flat.digital.handle || "",
              source: "Import",
            },
          ],
        };
      }
    }

    // Notes
    if (flat.notes) {
      profile.notes = {};
      if (flat.notes.general) profile.notes.general = flat.notes.general;
    }

    return profile;
  });
}
