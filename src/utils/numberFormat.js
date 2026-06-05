export function formatNumberInput(value) {
  if (value == null || value === "") return "";

  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return "";

  return Number(digits).toLocaleString("en-US");
}

export function parseNumberInput(value) {
  if (value == null || value === "") return "";
  return String(value).replace(/[^\d]/g, "");
}

export const NUMERIC_FIELD_NAMES = [
  "property_estimated_value",
  "loan_amount_request",
  "debt_on_property",
];

export function formatNumericFields(data) {
  const formatted = { ...data };

  for (const field of NUMERIC_FIELD_NAMES) {
    if (formatted[field]) {
      formatted[field] = formatNumberInput(formatted[field]);
    }
  }

  return formatted;
}
