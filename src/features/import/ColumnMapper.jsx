import { useState, useMemo } from "react";

const PROFILE_FIELDS = [
  { value: "skip", label: "Skip" },
  { value: "identity.full_name", label: "Full Name" },
  { value: "identity.aliases", label: "Aliases" },
  { value: "identity.date_of_birth", label: "Date of Birth" },
  { value: "identity.nationality", label: "Nationality" },
  { value: "professional.title", label: "Title / Role" },
  { value: "professional.organization", label: "Organization" },
  { value: "professional.industry", label: "Industry" },
  { value: "contact.email", label: "Email Address" },
  { value: "contact.phone", label: "Phone Number" },
  { value: "locations.street", label: "Street Address" },
  { value: "locations.city", label: "City" },
  { value: "locations.state", label: "State" },
  { value: "locations.zip", label: "Zip Code" },
  { value: "locations.country", label: "Country" },
  { value: "digital.platform", label: "Social Platform" },
  { value: "digital.handle", label: "Social Handle / URL" },
  { value: "notes.general", label: "Notes" },
];

function autoSuggest(header) {
  const h = header.toLowerCase().replace(/[_\- ]/g, "");
  const map = {
    fullname: "identity.full_name", name: "identity.full_name", subjectname: "identity.full_name",
    email: "contact.email", emailaddress: "contact.email",
    phone: "contact.phone", phonenumber: "contact.phone",
    title: "professional.title", jobtitle: "professional.title", role: "professional.title",
    organization: "professional.organization", company: "professional.organization", employer: "professional.organization",
    city: "locations.city", state: "locations.state", zip: "locations.zip", zipcode: "locations.zip",
    address: "locations.street", street: "locations.street",
    country: "locations.country",
    dob: "identity.date_of_birth", dateofbirth: "identity.date_of_birth",
    nationality: "identity.nationality",
    notes: "notes.general",
  };
  return map[h] || "skip";
}

export default function ColumnMapper({ headers, sampleRow, mapping, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 mb-2">
        <div className="text-[11px] font-mono" style={{ color: "#555" }}>SOURCE COLUMN</div>
        <div className="text-[11px] font-mono" style={{ color: "#555" }}>MAP TO FIELD</div>
      </div>
      {headers.map((header, idx) => (
        <div key={idx} className="grid grid-cols-2 gap-3 items-center">
          <div>
            <div className="text-[13px] text-white">{header}</div>
            {sampleRow?.[idx] && (
              <div className="text-[11px] font-mono truncate" style={{ color: "#555" }}>
                e.g., {sampleRow[idx]}
              </div>
            )}
          </div>
          <select
            value={mapping[idx] || "skip"}
            onChange={(e) => onChange(idx, e.target.value)}
            className="text-[12px] font-mono cursor-pointer outline-none"
            style={{ background: "#111", border: "1px solid #1e1e1e", color: "#888", padding: "6px 8px", borderRadius: 4 }}
          >
            {PROFILE_FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export { autoSuggest };
