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

const EMPTY_PROPERTY = {
  property_address: "",
  zip_code: "",
  property_type: "",
  property_estimated_value: "",
  debt_on_property: "",
};

export function Screener({ onPass, onFail, onBack }) {
  const [form, setForm] = useState(INITIAL);
  const [additionalProperties, setAdditionalProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  function addProperty() {
    setAdditionalProperties((prev) => [...prev, { ...EMPTY_PROPERTY }]);
  }

  function removeProperty(index) {
    setAdditionalProperties((prev) => prev.filter((_, i) => i !== index));
  }

  function handlePropertyChange(index) {
    return (event) => {
      const { name, value } = event.target;
      setAdditionalProperties((prev) =>
        prev.map((property, i) =>
          i === index ? { ...property, [name]: value } : property
        )
      );
      setError("");
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const submitPayload = {
      ...form,
      additional_properties: additionalProperties,
    };

    try {
      const response = await fetch("/api/quick-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Something went wrong. Please try again.");
      }

      if (result.result === "PASS") {
        onPass(submitPayload);
      } else {
        onFail(
          submitPayload,
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

  return (
    <FormContainer
      title="Quick Deal Review"
      onBack={onBack}
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

        {additionalProperties.map((property, index) => (
          <FormSection key={index} title={`Property ${index + 2}`}>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => removeProperty(index)}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
            <FormField
              label="Property Address"
              name="property_address"
              value={property.property_address}
              onChange={handlePropertyChange(index)}
              placeholder="Property Address"
              required
            />
            <FormField
              label="Zip Code"
              name="zip_code"
              value={property.zip_code}
              onChange={handlePropertyChange(index)}
              placeholder="Zip Code"
              required
            />
            <FormSelect
              label="Property Type"
              name="property_type"
              value={property.property_type}
              onChange={handlePropertyChange(index)}
              options={PROPERTY_TYPE_OPTIONS}
              placeholder="Property Type"
              required
            />
            <FormNumberField
              label="Estimated Property Value"
              name="property_estimated_value"
              value={property.property_estimated_value}
              onChange={handlePropertyChange(index)}
              placeholder="Estimated Property Value"
              required
            />
            <FormNumberField
              label="Current Debt on Property"
              name="debt_on_property"
              value={property.debt_on_property}
              onChange={handlePropertyChange(index)}
              placeholder="Current Debt on Property"
              required
            />
          </FormSection>
        ))}

        <div className="mb-8">
          <button
            type="button"
            onClick={addProperty}
            className="inline-flex items-center gap-2 rounded-md border border-gys-primary px-4 py-2.5 text-[15px] font-medium text-gys-primary transition-colors hover:bg-gys-primary/5"
          >
            <span aria-hidden="true">+</span>
            Add another property
          </button>
        </div>

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
  );
}
