import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";
import SelectField from "../components/SelectField";
import SourceTag from "../components/SourceTag";

export default function BehavioralSection({ profile, update, aiFields }) {
  const beh = profile.behavioral || {};

  function setRoutine(idx, field, value) {
    update((p) => {
      const next = [...(p.behavioral?.routines || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, behavioral: { ...p.behavioral, routines: next } };
    });
  }
  function removeRoutine(idx) {
    update((p) => ({ ...p, behavioral: { ...p.behavioral, routines: p.behavioral.routines.filter((_, i) => i !== idx) } }));
  }
  function addRoutine() {
    update((p) => ({
      ...p,
      behavioral: { ...p.behavioral, routines: [...(p.behavioral?.routines || []), { name: "", description: "", schedule: "", consistency: null, location: "", data_source: "", notes: "" }] },
    }));
  }

  function setTravel(idx, field, value) {
    update((p) => {
      const next = [...(p.behavioral?.travel_patterns || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, behavioral: { ...p.behavioral, travel_patterns: next } };
    });
  }
  function removeTravel(idx) {
    update((p) => ({ ...p, behavioral: { ...p.behavioral, travel_patterns: p.behavioral.travel_patterns.filter((_, i) => i !== idx) } }));
  }
  function addTravel() {
    update((p) => ({
      ...p,
      behavioral: { ...p.behavioral, travel_patterns: [...(p.behavioral?.travel_patterns || []), { pattern: "", frequency: "", data_source: "", notes: "" }] },
    }));
  }

  function setObs(idx, field, value) {
    update((p) => {
      const next = [...(p.behavioral?.observations || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, behavioral: { ...p.behavioral, observations: next } };
    });
  }
  function removeObs(idx) {
    update((p) => ({ ...p, behavioral: { ...p.behavioral, observations: p.behavioral.observations.filter((_, i) => i !== idx) } }));
  }
  function addObs() {
    update((p) => ({
      ...p,
      behavioral: { ...p.behavioral, observations: [...(p.behavioral?.observations || []), { description: "", exploitability: "", category: "", first_observed: "", data_source: "", notes: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <span className="sub-label block mb-3">Routines</span>
        {(beh.routines || []).map((r, i) => (
          <div key={i} className={`entry-card relative ${r._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={r.data_source} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Name">
                <input className="form-input" value={r.name || ""} onChange={(e) => setRoutine(i, "name", e.target.value)} placeholder="e.g., Morning Run" />
              </FormField>
              <FormField label="Schedule">
                <input className="form-input" value={r.schedule || ""} onChange={(e) => setRoutine(i, "schedule", e.target.value)} placeholder="e.g., Mon-Fri, 6:15 AM" />
              </FormField>
            </div>
            <FormField label="Description" className="mb-3">
              <input className="form-input" value={r.description || ""} onChange={(e) => setRoutine(i, "description", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Consistency (0-100%)">
                <div className="flex items-center gap-3">
                  <input className="form-input" type="number" min="0" max="100" value={r.consistency != null ? Math.round(r.consistency * (r.consistency <= 1 ? 100 : 1)) : ""} onChange={(e) => setRoutine(i, "consistency", e.target.value ? parseFloat(e.target.value) / 100 : null)} />
                  {r.consistency != null && (
                    <div className="w-20 h-1.5 rounded-full shrink-0" style={{ background: "#1a1a1a" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round(r.consistency * (r.consistency <= 1 ? 100 : 1))}%`, background: "#09BC8A" }} />
                    </div>
                  )}
                </div>
              </FormField>
              <FormField label="Location">
                <input className="form-input" value={r.location || ""} onChange={(e) => setRoutine(i, "location", e.target.value)} />
              </FormField>
              <FormField label="Data Source">
                <input className="form-input" value={r.data_source || ""} onChange={(e) => setRoutine(i, "data_source", e.target.value)} placeholder="e.g., Strava" />
              </FormField>
            </div>
            <FormField label="Notes">
              <input className="form-input" value={r.notes || ""} onChange={(e) => setRoutine(i, "notes", e.target.value)} />
            </FormField>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeRoutine(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Routine" onClick={addRoutine} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Travel Patterns</span>
        {(beh.travel_patterns || []).map((t, i) => (
          <div key={i} className={`entry-card relative ${t._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={t.data_source} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Pattern">
                <input className="form-input" value={t.pattern || ""} onChange={(e) => setTravel(i, "pattern", e.target.value)} placeholder="e.g., Weekend trips to Carmel" />
              </FormField>
              <FormField label="Frequency">
                <input className="form-input" value={t.frequency || ""} onChange={(e) => setTravel(i, "frequency", e.target.value)} placeholder="e.g., Every 3-4 weeks" />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Data Source">
                <input className="form-input" value={t.data_source || ""} onChange={(e) => setTravel(i, "data_source", e.target.value)} />
              </FormField>
              <FormField label="Notes">
                <input className="form-input" value={t.notes || ""} onChange={(e) => setTravel(i, "notes", e.target.value)} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeTravel(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Travel Pattern" onClick={addTravel} />
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Observations</span>
        <div className="text-[11px] mb-4" style={{ color: "#555" }}>
          Exploitable behaviors without set schedules (e.g., "Subject uses portable jumpstarter every drive because car is broken")
        </div>
        {(beh.observations || []).map((obs, i) => (
          <div key={i} className={`entry-card relative ${obs._aiExtracted ? "ai-extracted" : ""}`}>
            <SourceTag source={obs.data_source} />
            <FormField label="Description" className="mb-3">
              <textarea className="form-input" rows={2} value={obs.description || ""} onChange={(e) => setObs(i, "description", e.target.value)} placeholder="e.g., Subject uses portable jumpstarter every drive because car is broken" />
            </FormField>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <FormField label="Exploitability">
                <SelectField value={obs.exploitability || ""} onChange={(v) => setObs(i, "exploitability", v)} options={["high", "medium", "low"]} placeholder="Select..." />
              </FormField>
              <FormField label="Category">
                <SelectField value={obs.category || ""} onChange={(v) => setObs(i, "category", v)} options={["physical", "digital", "social", "financial", "operational"]} placeholder="Select..." />
              </FormField>
              <FormField label="First Observed">
                <input className="form-input" type="date" value={obs.first_observed || ""} onChange={(e) => setObs(i, "first_observed", e.target.value)} />
              </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FormField label="Data Source">
                <input className="form-input" value={obs.data_source || ""} onChange={(e) => setObs(i, "data_source", e.target.value)} placeholder="e.g., Physical surveillance" />
              </FormField>
              <FormField label="Notes">
                <input className="form-input" value={obs.notes || ""} onChange={(e) => setObs(i, "notes", e.target.value)} />
              </FormField>
            </div>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeObs(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Observation" onClick={addObs} />
      </div>
    </div>
  );
}
