import { Trash2 } from "lucide-react";

export default function RemoveBtn({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[11px] cursor-pointer"
      style={{ background: "transparent", border: "none", color: "#555" }}
      onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
      onMouseLeave={(e) => (e.currentTarget.style.color = "#555")}
    >
      <Trash2 size={11} /> Remove
    </button>
  );
}
