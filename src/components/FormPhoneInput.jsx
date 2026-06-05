export function FormPhoneInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <div className="flex overflow-hidden rounded-md border border-gys-input-border bg-white focus-within:border-gys-primary focus-within:ring-2 focus-within:ring-gys-primary/20">
        <div className="flex items-center gap-2 border-r border-gys-input-border bg-white px-3 text-sm text-gys-label">
          <span aria-hidden="true">🇺🇸</span>
          <span className="text-gys-placeholder">+1</span>
        </div>
        <input
          id={name}
          name={name}
          type="tel"
          value={value}
          onChange={onChange}
          placeholder={placeholder ?? label}
          required={required}
          className="w-full border-0 bg-white px-4 py-3 text-[15px] text-gys-label placeholder:text-gys-placeholder focus:outline-none"
        />
      </div>
    </div>
  );
}
