export function SelectField({ label, value, options, onChange }: {
  label: string; value: string | number; options: readonly (readonly [string | number, string])[]; onChange: (value: string) => void;
}) {
  return <label className="select-field"><span>{label}</span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}
