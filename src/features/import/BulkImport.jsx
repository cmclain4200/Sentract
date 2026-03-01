import { useState, useMemo } from "react";
import { X, Upload, FileText, Check, AlertCircle, ChevronRight } from "lucide-react";
import { parseCSV, mapCSVToProfiles } from "./parsers/csvParser";
import { parseJSONImport, mapGenericToProfile } from "./parsers/jsonParser";
import ColumnMapper, { autoSuggest } from "./ColumnMapper";
import { supabase } from "../../lib/supabase";

const STEPS = ["Upload", "Map", "Preview", "Import"];

export default function BulkImport({ isOpen, onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [fileType, setFileType] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [profiles, setProfiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [targetCaseId, setTargetCaseId] = useState("new");
  const [newCaseName, setNewCaseName] = useState("Imported Data");
  const [cases, setCases] = useState([]);

  useState(() => {
    supabase.from("cases").select("id, name").order("created_at", { ascending: false }).then(({ data }) => {
      if (data) setCases(data);
    });
  });

  function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const ext = file.name.split(".").pop().toLowerCase();

      if (ext === "csv") {
        setFileType("csv");
        const parsed = parseCSV(text);
        setRawData(parsed);
        // Auto-suggest mappings
        const autoMap = {};
        parsed.headers.forEach((h, i) => {
          autoMap[i] = autoSuggest(h);
        });
        setMapping(autoMap);
        setStep(1);
      } else if (ext === "json") {
        setFileType("json");
        try {
          const parsed = parseJSONImport(text);
          if (parsed.type === "sentract") {
            setProfiles(parsed.profiles);
            setStep(2);
          } else {
            setRawData({ headers: Object.keys(parsed.records[0] || {}), rows: parsed.records.map((r) => Object.values(r)), raw: parsed.records });
            const autoMap = {};
            Object.keys(parsed.records[0] || {}).forEach((h, i) => {
              autoMap[i] = autoSuggest(h);
            });
            setMapping(autoMap);
            setStep(1);
          }
        } catch {
          setRawData({ error: "Invalid JSON" });
        }
      }
    };
    reader.readAsText(file);
  }

  function handleMapComplete() {
    if (fileType === "csv" && rawData) {
      const mapped = mapCSVToProfiles(rawData.rows, rawData.headers, mapping);
      setProfiles(mapped);
    } else if (fileType === "json" && rawData?.raw) {
      setProfiles(rawData.raw.map(mapGenericToProfile));
    }
    setStep(2);
  }

  async function handleImport() {
    setImporting(true);
    try {
      let caseId = targetCaseId;
      if (targetCaseId === "new") {
        const { data: newCase } = await supabase.from("cases").insert({ name: newCaseName, type: "CI" }).select().single();
        if (newCase) caseId = newCase.id;
      }

      let created = 0;
      for (const profile of profiles) {
        const name = profile.identity?.full_name || profile.name || `Import ${created + 1}`;
        const { error } = await supabase.from("subjects").insert({
          case_id: caseId,
          name,
          profile_data: profile,
        });
        if (!error) created++;
      }

      setImportResult({ created, total: profiles.length, caseId });
      setStep(3);
    } catch (err) {
      setImportResult({ error: err.message });
    }
    setImporting(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="surface w-full max-w-2xl max-h-[80vh] flex flex-col fade-in" style={{ padding: "28px 32px" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <span className="section-label text-[10px]">Bulk Import</span>
            <h2 className="text-white text-[18px] font-semibold mt-1">Import Subjects</h2>
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ background: "transparent", border: "none" }}>
            <X size={16} color="#555" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{
                background: i <= step ? "rgba(9,188,138,0.1)" : "#111",
                color: i <= step ? "#09BC8A" : "#555",
                border: `1px solid ${i <= step ? "rgba(9,188,138,0.3)" : "#1e1e1e"}`,
              }}>
                {i < step ? "\u2713" : i + 1}. {s}
              </span>
              {i < STEPS.length - 1 && <ChevronRight size={12} color="#333" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Step 0: Upload */}
          {step === 0 && (
            <div
              className="drop-zone"
              onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer?.files?.[0]; if (file) handleFile(file); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".csv,.json";
                input.onchange = (e) => { const file = e.target.files?.[0]; if (file) handleFile(file); };
                input.click();
              }}
            >
              <Upload size={24} color="#555" className="mx-auto mb-3" />
              <div className="text-sm" style={{ color: "#888" }}>Drop a CSV or JSON file here</div>
              <div className="text-[11px] mt-1" style={{ color: "#444" }}>or click to browse</div>
            </div>
          )}

          {/* Step 1: Map columns */}
          {step === 1 && rawData && !rawData.error && (
            <div>
              <div className="text-[13px] mb-4" style={{ color: "#888" }}>
                Map source columns to Sentract profile fields
              </div>
              <ColumnMapper
                headers={rawData.headers}
                sampleRow={rawData.rows?.[0]}
                mapping={mapping}
                onChange={(idx, val) => setMapping((m) => ({ ...m, [idx]: val }))}
              />
              <button onClick={handleMapComplete} className="mt-6 w-full py-2.5 rounded text-sm font-semibold cursor-pointer" style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}>
                Continue to Preview
              </button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div>
              <div className="text-[13px] mb-4" style={{ color: "#888" }}>
                {profiles.length} subject{profiles.length !== 1 ? "s" : ""} ready to import
              </div>
              <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
                {profiles.slice(0, 20).map((p, i) => (
                  <div key={i} className="p-3 rounded" style={{ background: "#111", border: "1px solid #1a1a1a" }}>
                    <div className="text-[13px] text-white">{p.identity?.full_name || p.name || `Subject ${i + 1}`}</div>
                    <div className="text-[11px]" style={{ color: "#555" }}>
                      {[p.professional?.title, p.professional?.organization, p.contact?.email_addresses?.[0]?.address || p.contact?.email].filter(Boolean).join(" \u00b7 ")}
                    </div>
                  </div>
                ))}
                {profiles.length > 20 && (
                  <div className="text-[11px] text-center" style={{ color: "#555" }}>...and {profiles.length - 20} more</div>
                )}
              </div>

              <div className="mb-4">
                <label className="sub-label block mb-2">Import Into</label>
                <select
                  value={targetCaseId}
                  onChange={(e) => setTargetCaseId(e.target.value)}
                  className="w-full text-[13px] outline-none"
                  style={{ background: "#111", border: "1px solid #1e1e1e", color: "#ccc", padding: "8px 12px", borderRadius: 6 }}
                >
                  <option value="new">Create New Case</option>
                  {cases.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {targetCaseId === "new" && (
                <div className="mb-4">
                  <label className="sub-label block mb-2">Case Name</label>
                  <input
                    className="form-input"
                    value={newCaseName}
                    onChange={(e) => setNewCaseName(e.target.value)}
                  />
                </div>
              )}

              <button onClick={handleImport} disabled={importing} className="w-full py-2.5 rounded text-sm font-semibold cursor-pointer" style={{ background: importing ? "#1a1a1a" : "#09BC8A", color: importing ? "#555" : "#0a0a0a", border: "none" }}>
                {importing ? "Importing..." : `Import ${profiles.length} Subject${profiles.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && importResult && (
            <div className="text-center py-8">
              {importResult.error ? (
                <>
                  <AlertCircle size={32} color="#ef4444" className="mx-auto mb-3" />
                  <div className="text-[15px] text-white font-semibold mb-2">Import Failed</div>
                  <div className="text-[13px]" style={{ color: "#888" }}>{importResult.error}</div>
                </>
              ) : (
                <>
                  <Check size={32} color="#09BC8A" className="mx-auto mb-3" />
                  <div className="text-[15px] text-white font-semibold mb-2">Import Complete</div>
                  <div className="text-[13px]" style={{ color: "#888" }}>
                    Created {importResult.created} of {importResult.total} subjects
                  </div>
                  <button onClick={() => { onComplete?.(importResult.caseId); onClose(); }} className="mt-6 px-6 py-2.5 rounded text-sm font-semibold cursor-pointer" style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}>
                    View Case
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
