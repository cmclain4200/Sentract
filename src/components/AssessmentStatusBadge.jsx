const STATUS_CONFIG = {
  draft: { label: "Draft", color: "#555" },
  submitted: { label: "Pending Review", color: "#f59e0b" },
  approved: { label: "Approved", color: "#09BC8A" },
  rejected: { label: "Rejected", color: "#ef4444" },
  published: { label: "Published", color: "#3b82f6" },
};

export default function AssessmentStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <span
      className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded"
      style={{
        color: config.color,
        background: `${config.color}15`,
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.label}
    </span>
  );
}
