import { useState, useEffect } from "react";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useOrg } from "../contexts/OrgContext";

export default function ApprovalBadge({ onClick }) {
  const { can, isOrgOwner } = useOrg();
  const [count, setCount] = useState(0);

  const showBadge = can("approve_assessment") || isOrgOwner();

  useEffect(() => {
    if (!showBadge) return;
    supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .then(({ count: c }) => {
        if (c != null) setCount(c);
      });
  }, [showBadge]);

  if (!showBadge || count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center justify-center rounded cursor-pointer"
      style={{ background: "transparent", border: "none", width: 36, height: 36 }}
      title={`${count} assessment${count !== 1 ? "s" : ""} pending review`}
    >
      <ClipboardCheck size={16} color="#f59e0b" />
      <span
        className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full"
        style={{ width: 16, height: 16, background: "#f59e0b", color: "#0a0a0a" }}
      >
        {count > 9 ? "9+" : count}
      </span>
    </button>
  );
}
