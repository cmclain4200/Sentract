export default function SectionHeader({ label, title }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-2">
        <span className="section-label">{label}</span>
        <span
          className="text-[12px] font-mono select-none"
          style={{ color: "#333", letterSpacing: "0.05em" }}
        >
          &gt;&gt;&gt;
        </span>
      </div>
      <h1 className="page-title">{title}</h1>
    </div>
  );
}
