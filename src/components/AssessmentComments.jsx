import { useState, useEffect } from "react";
import { MessageSquare, Send, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function AssessmentComments({ assessmentId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!assessmentId) return;
    supabase
      .from("assessment_comments")
      .select("*, profiles:user_id(full_name)")
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments(data || []));
  }, [assessmentId]);

  async function addComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !assessmentId) return;
    setSending(true);

    const { data, error } = await supabase
      .from("assessment_comments")
      .insert({
        assessment_id: assessmentId,
        content: newComment.trim(),
        comment_type: "note",
      })
      .select("*, profiles:user_id(full_name)")
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, data]);
      setNewComment("");
    }
    setSending(false);
  }

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 cursor-pointer"
        style={{ background: "transparent", border: "none" }}
      >
        <MessageSquare size={12} color="#555" />
        <span className="text-[11px] font-mono" style={{ color: "#555" }}>
          Comments {comments.length > 0 && `(${comments.length})`}
        </span>
        <ChevronDown
          size={10}
          color="#555"
          style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}
        />
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 fade-in">
          {comments.map((c) => (
            <div
              key={c.id}
              className="px-3 py-2 rounded"
              style={{
                background: "#0d0d0d",
                border: `1px solid ${c.comment_type === "rejection_reason" ? "rgba(239,68,68,0.2)" : "#1a1a1a"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-semibold" style={{ color: "#ccc" }}>
                  {c.profiles?.full_name || "Unknown"}
                </span>
                {c.comment_type !== "note" && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      color: c.comment_type === "rejection_reason" ? "#ef4444" : "#09BC8A",
                      background: c.comment_type === "rejection_reason" ? "rgba(239,68,68,0.1)" : "rgba(9,188,138,0.1)",
                    }}
                  >
                    {c.comment_type === "rejection_reason" ? "REJECTION" : "APPROVAL"}
                  </span>
                )}
                <span className="text-[10px] font-mono" style={{ color: "#444" }}>
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-[12px]" style={{ color: "#888" }}>{c.content}</div>
            </div>
          ))}

          <form onSubmit={addComment} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 text-[12px] px-3 py-2 rounded outline-none"
              style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", color: "#ccc" }}
              onFocus={(e) => (e.target.style.borderColor = "#333")}
              onBlur={(e) => (e.target.style.borderColor = "#1e1e1e")}
            />
            <button
              type="submit"
              disabled={sending || !newComment.trim()}
              className="flex items-center gap-1 text-[11px] px-3 py-2 rounded cursor-pointer"
              style={{
                background: newComment.trim() ? "#09BC8A" : "#1a1a1a",
                color: newComment.trim() ? "#0a0a0a" : "#555",
                border: "none",
              }}
            >
              <Send size={10} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
