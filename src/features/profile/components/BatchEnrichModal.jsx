import { useState, useMemo } from "react";
import { X, Check } from "lucide-react";
import { checkMultipleEmails, hasHibpKey, isDuplicateBreach } from "../../../lib/enrichment/hibpService";

export default function BatchEnrichModal({ profile, update, onClose }) {
  const emails = useMemo(() => {
    return (profile.contact?.email_addresses || [])
      .filter((e) => e.address)
      .map((e) => e.address);
  }, [profile]);

  const [state, setState] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0, email: null });
  const [results, setResults] = useState(null);
  const [addedBreaches, setAddedBreaches] = useState(new Set());
  const existingBreaches = profile.breaches?.records || [];

  async function handleRun() {
    if (!hasHibpKey()) {
      setResults({ error: "no_api_key" });
      setState("done");
      return;
    }
    setState("running");
    const res = await checkMultipleEmails(emails, (current, total, email) => {
      setProgress({ current, total, email });
    });
    setResults(res);
    setState("done");

    update((p) => {
      const next = [...(p.contact?.email_addresses || [])];
      for (let i = 0; i < next.length; i++) {
        const addr = next[i].address;
        if (addr && res[addr]) {
          const r = res[addr];
          if (!r.error) {
            next[i] = {
              ...next[i],
              enrichment: {
                last_checked: new Date().toISOString(),
                breaches_found: r.found ? r.count : 0,
                status: "checked",
              },
            };
          }
        }
      }
      return { ...p, contact: { ...p.contact, email_addresses: next } };
    });
  }

  function addBreach(breach) {
    update((p) => ({
      ...p,
      breaches: { ...p.breaches, records: [...(p.breaches?.records || []), breach] },
    }));
    setAddedBreaches((prev) => new Set([...prev, breach.hibp_name + breach.email_exposed]));
  }

  function addAllNew() {
    if (!results) return;
    for (const email of Object.keys(results)) {
      const r = results[email];
      if (r.breaches) {
        for (const b of r.breaches) {
          const key = b.hibp_name + b.email_exposed;
          if (!isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(key)) {
            update((p) => ({
              ...p,
              breaches: { ...p.breaches, records: [...(p.breaches?.records || []), b] },
            }));
            setAddedBreaches((prev) => new Set([...prev, key]));
          }
        }
      }
    }
  }

  const newBreachCount = useMemo(() => {
    if (!results) return 0;
    let count = 0;
    for (const email of Object.keys(results)) {
      const r = results[email];
      if (r.breaches) {
        for (const b of r.breaches) {
          if (!isDuplicateBreach(existingBreaches, b) && !addedBreaches.has(b.hibp_name + b.email_exposed)) {
            count++;
          }
        }
      }
    }
    return count;
  }, [results, existingBreaches, addedBreaches]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="surface p-6 w-full max-w-xl max-h-[80vh] flex flex-col fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div>
            <span className="section-label text-[10px]">Batch Breach Enrichment</span>
          </div>
          <button onClick={onClose} className="p-1 cursor-pointer" style={{ background: "transparent", border: "none" }}>
            <X size={16} color="#555" />
          </button>
        </div>

        {state === "idle" && (
          <div>
            <div className="text-[13px] mb-4" style={{ color: "#888" }}>
              Check <span className="text-white">{emails.length}</span> email address{emails.length !== 1 ? "es" : ""} against HaveIBeenPwned breach database.
            </div>
            <div className="space-y-1 mb-5">
              {emails.map((e) => (
                <div key={e} className="text-[12px] font-mono" style={{ color: "#666" }}>{e}</div>
              ))}
            </div>
            <button
              onClick={handleRun}
              className="w-full py-2.5 rounded text-sm font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
            >
              Check All Breaches
            </button>
          </div>
        )}

        {state === "running" && (
          <div className="py-8 text-center">
            <div className="flex items-center gap-2 justify-center mb-3">
              <span className="pulse-dot" /><span className="pulse-dot" /><span className="pulse-dot" />
            </div>
            <div className="text-[13px] mb-2" style={{ color: "#888" }}>
              Checking email {progress.current + 1} of {progress.total}...
            </div>
            {progress.email && (
              <div className="text-[11px] font-mono mb-3" style={{ color: "#555" }}>{progress.email}</div>
            )}
            <div className="w-48 mx-auto h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
                  background: "#09BC8A",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div className="text-[10px] mt-2" style={{ color: "#444" }}>Rate limited: ~2 sec per email</div>
          </div>
        )}

        {state === "done" && results && (
          <div className="flex-1 overflow-y-auto min-h-0">
            {results.error === "no_api_key" ? (
              <div className="p-4 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
                <div className="text-[13px] mb-2" style={{ color: "#888" }}>Breach lookup requires a HaveIBeenPwned API key.</div>
                <div className="text-[12px]" style={{ color: "#555" }}>$3.50/month — haveibeenpwned.com/API/Key</div>
                <div className="text-[11px] mt-1" style={{ color: "#444" }}>Add as VITE_HIBP_API_KEY in configuration.</div>
              </div>
            ) : (
              <>
                <div className="text-[12px] mb-4" style={{ color: "#888" }}>
                  Checked {emails.length} email address{emails.length !== 1 ? "es" : ""}:
                </div>
                <div className="space-y-4">
                  {emails.map((emailAddr) => {
                    const r = results[emailAddr];
                    if (!r) return null;
                    if (r.error) {
                      return (
                        <div key={emailAddr}>
                          <div className="text-[13px] font-mono text-white mb-1">{emailAddr}</div>
                          <div className="text-[11px]" style={{ color: "#ef4444" }}>Error: {r.message}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={emailAddr}>
                        <div className="text-[13px] font-mono text-white mb-1">
                          {emailAddr} — {r.found ? `${r.count} breach${r.count > 1 ? "es" : ""} found` : "no breaches found"}
                        </div>
                        {r.breaches && r.breaches.length > 0 && (
                          <div className="ml-3 space-y-1">
                            {r.breaches.map((b) => {
                              const key = b.hibp_name + b.email_exposed;
                              const isExisting = isDuplicateBreach(existingBreaches, b);
                              const isAdded = addedBreaches.has(key);
                              return (
                                <div key={b.hibp_name} className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono" style={{ color: "#333" }}>|--</span>
                                  <span className="text-[12px] flex-1" style={{ color: "#ccc" }}>
                                    {b.breach_name} — <span style={{ color: "#666" }}>{(b.data_types || []).slice(0, 4).join(", ")}</span>
                                  </span>
                                  {isExisting || isAdded ? (
                                    <span className="text-[10px] font-mono" style={{ color: "#555" }}>Added</span>
                                  ) : (
                                    <button
                                      onClick={() => addBreach(b)}
                                      className="text-[10px] font-mono shrink-0 cursor-pointer"
                                      style={{ background: "transparent", border: "none", color: "#09BC8A" }}
                                    >
                                      + Add
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!r.found && (
                          <div className="ml-3 flex items-center gap-1.5">
                            <Check size={11} color="#10b981" />
                            <span className="text-[11px]" style={{ color: "#10b981" }}>Clean</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {newBreachCount > 0 && (
                  <button
                    onClick={addAllNew}
                    className="mt-5 w-full py-2.5 rounded text-sm font-semibold cursor-pointer"
                    style={{ background: "transparent", border: "1px solid rgba(9, 188, 138,0.3)", color: "#09BC8A" }}
                  >
                    Add All New to Profile ({newBreachCount})
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
