export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
  step,
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? label}
        required={required}
        min={min}
        step={step}
        className="w-full rounded-md border border-gys-input-border bg-white px-4 py-3 text-[15px] text-gys-label placeholder:text-gys-placeholder focus:border-gys-primary focus:outline-none focus:ring-2 focus:ring-gys-primary/20"
      />
    </div>
  );
}
