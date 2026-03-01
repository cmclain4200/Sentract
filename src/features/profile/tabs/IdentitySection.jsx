import { useState } from "react";
import FormField from "../components/FormField";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import { X } from "lucide-react";
import { calculateAge } from "../../../lib/enrichment/autoEnrich";

export default function IdentitySection({ profile, update, aiFields }) {
  const id = profile.identity || {};
  const [ageAutoCalc, setAgeAutoCalc] = useState(false);

  function set(field, value) {
    update((p) => ({ ...p, identity: { ...p.identity, [field]: value } }));
  }

  function handleDobChange(dob) {
    const computed = calculateAge(dob);
    if (computed != null) {
      update((p) => ({ ...p, identity: { ...p.identity, date_of_birth: dob, age: computed } }));
      setAgeAutoCalc(true);
    } else {
      set("date_of_birth", dob);
      setAgeAutoCalc(false);
    }
  }

  return (
    <div className="surface p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Full Name *" className="md:col-span-2">
          <input className="form-input" value={id.full_name || ""} onChange={(e) => set("full_name", e.target.value)} placeholder="e.g., Jonathan R. Mercer" />
        </FormField>

        <FormField label="Aliases" className="md:col-span-2">
          {(id.aliases || []).map((alias, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                className="form-input"
                value={alias}
                onChange={(e) => {
                  const next = [...(id.aliases || [])];
                  next[i] = e.target.value;
                  set("aliases", next);
                }}
              />
              <button
                onClick={() => set("aliases", id.aliases.filter((_, j) => j !== i))}
                className="px-2 cursor-pointer"
                style={{ background: "transparent", border: "none", color: "#555" }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <AddBtn label="Add Alias" onClick={() => set("aliases", [...(id.aliases || []), ""])} />
        </FormField>

        <FormField label="Date of Birth">
          <input className="form-input" type="text" value={id.date_of_birth || ""} onChange={(e) => handleDobChange(e.target.value)} placeholder="YYYY-MM-DD or ~YYYY" />
        </FormField>
        <FormField label="Age">
          <input className="form-input" type="number" value={id.age || ""} onChange={(e) => { set("age", e.target.value ? parseInt(e.target.value) : null); setAgeAutoCalc(false); }} />
          {ageAutoCalc && id.age != null && (
            <span className="text-[10px] font-mono mt-1 block" style={{ color: "#555" }}>Auto-calculated from DOB</span>
          )}
        </FormField>
        <FormField label="Nationality">
          <input className="form-input" value={id.nationality || ""} onChange={(e) => set("nationality", e.target.value)} />
        </FormField>
        <FormField label="Gender">
          <SelectField value={id.gender || ""} onChange={(v) => set("gender", v)} options={["male", "female", "other"]} placeholder="Select..." />
        </FormField>
      </div>
    </div>
  );
}
