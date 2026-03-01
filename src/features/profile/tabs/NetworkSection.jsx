import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import SourceTag from "../components/SourceTag";
import { RELATIONSHIP_TYPES } from "../../../lib/profileSchema";

export default function NetworkSection({ profile, update, aiFields }) {
  const net = profile.network || {};

  function setFamily(idx, field, value) {
    update((p) => {
      const next = [...(p.network?.family_members || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, network: { ...p.network, family_members: next } };
    });
  }
  function removeFamily(idx) {
    update((p) => ({ ...p, network: { ...p.network, family_members: p.network.family_members.filter((_, i) => i !== idx) } }));
  }
  function addFamily() {
    update((p) => ({
      ...p,
      network: { ...p.network, family_members: [...(p.network?.family_members || []), { name: "", relationship: "", age: null, occupation: "", social_media: [], notes: "", source: "" }] },
    }));
  }

  function setAssoc(idx, field, value) {
    update((p) => {
      const next = [...(p.network?.associates || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, network: { ...p.network, associates: next } };
    });
  }
  function removeAssoc(idx) {
    update((p) => ({ ...p, network: { ...p.network, associates: p.network.associates.filter((_, i) => i !== idx) } }));
  }
  function addAssoc() {
    update((p) => ({
      ...p,
      network: { ...p.network, associates: [...(p.network?.associates || []), { name: "", relationship: "", shared_data_points: [], notes: "", source: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <span className="sub-label block mb-3">Family Members</span>
        {(net.family_members || []).map((fam, i) => (
          <div key={i} className={`entry-card relative ${fam._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={fam.source} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <FormField label="Name" className="md:col-span-2">
                <input className="form-input" value={fam.name || ""} onChange={(e) => setFamily(i, "name", e.target.value)} />
              </FormField>
              <FormField label="Relationship">
                <SelectField value={fam.relationship || ""} onChange={(v) => setFamily(i, "relationship", v)} options={RELATIONSHIP_TYPES} placeholder="Select..." />
              </FormField>
              <FormField label="Age">
                <input className="form-input" type="number" value={fam.age || ""} onChange={(e) => setFamily(i, "age", e.target.value ? parseInt(e.target.value) : null)} />
              </FormField>
            </div>
            <FormField label="Occupation" className="mb-3">
              <input className="form-input" value={fam.occupation || ""} onChange={(e) => setFamily(i, "occupation", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Risk Notes">
                <input className="form-input" value={fam.notes || ""} onChange={(e) => setFamily(i, "notes", e.target.value)} placeholder="e.g., Active Instagram reveals family locations" />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={fam.source || ""} onChange={(e) => setFamily(i, "source", e.target.value)} placeholder="e.g., Spokeo" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeFamily(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Family Member" onClick={addFamily} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Associates</span>
        {(net.associates || []).map((assoc, i) => (
          <div key={i} className={`entry-card relative ${assoc._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={assoc.source} />
            {assoc.source === "auto-synced from linked subject" && (
              <span className="sync-badge" style={{ position: "absolute", top: 8, right: assoc.source ? 140 : 8 }}>&#x21C4; Synced</span>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Name">
                <input className="form-input" value={assoc.name || ""} onChange={(e) => setAssoc(i, "name", e.target.value)} />
              </FormField>
              <FormField label="Relationship">
                <input className="form-input" value={assoc.relationship || ""} onChange={(e) => setAssoc(i, "relationship", e.target.value)} placeholder="e.g., CEO, Apex Maritime" />
              </FormField>
            </div>
            <FormField label="Shared Data Points (comma-separated)" className="mb-3">
              <input className="form-input" value={Array.isArray(assoc.shared_data_points) ? assoc.shared_data_points.join(", ") : ""} onChange={(e) => setAssoc(i, "shared_data_points", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Notes">
                <input className="form-input" value={assoc.notes || ""} onChange={(e) => setAssoc(i, "notes", e.target.value)} />
              </FormField>
              <FormField label="Source">
                <input className="form-input" value={assoc.source || ""} onChange={(e) => setAssoc(i, "source", e.target.value)} placeholder="e.g., LinkedIn" />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeAssoc(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Associate" onClick={addAssoc} />
      </div>
    </div>
  );
}
