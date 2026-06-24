import { FormContainer } from "../components/FormContainer";
import { SubmitButton } from "../components/SubmitButton";

export function RejectionView({ reason, onTryAgain }) {
  const reasonLines = (reason || "").split("\n").filter((line) => line.trim() !== "");

  return (
    <FormContainer title="Not a Fit Right Now">
      <div className="space-y-6">
        <div className="space-y-4">
          {reasonLines.map((line, index) => {
            const match = line.match(/^(Property \d+)/);
            if (match) {
              const label = match[1];
              const rest = line.slice(label.length);
              return (
                <p key={index} className="text-[15px] leading-relaxed text-gys-label/90">
                  <span className="font-bold">{label}</span>
                  {rest}
                </p>
              );
            }
            return (
              <p key={index} className="text-[15px] leading-relaxed text-gys-label/90">
                {line}
              </p>
            );
          })}
        </div>

        <p className="border-t border-gys-input-border pt-6 text-[15px] leading-relaxed text-gys-label/70">
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
