import { useState, useRef } from "react";
import { Upload, X, FileText, Check, AlertCircle } from "lucide-react";

export default function UploadBar({ uploadState, uploadError, extractionResult, onFileUpload, onApply, onDiscard, onSetState, onClose }) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileUpload(file);
  }

  return (
    <div className="surface p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText size={14} color="#09BC8A" />
          <span className="text-[13px] text-white font-medium">
            Have an existing report? Upload to auto-fill
          </span>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer"
          style={{ background: "transparent", border: "none" }}
        >
          <X size={14} color="#555" />
        </button>
      </div>

      {uploadState === "idle" && (
        <div
          className={`drop-zone ${dragOver ? "drag-over" : ""}`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={20} color="#555" className="mx-auto mb-2" />
          <div className="text-sm" style={{ color: "#888" }}>
            Drag & drop a PDF, Word doc, or text file here
          </div>
          <div className="text-[11px] mt-1" style={{ color: "#444" }}>
            or click to browse
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.csv,.md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {uploadState === "extracting" && (
        <div className="text-center py-6">
          <div className="flex items-center gap-2 justify-center mb-2">
            <span className="pulse-dot" />
            <span className="pulse-dot" />
            <span className="pulse-dot" />
          </div>
          <div className="text-sm" style={{ color: "#888" }}>
            Extracting intelligence from report...
          </div>
        </div>
      )}

      {uploadState === "error" && (
        <div className="p-4 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} color="#ef4444" />
            <span className="text-sm font-medium" style={{ color: "#ef4444" }}>Extraction failed</span>
          </div>
          <div className="text-[12px]" style={{ color: "#888" }}>{uploadError}</div>
          <button
            onClick={() => onSetState("idle")}
            className="mt-3 text-[12px] cursor-pointer"
            style={{ background: "transparent", border: "none", color: "#09BC8A" }}
          >
            Try again
          </button>
        </div>
      )}

      {uploadState === "review" && extractionResult && (
        <div className="p-4 rounded" style={{ background: "#0d0d0d", border: "1px solid #1a1a1a" }}>
          <div className="flex items-center gap-2 mb-3">
            <Check size={14} color="#09BC8A" />
            <span className="text-sm font-medium text-white">Extraction Complete</span>
          </div>
          <div className="text-[12px] mb-3" style={{ color: "#888" }}>
            From: <span style={{ color: "#ccc" }}>{extractionResult.fileName}</span>
          </div>
          <div className="text-[12px] mb-4" style={{ color: "#888" }}>
            Found: {extractionResult.summary.counts.join(" · ")}
          </div>
          <div className="text-[11px] mb-4" style={{ color: "#555" }}>
            All extracted data will be highlighted. Please review for accuracy before saving.
          </div>
          <div className="flex gap-3">
            <button
              onClick={onApply}
              className="px-4 py-2 rounded text-sm font-semibold cursor-pointer"
              style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
            >
              Review & Edit Profile
            </button>
            <button
              onClick={onDiscard}
              className="px-4 py-2 rounded text-sm cursor-pointer"
              style={{ background: "transparent", border: "1px solid #333", color: "#888" }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
