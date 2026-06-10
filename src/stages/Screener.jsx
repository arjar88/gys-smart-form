import { useState } from "react";
import { FormContainer } from "../components/FormContainer";
import { FormField } from "../components/FormField";
import { FormNumberField } from "../components/FormNumberField";
import { FormPhoneInput } from "../components/FormPhoneInput";
import { FormSection } from "../components/FormSection";
import { FormSelect } from "../components/FormSelect";
import { SubmitButton } from "../components/SubmitButton";
import { PROPERTY_TYPE_OPTIONS } from "../constants/qualificationCriteria";

const INITIAL = {
  property_address: "",
  zip_code: "",
  property_type: "",
  property_estimated_value: "",
  debt_on_property: "",
  referral_partner_name: "",
  referral_partner_email: "",
  referral_partner_number: "",
};

export function Screener({ onPass, onFail }) {
  const [form, setForm] = useState(INITIAL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassModal, setShowPassModal] = useState(false);

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
      const response = await fetch("/api/quick-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }

      if (result.result === "PASS") {
        setShowPassModal(true);
      } else {
        onFail(
          form,
          result.reason ||
            "Your submission did not meet our initial lending criteria."
        );
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleContinueToFullSubmission() {
    setShowPassModal(false);
    onPass(form);
  }

  return (
    <>
    {showPassModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 text-center shadow-xl">
          <h2 className="mb-4 font-serif text-2xl font-bold text-gys-label">
            Your file has good potential
          </h2>
          <p className="mb-8 text-[15px] leading-relaxed text-gys-label/80">
            Submit the full file here to move forward with your deal.
          </p>
          <button
            type="button"
            onClick={handleContinueToFullSubmission}
            className="w-full rounded-md bg-gys-primary px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-gys-primary-hover"
          >
            Submit Full File
          </button>
        </div>
      </div>
    )}
    <FormContainer
      title="Quick Deal Review"
      footer={
        <div className="mt-8 flex flex-col items-end gap-3">
          {error && (
            <p className="w-full rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <SubmitButton form="screener-form" loading={loading}>
            Check My Deal
          </SubmitButton>
        </div>
      }
    >
      <p className="mb-8 text-[15px] leading-relaxed text-gys-label/80">
        Enter your property details and we&apos;ll instantly check if your deal
        fits our lending criteria — before you gather any borrower information.
      </p>

      <form id="screener-form" onSubmit={handleSubmit} className="space-y-2">
        <FormSection title="Property Details">
          <FormField
            label="Property Address"
            name="property_address"
            value={form.property_address}
            onChange={handleChange}
            placeholder="Property Address"
            required
          />
          <FormField
            label="Zip Code"
            name="zip_code"
            value={form.zip_code}
            onChange={handleChange}
            placeholder="Zip Code"
            required
          />
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
            label="Current Debt on Property"
            name="debt_on_property"
            value={form.debt_on_property}
            onChange={handleChange}
            placeholder="Current Debt on Property"
            required
          />
        </FormSection>

        <FormSection title="Referral Partner Info">
          <FormField
            label="Your Name"
            name="referral_partner_name"
            value={form.referral_partner_name}
            onChange={handleChange}
            placeholder="Your Name"
            required
          />
          <FormField
            label="Your Email"
            name="referral_partner_email"
            type="email"
            value={form.referral_partner_email}
            onChange={handleChange}
            placeholder="Your Email"
            required
          />
          <FormPhoneInput
            label="Your Phone Number"
            name="referral_partner_number"
            value={form.referral_partner_number}
            onChange={handleChange}
            placeholder="Your Phone Number"
            required
          />
        </FormSection>
      </form>
    </FormContainer>
    </>
  );
}
