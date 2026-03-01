export default function SelectField({ value, onChange, options, placeholder }) {
  return (
    <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, " ")}</option>
      ))}
    </select>
  );
}
