export function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <div className="relative">
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          required={required}
          className="w-full appearance-none rounded-md border border-gys-input-border bg-white px-4 py-3 pr-10 text-[15px] text-gys-label focus:border-gys-primary focus:outline-none focus:ring-2 focus:ring-gys-primary/20"
        >
          <option value="" disabled>
            {placeholder ?? label}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gys-placeholder">
          ▾
        </span>
      </div>
    </div>
  );
}
