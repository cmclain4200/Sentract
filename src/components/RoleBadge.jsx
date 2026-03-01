const ROLE_COLORS = {
  org_owner: "#09BC8A",
  team_manager: "#3b82f6",
  analyst: "#f59e0b",
  reviewer: "#8b5cf6",
  client: "#555",
};

const ROLE_LABELS = {
  org_owner: "Owner",
  team_manager: "Manager",
  analyst: "Analyst",
  reviewer: "Reviewer",
  client: "Client",
};

export default function RoleBadge({ roleName, size = "sm" }) {
  const color = ROLE_COLORS[roleName] || "#888";
  const label = ROLE_LABELS[roleName] || roleName;
  const fontSize = size === "sm" ? 10 : 11;
  const padding = size === "sm" ? "1px 6px" : "2px 8px";

  return (
    <span
      className="font-mono font-semibold rounded"
      style={{
        fontSize,
        padding,
        color,
        background: `${color}18`,
        border: `1px solid ${color}35`,
      }}
    >
      {label}
    </span>
  );
}

export { ROLE_COLORS, ROLE_LABELS };
