import { FormContainer } from "../components/FormContainer";
import { SubmitButton } from "../components/SubmitButton";

export function PassView({ onContinue }) {
  return (
    <FormContainer title="The Deal Looks Good">
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-gys-label/90">
          Based on the property details you submitted, this file passed the
          quick review and looks worth moving forward.
        </p>

        <p className="border-t border-gys-input-border pt-6 text-[15px] leading-relaxed text-gys-label/70">
          Continue to the full submission form to add borrower details and send
          the complete file to GYS Mortgage.
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <SubmitButton type="button" onClick={onContinue}>
          Continue to Full Submission
        </SubmitButton>
      </div>
    </FormContainer>
  );
}
