import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

export function FormPhoneInput({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  defaultCountry = "US",
}) {
  function handlePhoneChange(phoneValue) {
    onChange({
      target: {
        name,
        value: phoneValue || "",
      },
    });
  }

  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-[15px] font-medium text-gys-label">
        {label}
        {required && <span className="text-gys-required"> *</span>}
      </label>
      <PhoneInput
        id={name}
        name={name}
        defaultCountry={defaultCountry}
        value={value || undefined}
        onChange={handlePhoneChange}
        placeholder={placeholder ?? label}
        required={required}
        className="gys-phone-input"
      />
    </div>
  );
}
