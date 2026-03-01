import { useOrg } from "../contexts/OrgContext";

export default function TeamSelector({ value, onChange, className = "" }) {
  const { myTeams } = useOrg();
  const teams = myTeams();

  if (teams.length <= 1) return null;

  return (
    <div className={className}>
      <label className="sub-label block mb-2">Team</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded text-[15px] text-white outline-none"
        style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", padding: "10px 14px", minHeight: 44 }}
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
