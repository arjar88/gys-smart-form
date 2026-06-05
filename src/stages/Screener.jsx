import { useState } from "react";
import { screenDeal } from "../api/openai";
import { FormContainer } from "../components/FormContainer";
import { FormNumberField } from "../components/FormNumberField";
import { FormSelect } from "../components/FormSelect";
import { SubmitButton } from "../components/SubmitButton";
import { PROPERTY_TYPE_OPTIONS } from "../constants/qualificationCriteria";

const INITIAL = {
  property_type: "",
  property_estimated_value: "",
  loan_amount_request: "",
};

export function Screener({ onPass, onFail }) {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await screenDeal(form);

      if (result.qualified) {
        onPass(form, result.reason);
      } else {
        onFail(form, result.reason);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormContainer
      title="Quick Deal Screening"
      footer={
        <div className="mt-8 flex flex-col items-end gap-3">
          {error && (
            <p className="w-full rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <SubmitButton form="screener-form" loading={loading}>
            Continue
          </SubmitButton>
        </div>
      }
    >
      <p className="mb-8 text-[15px] leading-relaxed text-gys-label/80">
        Tell us a few details about your deal and we&apos;ll let you know if it
        fits our lending criteria before you complete the full submission.
      </p>

      <form id="screener-form" onSubmit={handleSubmit} className="space-y-5">
        <FormSelect
          label="Property Type"
          name="property_type"
          value={form.property_type}
          onChange={handleChange}
          options={PROPERTY_TYPE_OPTIONS}
          placeholder="Property Type"
          required
        />

        <FormNumberField
          label="Estimated Property Value"
          name="property_estimated_value"
          value={form.property_estimated_value}
          onChange={handleChange}
          placeholder="Estimated Property Value"
          required
        />

        <FormNumberField
          label="Loan Amount Requested"
          name="loan_amount_request"
          value={form.loan_amount_request}
          onChange={handleChange}
          placeholder="Loan Amount Requested"
          required
        />
      </form>
    </FormContainer>
  );
}
