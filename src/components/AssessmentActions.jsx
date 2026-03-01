import { useState } from "react";
import { Send, Check, X, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../contexts/OrgContext";
import { useAuth } from "../contexts/AuthContext";

export default function AssessmentActions({ assessment, onUpdate, onDelete }) {
  const { can, isRole, isOrgOwner } = useOrg();
  const { user } = useAuth();
  const [rejectNotes, setRejectNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const status = assessment?.status || "draft";

  async function updateStatus(newStatus, extra = {}) {
    if (!assessment?.id) return;
    setLoading(true);
    const updates = { status: newStatus, ...extra };
    if (newStatus === "submitted") updates.submitted_at = new Date().toISOString();
    if (newStatus === "approved" || newStatus === "rejected") {
      updates.reviewer_id = user.id;
      updates.reviewed_at = new Date().toISOString();
    }
    if (newStatus === "published") updates.published_at = new Date().toISOString();

    const { error } = await supabase
      .from("assessments")
      .update(updates)
      .eq("id", assessment.id);

    if (!error && onUpdate) {
      onUpdate({ ...assessment, ...updates });
    }
    setLoading(false);
    setShowRejectInput(false);
    setRejectNotes("");
  }

  async function handleDelete() {
    if (!assessment?.id) return;
    await supabase.from("assessments").delete().eq("id", assessment.id);
    if (onDelete) onDelete(assessment.id);
  }

  const canReview = can("approve_assessment") || isOrgOwner();
  const canPublish = can("publish_assessment") || isOrgOwner();
  const isAnalystRole = isRole("analyst");

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Analyst: draft → submit */}
      {status === "draft" && (isAnalystRole || can("run_assessment")) && (
        <button
          onClick={() => updateStatus("submitted")}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
          style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b" }}
        >
          <Send size={11} />
          Submit for Review
        </button>
      )}

      {/* Analyst: rejected → resubmit */}
      {status === "rejected" && (isAnalystRole || can("run_assessment")) && (
        <button
          onClick={() => updateStatus("submitted")}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
          style={{ background: "transparent", border: "1px solid #f59e0b", color: "#f59e0b" }}
        >
          <RotateCcw size={11} />
          Resubmit
        </button>
      )}

      {/* Submitted: show pending for non-reviewers */}
      {status === "submitted" && !canReview && (
        <span className="text-[11px] px-3 py-1.5 rounded" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
          Pending Review
        </span>
      )}

      {/* Reviewer: submitted → approve/reject */}
      {status === "submitted" && canReview && (
        <>
          <button
            onClick={() => updateStatus("approved")}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
            style={{ background: "transparent", border: "1px solid #09BC8A", color: "#09BC8A" }}
          >
            <Check size={11} />
            Approve
          </button>
          {showRejectInput ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Reason for rejection..."
                autoFocus
                className="text-[11px] px-2 py-1.5 rounded outline-none"
                style={{ background: "#0d0d0d", border: "1px solid #333", color: "#ccc", width: 200 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && rejectNotes.trim()) {
                    updateStatus("rejected", { reviewer_notes: rejectNotes.trim() });
                  }
                  if (e.key === "Escape") setShowRejectInput(false);
                }}
              />
              <button
                onClick={() => {
                  if (rejectNotes.trim()) updateStatus("rejected", { reviewer_notes: rejectNotes.trim() });
                }}
                disabled={!rejectNotes.trim() || loading}
                className="text-[11px] px-2 py-1.5 rounded cursor-pointer"
                style={{ background: "#ef4444", color: "#fff", border: "none", opacity: rejectNotes.trim() ? 1 : 0.5 }}
              >
                Reject
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowRejectInput(true)}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
              style={{ background: "transparent", border: "1px solid #ef4444", color: "#ef4444" }}
            >
              <X size={11} />
              Reject
            </button>
          )}
        </>
      )}

      {/* Reviewer/Owner: approved → publish */}
      {status === "approved" && canPublish && (
        <button
          onClick={() => updateStatus("published")}
          disabled={loading}
          className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded cursor-pointer transition-all"
          style={{ background: "#3b82f6", color: "#fff", border: "none" }}
        >
          <Check size={11} />
          Publish
        </button>
      )}

      {/* Rejection notes display */}
      {status === "rejected" && assessment.reviewer_notes && (
        <div className="text-[11px] px-3 py-1.5 rounded" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
          Reviewer: {assessment.reviewer_notes}
        </div>
      )}

      {/* Delete (always available if has permission) */}
      {can("delete_assessment") && onDelete && (
        <button
          onClick={handleDelete}
          className="text-[10px] p-1.5 rounded cursor-pointer"
          style={{ background: "transparent", border: "1px solid #333", color: "#555" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#555"; }}
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
