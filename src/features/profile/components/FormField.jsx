export default function FormField({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="sub-label block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
