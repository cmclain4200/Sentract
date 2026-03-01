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
    const profile = {};
    for (const [colIdx, field] of Object.entries(mapping)) {
      if (!field || field === "skip") continue;
      const value = row[parseInt(colIdx)] || "";
      if (!value) continue;

      const parts = field.split(".");
      if (parts.length === 2) {
        const [section, key] = parts;
        if (!profile[section]) profile[section] = {};
        profile[section][key] = value;
      } else {
        profile[field] = value;
      }
    }
    return profile;
  });
}
