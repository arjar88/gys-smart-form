import { formatNumberInput } from "../utils/numberFormat";

export function FormNumberField({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
}) {
  function handleChange(event) {
    const formatted = formatNumberInput(event.target.value);

    onChange({
      target: {
        name,
        value: formatted,
      },
    });
  }

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? label}
        required={required}
        className="w-full rounded-md border border-gys-input-border bg-white px-4 py-3 text-[15px] text-gys-label placeholder:font-light placeholder:text-gys-placeholder focus:border-gys-primary focus:outline-none focus:ring-2 focus:ring-gys-primary/20"
      />
    </div>
  );
}
