export function FormTextarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? label}
        required={required}
        rows={rows}
        className="w-full resize-y rounded-md border border-gys-input-border bg-white px-4 py-3 text-[15px] text-gys-label placeholder:font-light placeholder:text-gys-placeholder focus:border-gys-primary focus:outline-none focus:ring-2 focus:ring-gys-primary/20"
      />
    </div>
  );
}
