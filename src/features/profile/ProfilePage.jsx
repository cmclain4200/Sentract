import { useState, useEffect, useCallback, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { Check, Search, Zap } from "lucide-react";
import SectionHeader from "../../components/common/SectionHeader";
import { EMPTY_PROFILE } from "../../lib/profileSchema";
import { calculateCompleteness } from "../../lib/profileCompleteness";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/Toast";
import { deepMerge } from "./utils";
import useAutoSave from "./hooks/useAutoSave";
import useEnrichment from "./hooks/useEnrichment";
import useFileUpload from "./hooks/useFileUpload";
import KeyExposures from "./components/KeyExposures";
import EnrichmentStatusLines from "./components/EnrichmentStatusLines";
import UploadBar from "./components/UploadBar";
import BatchEnrichModal from "./components/BatchEnrichModal";
import IdentitySection from "./tabs/IdentitySection";
import ProfessionalSection from "./tabs/ProfessionalSection";
import LocationsSection from "./tabs/LocationsSection";
import DigitalSection from "./tabs/DigitalSection";
import BreachesSection from "./tabs/BreachesSection";
import NetworkSection from "./tabs/NetworkSection";
import PublicRecordsSection from "./tabs/PublicRecordsSection";
import BehavioralSection from "./tabs/BehavioralSection";
import NotesSection from "./tabs/NotesSection";

const TABS = [
  { key: "identity", label: "Identity" },
  { key: "professional", label: "Professional" },
  { key: "locations", label: "Locations & Contact" },
  { key: "digital", label: "Digital Footprint" },
  { key: "breaches", label: "Breaches" },
  { key: "network", label: "Network" },
  { key: "public_records", label: "Public Records" },
  { key: "behavioral", label: "Behavioral" },
  { key: "notes", label: "Notes" },
];

export default function ProfilePage() {
  const { caseData, subjects, subject, refreshSubject } = useOutletContext();
  const { user } = useAuth();
  const { showToast, ToastContainer } = useToast();

  const [profile, setProfile] = useState(() => {
    const base = JSON.parse(JSON.stringify(EMPTY_PROFILE));
    if (subject?.profile_data && Object.keys(subject.profile_data).length > 0) {
      return deepMerge(base, subject.profile_data);
    }
    return base;
  });
  const [activeTab, setActiveTab] = useState("identity");
  const [aiFields, setAiFields] = useState(new Set());
  const [showUpload, setShowUpload] = useState(true);
  const [showBatchEnrich, setShowBatchEnrich] = useState(false);

  // Hooks
  const { saveStatus, autoSave, flushSave, updateRef } = useAutoSave(subject?.id, user?.id, showToast);
  const { enriching, setEnriching, runAll } = useEnrichment();
  const { uploadState, uploadError, extractionResult, handleFileUpload, applyExtraction, discardExtraction, reset: resetUpload, setUploadState } = useFileUpload();

  // Reset all state when subject changes
  useEffect(() => {
    const base = JSON.parse(JSON.stringify(EMPTY_PROFILE));
    if (subject?.profile_data && Object.keys(subject.profile_data).length > 0) {
      setProfile(deepMerge(base, subject.profile_data));
    } else {
      setProfile(base);
    }
    setAiFields(new Set());
    setShowUpload(true);
    setShowBatchEnrich(false);
    resetUpload();
  }, [subject?.id]);

  // Keep ref in sync so beforeunload can access latest
  useEffect(() => { updateRef(profile); }, [profile]);

  const completeness = calculateCompleteness(profile);
  const emailCount = (profile.contact?.email_addresses || []).filter((e) => e.address).length;

  const updateProfile = useCallback((updater) => {
    setProfile((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      autoSave(next, subject);
      return next;
    });
  }, [autoSave, subject]);

  async function handleSaveNow() {
    await flushSave(profile, refreshSubject);
  }

  function handleApplyExtraction() {
    applyExtraction(profile, setProfile, setAiFields, autoSave, setActiveTab);
  }

  async function handleRunAll() {
    if (enriching) return;
    setEnriching(true);
    try {
      const result = await runAll(profile, updateProfile);
      showToast(result.summary);
    } catch {
      showToast("Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  if (!subject) {
    return (
      <div className="p-8 fade-in">
        <SectionHeader label="Subject Profile" title="Profile" />
        <div className="surface p-6 text-center">
          <p className="text-sm" style={{ color: "#666" }}>
            No subject selected. Create a subject to start building a profile.
          </p>
        </div>
      </div>
    );
  }

  const compColor = completeness.score >= 70 ? "#10b981" : completeness.score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="p-8 fade-in">
      {/* Header: Name + Completeness + Save */}
      <div className="flex items-start justify-between mb-6">
        <SectionHeader label="Subject Profile" title={profile.identity?.full_name || subject.name || "Profile"} />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold" style={{ color: compColor }}>{completeness.score}%</span>
            <div className="w-24 h-1.5 rounded-full" style={{ background: "#1a1a1a" }}>
              <div className="h-full rounded-full bar-transition" style={{ width: `${completeness.score}%`, background: compColor }} />
            </div>
          </div>
          {saveStatus === "saving" && (
            <span className="text-[12px] font-mono" style={{ color: "#555" }}>Saving...</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[12px] font-mono flex items-center gap-1" style={{ color: "#09BC8A" }}>
              <Check size={12} /> Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[12px] font-mono" style={{ color: "#ef4444" }}>Save failed</span>
          )}
          <button
            onClick={handleSaveNow}
            className="px-4 py-2 rounded text-sm font-semibold cursor-pointer"
            style={{ background: "#09BC8A", color: "#0a0a0a", border: "none" }}
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Key Exposures + Enrichment Panel */}
      {(emailCount > 0 || (profile.locations?.addresses || []).length > 0 || (profile.digital?.social_accounts || []).length > 0) && (
        <div className="surface p-4 mb-6">
          <div className="flex items-start gap-6">
            <KeyExposures profile={profile} />
            {/* Enrichment Status side */}
            <div className="shrink-0 flex flex-col items-end gap-1" style={{ borderLeft: "1px solid #1e1e1e", paddingLeft: 24 }}>
              <span className="text-[10px] font-mono mb-1" style={{ color: "#555" }}>ENRICHMENT STATUS</span>
              <EnrichmentStatusLines profile={profile} />
              <div className="flex gap-2 mt-2">
                {emailCount > 0 && (
                  <button
                    onClick={() => setShowBatchEnrich(true)}
                    className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all"
                    style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#09BC8A" }}
                  >
                    <Search size={11} /> Check Breaches
                  </button>
                )}
                <button
                  onClick={handleRunAll}
                  disabled={enriching}
                  className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded cursor-pointer transition-all"
                  style={{ background: "transparent", border: "1px solid #2a2a2a", color: enriching ? "#555" : "#09BC8A" }}
                >
                  {enriching ? (
                    <><span className="generating-spinner" style={{ width: 10, height: 10, borderWidth: 1.5 }} /> Running...</>
                  ) : (
                    <><Zap size={11} /> Run All</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Bar */}
      {showUpload && (
        <UploadBar
          uploadState={uploadState}
          uploadError={uploadError}
          extractionResult={extractionResult}
          onFileUpload={handleFileUpload}
          onApply={handleApplyExtraction}
          onDiscard={discardExtraction}
          onSetState={setUploadState}
          onClose={() => setShowUpload(false)}
        />
      )}

      {/* Tab Bar */}
      <div className="profile-tabs mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`profile-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Batch Enrichment Modal */}
      {showBatchEnrich && (
        <BatchEnrichModal
          profile={profile}
          update={updateProfile}
          onClose={() => setShowBatchEnrich(false)}
        />
      )}

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "identity" && <IdentitySection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "professional" && <ProfessionalSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "locations" && <LocationsSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "digital" && <DigitalSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "breaches" && <BreachesSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "network" && <NetworkSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "public_records" && <PublicRecordsSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "behavioral" && <BehavioralSection profile={profile} update={updateProfile} aiFields={aiFields} />}
        {activeTab === "notes" && <NotesSection profile={profile} update={updateProfile} />}
      </div>
      <ToastContainer />
    </div>
  );
}
