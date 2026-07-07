import { useEffect, useState } from "react";
import { FormContainer } from "../components/FormContainer";
import { FormField } from "../components/FormField";
import { FormNumberField } from "../components/FormNumberField";
import { FormPhoneInput } from "../components/FormPhoneInput";
import { FormSection } from "../components/FormSection";
import { FormSelect } from "../components/FormSelect";
import { FormTextarea } from "../components/FormTextarea";
import { SubmitButton } from "../components/SubmitButton";
import {
  PROPERTY_TYPE_OPTIONS,
  RELATIONSHIP_OPTIONS,
} from "../constants/qualificationCriteria";
import { formatNumericFields } from "../utils/numberFormat";

const STAGE2_FIELDS = {
  pipedrive_id: "",
  referral_partner_name: "",
  referral_partner_company: "",
  referral_partner_number: "",
  referral_partner_email: "",
  relationship_with_borrower: "",
  loan_amount_request: "",
  property_address: "",
  property_estimated_value: "",
  zip_code: "",
  debt_on_property: "",
  property_type: "",
  business_name: "",
  borrower_name: "",
  borrower_email: "",
  borrower_phone: "",
  notes: "",
};

const EMPTY_PROPERTY = {
  property_address: "",
  zip_code: "",
  property_type: "",
  property_estimated_value: "",
  debt_on_property: "",
  loan_amount_request: "",
};

const PARTNER_LOOKUP_MESSAGES = {
  loading: "Looking up your partner profile...",
  success: "Partner info found and applied.",
  not_found: "No saved partner profile found. Please complete the fields below.",
  error: "Unable to look up your info right now. Please complete the fields below.",
};

