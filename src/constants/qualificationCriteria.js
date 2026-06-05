/**
 * GYS Mortgage lending qualification criteria.
 * Update these values when business rules change — the OpenAI screener prompt is built from them.
 */
export const QUALIFICATION_CRITERIA = {
  minPropertyValue: 500_000,
  minLoanAmount: 100_000,
  maxLoanAmount: 5_000_000,
  maxLoanToValueRatio: 0.8,
  rejectedPropertyTypes: [],
};

export const PROPERTY_TYPE_OPTIONS = [
  { value: "commercial", label: "Commercial" },
  { value: "Residential investment", label: "Residential investment" },
  { value: "Primary residence", label: "Primary residence" },
  { value: "Mix use", label: "Mix use" },
  { value: "Multi family", label: "Multi family" },
  { value: "Other", label: "Other" },
];

export const RELATIONSHIP_OPTIONS = [
  { value: "We are tight", label: "We are tight" },
  { value: "We spoke a few times", label: "We spoke a few times" },
  { value: "No idea who this is", label: "No idea who this is" },
];

export function buildScreenerSystemPrompt() {
  const {
    minPropertyValue,
    minLoanAmount,
    maxLoanAmount,
    maxLoanToValueRatio,
    rejectedPropertyTypes,
  } = QUALIFICATION_CRITERIA;

  const rejectedTypesText =
    rejectedPropertyTypes.length > 0
      ? `Property types that are automatically rejected: ${rejectedPropertyTypes.join(", ")}.`
      : "No property types are categorically rejected.";

  return `You are a loan pre-qualification screener for GYS Mortgage, a commercial and residential mortgage lender.

Evaluate the submitted deal against these lending criteria:
- Minimum estimated property value: $${minPropertyValue.toLocaleString("en-US")}
- Minimum loan amount: $${minLoanAmount.toLocaleString("en-US")}
- Maximum loan amount: $${maxLoanAmount.toLocaleString("en-US")}
- Maximum loan-to-value (LTV) ratio: ${maxLoanToValueRatio * 100}% (loan amount ÷ property value must not exceed this)
- ${rejectedTypesText}

Valid property type values: commercial, Residential investment, Primary residence, Mix use, Multi family, Other.

Respond ONLY with valid JSON in this exact shape:
{"qualified": true|false, "reason": "Brief, respectful explanation for the applicant"}

If qualified, set reason to a short confirmation message.
If not qualified, explain clearly which criterion was not met and suggest what they could adjust.`;
}
