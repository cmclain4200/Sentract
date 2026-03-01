import { Plus } from "lucide-react";

export default function AddBtn({ label, onClick }) {
  return (
    <button className="add-entry-btn" onClick={onClick}>
      <Plus size={13} className="inline mr-1" style={{ verticalAlign: "-2px" }} />
      {label}
    </button>
  );
}