export function SubmissionForm({ initialData, onBack }) {
  const [form, setForm] = useState(
    formatNumericFields({ ...STAGE2_FIELDS, ...initialData })
  );
  const [additionalProperties, setAdditionalProperties] = useState(() =>
    (initialData?.additional_properties || []).map((p) => ({ ...EMPTY_PROPERTY, ...p }))
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [partnerLookupStatus, setPartnerLookupStatus] = useState("idle");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");

    if (name === "pipedrive_id") {
      setPartnerLookupStatus("idle");
    }
  }

  async function handlePartnerIdBlur(event) {
    const input = event.target;
    const id = input.value.trim();

    if (!id) {
      setPartnerLookupStatus("idle");
      return;
    }

    setPartnerLookupStatus("loading");

    try {
      const response = await fetch(
        `/api/partner-lookup?id=${encodeURIComponent(id)}`
      );

      if (response.status === 404) {
        setPartnerLookupStatus("not_found");
        return;
      }

      if (!response.ok) {
        throw new Error("Partner lookup failed");
      }

      const partner = await response.json();

      setForm((prev) => ({
        ...prev,
        referral_partner_name: partner.referral_partner_name,
        referral_partner_company: partner.referral_partner_company,
        referral_partner_number: partner.referral_partner_number,
        referral_partner_email: partner.referral_partner_email,
      }));
      setPartnerLookupStatus("success");
    } catch (lookupError) {
      console.error("Partner lookup error:", lookupError);
      setPartnerLookupStatus("error");
    }
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

    // Immediately show the thank you screen — fire and forget the backend call.
    setSubmitted(true);

    const { pipedrive_id: _partnerId, ...submission } = form;

    fetch("/api/full-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...submission,
        additional_properties: additionalProperties,
      }),
    }).catch((err) => console.error("Submission error:", err));
  }

  useEffect(() => {
    if (submitted) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [submitted]);

  if (submitted) {
    return (
      <FormContainer title="Submission Received" centerTitle onBack={onBack}>
        <p className="text-center text-[15px] leading-relaxed text-gys-label/90">
          Thank you for submitting your deal, check your inbox for next steps — if
          you would like to edit your submission, reach out to{" "}
          <a
            href="mailto:subs@gysmortgage.com"
            className="text-gys-primary underline hover:text-gys-primary-hover"
          >
            subs@gysmortgage.com
          </a>
        </p>
      </FormContainer>
    );
  }

  return (
    <FormContainer
      title="File Submission Form"
      centerTitle
      onBack={onBack}
      footer={
        <div className="mt-8 flex flex-col items-end gap-3">
          {error && (
            <p className="w-full rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <SubmitButton form="submission-form" loading={loading}>
            Submit
          </SubmitButton>
        </div>
      }
    >
      <form id="submission-form" onSubmit={handleSubmit} className="space-y-2">
        <FormSection title="Referral Partner Info" largeTitle>
          <FormField
            label="Pipedrive Partner ID (Optional)"
            name="pipedrive_id"
            type="text"
            value={form.pipedrive_id}
            onChange={handleChange}
            onBlur={handlePartnerIdBlur}
            placeholder="e.g. 12345"
          />
          {partnerLookupStatus !== "idle" && (
            <p
              className={`-mt-1 mb-2 text-sm ${
                partnerLookupStatus === "success"
                  ? "text-green-700"
                  : partnerLookupStatus === "loading"
                    ? "text-gys-label/70"
                    : "text-amber-700"
              }`}
            >
              {PARTNER_LOOKUP_MESSAGES[partnerLookupStatus]}
            </p>
          )}
          <FormField
            label="Rep Name"
            name="referral_partner_name"
            value={form.referral_partner_name}
            onChange={handleChange}
            placeholder="Rep Name"
            required
          />
          <FormField
            label="Company Name"
            name="referral_partner_company"
            value={form.referral_partner_company}
            onChange={handleChange}
            placeholder="e.g. Acme Corp"
            required
          />
          <FormPhoneInput
            label="Referral Partner Number"
            name="referral_partner_number"
            value={form.referral_partner_number}
            onChange={handleChange}
            placeholder="Referral Partner Number"
            required
          />
          <FormField
            label="Referral Partner Email"
            name="referral_partner_email"
            type="email"
            value={form.referral_partner_email}
            onChange={handleChange}
            placeholder="Referral Partner Email"
            required
          />
          <FormSelect
            label="Relationship with Borrower"
            name="relationship_with_borrower"
            value={form.relationship_with_borrower}
            onChange={handleChange}
            options={RELATIONSHIP_OPTIONS}
            placeholder="Select relationship..."
            required
          />
        </FormSection>

        <FormSection title="Property Info">
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
            label="Debt on the Property"
            name="debt_on_property"
            value={form.debt_on_property}
            onChange={handleChange}
            placeholder="Debt on the Property"
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
              label="Debt on the Property"
              name="debt_on_property"
              value={property.debt_on_property}
              onChange={handlePropertyChange(index)}
              placeholder="Debt on the Property"
              required
            />
            <FormNumberField
              label="Loan Amount Requested"
              name="loan_amount_request"
              value={property.loan_amount_request}
              onChange={handlePropertyChange(index)}
              placeholder="Loan Amount Requested"
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

        <FormSection title="Borrower Info" largeTitle>
          <FormField
            label="Borrower's Business Name"
            name="business_name"
            value={form.business_name}
            onChange={handleChange}
            placeholder="Borrower's Business Name"
            required
          />
          <FormField
            label="Borrower Name"
            name="borrower_name"
            value={form.borrower_name}
            onChange={handleChange}
            placeholder="Borrower Name"
            required
          />
          <FormField
            label="Borrower Email"
            name="borrower_email"
            type="email"
            value={form.borrower_email}
            onChange={handleChange}
            placeholder="Borrower Email"
            required
          />
          <FormPhoneInput
            label="Borrower Phone Number"
            name="borrower_phone"
            value={form.borrower_phone}
            onChange={handleChange}
            placeholder="Borrower Phone Number"
            required
          />
          <FormTextarea
            label="Additional Notes"
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Include any additional details..."
          />
        </FormSection>
      </form>
    </FormContainer>
  );
}
