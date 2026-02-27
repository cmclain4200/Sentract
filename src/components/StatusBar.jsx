import { useAuth } from "../contexts/AuthContext";

export default function StatusBar() {
  const { profile } = useAuth();

  return (
    <div
      className="h-7 flex items-center justify-between px-4 shrink-0"
      style={{ background: "#080808", borderTop: "1px solid #1a1a1a" }}
    >
      <div className="flex items-center gap-4">
        <span className="text-[10px] font-mono" style={{ color: "#444" }}>
          {profile?.organization || "Sentract"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span
            className="w-[5px] h-[5px] rounded-full"
            style={{ background: "#10b981" }}
          />
          <span className="text-[10px] font-mono" style={{ color: "#444" }}>
            Connected
          </span>
        </span>
        <span className="text-[10px] font-mono" style={{ color: "#333" }}>
          v1.0.0
        </span>
      </div>
    </div>
  );
}
