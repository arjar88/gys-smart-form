import { FormContainer } from "../components/FormContainer";
import { SubmitButton } from "../components/SubmitButton";

export function RejectionView({ reason, onTryAgain }) {
  return (
    <FormContainer title="Not a Fit Right Now">
      <div className="space-y-6">
        <p className="text-[15px] leading-relaxed text-gys-label/90">{reason}</p>
        <p className="text-[15px] leading-relaxed text-gys-label/70">
          You can adjust your property value or loan amount and try again, or
          reach out to GYS Mortgage to discuss your situation.
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <SubmitButton type="button" onClick={onTryAgain}>
          Try Different Numbers
        </SubmitButton>
      </div>
    </FormContainer>
  );
}
