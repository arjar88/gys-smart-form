import { useState } from "react";
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
  TRANSACTION_TYPE_OPTIONS,
} from "../constants/qualificationCriteria";
import { formatNumericFields } from "../utils/numberFormat";

const STAGE2_FIELDS = {
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
  transaction_type: "",
  business_name: "",
  borrower_name: "",
  borrower_email: "",
  borrower_phone: "",
  notes: "",
};

export function SubmissionForm({ initialData }) {
  const [form, setForm] = useState(
    formatNumericFields({ ...STAGE2_FIELDS, ...initialData })
  );
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    // Immediately show the thank you screen — fire and forget the backend call.
    setSubmitted(true);

    fetch("/api/full-submission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch((err) => console.error("Submission error:", err));
  }

  if (submitted) {
    return (
      <FormContainer title="Submission Received">
        <p className="text-[15px] leading-relaxed text-gys-label/90">
          Thank you for submitting your deal. Our team will review your
          information and be in touch shortly.
        </p>
      </FormContainer>
    );
  }

  return (
    <FormContainer
      title="File Submission Form"
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
        <FormSection title="Referral Partner Info">
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
            placeholder="Company Name"
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
            placeholder="Relationship with Borrower"
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
          <FormSelect
            label="Property Type"
            name="property_type"
            value={form.property_type}
            onChange={handleChange}
            options={PROPERTY_TYPE_OPTIONS}
            placeholder="Property Type"
            required
          />
          <FormSelect
            label="Transaction Type"
            name="transaction_type"
            value={form.transaction_type}
            onChange={handleChange}
            options={TRANSACTION_TYPE_OPTIONS}
            placeholder="Transaction Type"
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
          <FormField
            label="Zip Code"
            name="zip_code"
            value={form.zip_code}
            onChange={handleChange}
            placeholder="Zip Code"
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

        <FormSection title="Borrower Info">
          <FormField
            label="Business Name"
            name="business_name"
            value={form.business_name}
            onChange={handleChange}
            placeholder="Business Name"
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
