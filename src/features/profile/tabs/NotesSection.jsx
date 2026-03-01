import FormField from "../components/FormField";
import RemoveBtn from "../components/RemoveBtn";
import AddBtn from "../components/AddBtn";

export default function NotesSection({ profile, update }) {
  const notes = profile.notes || {};

  function setGeneral(value) {
    update((p) => ({ ...p, notes: { ...p.notes, general: value } }));
  }

  function setSource(idx, field, value) {
    update((p) => {
      const next = [...(p.notes?.raw_sources || [])];
      next[idx] = { ...next[idx], [field]: value };
      return { ...p, notes: { ...p.notes, raw_sources: next } };
    });
  }
  function removeSource(idx) {
    update((p) => ({ ...p, notes: { ...p.notes, raw_sources: p.notes.raw_sources.filter((_, i) => i !== idx) } }));
  }
  function addSource() {
    update((p) => ({
      ...p,
      notes: { ...p.notes, raw_sources: [...(p.notes?.raw_sources || []), { source: "", url: "", notes: "" }] },
    }));
  }

  return (
    <div className="space-y-6">
      <div className="surface p-6">
        <FormField label="General Notes">
          <textarea
            className="form-input"
            rows={6}
            value={notes.general || ""}
            onChange={(e) => setGeneral(e.target.value)}
            placeholder="Free-form notes, observations, analysis..."
          />
        </FormField>
      </div>

      <div className="surface p-6">
        <span className="sub-label block mb-3">Source References</span>
        {(notes.raw_sources || []).map((src, i) => (
          <div key={i} className="entry-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <FormField label="Source">
                <input className="form-input" value={src.source || ""} onChange={(e) => setSource(i, "source", e.target.value)} placeholder="e.g., Spokeo search — Feb 20, 2026" />
              </FormField>
              <FormField label="URL">
                <input className="form-input" value={src.url || ""} onChange={(e) => setSource(i, "url", e.target.value)} />
              </FormField>
            </div>
            <FormField label="Notes">
              <input className="form-input" value={src.notes || ""} onChange={(e) => setSource(i, "notes", e.target.value)} />
            </FormField>
            <div className="mt-2 flex justify-end">
              <RemoveBtn onClick={() => removeSource(i)} />
            </div>
          </div>
        ))}
        <AddBtn label="Add Source" onClick={addSource} />
      </div>
    </div>
  );
}
