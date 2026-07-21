import { FormContainer } from "../components/FormContainer";
import { SubmitButton } from "../components/SubmitButton";

const FRIENDLY_REASONS = [
  {
    match: /limited available equity/i,
    text: "Based on the numbers submitted, there appears to be limited available equity.",
  },
  {
    match: /primary residence/i,
    text: "This appears to be a primary residence, which we don't lend against.",
  },
  {
    match: /ground-up construction/i,
    text: "Ground-up construction needs a closer look before we can move forward.",
  },
  {
    match: /property type requires manual review/i,
    text: "This property type needs a closer look before we can move forward.",
  },
  {
    match: /land requires a zip code population/i,
    text: "This vacant land is in an area with a population below our 75,000 minimum.",
  },
  {
    match: /address does not match/i,
    text: "The address and ZIP code submitted don't appear to match.",
  },
  {
    match: /unable to verify address and zip/i,
    text: "We were unable to verify that the address matches the submitted ZIP code.",
  },
  {
    match: /unable to verify zip code population/i,
    text: "We were unable to verify the ZIP code population for this property.",
  },
  {
    match: /property value requires manual review/i,
    text: "The property value submitted is unclear or missing.",
  },
];

function toFriendlyReason(reason) {
  const text = String(reason || "").trim();
  const found = FRIENDLY_REASONS.find((entry) => entry.match.test(text));
  return found?.text || text || "This file needs a closer look before we can move forward.";
}

function parseReasonLine(line) {
  const match = line.match(/^(Property \d+)\s*\(([^)]+)\):\s*(.*)$/);
  if (!match) {
    return { label: null, address: null, reason: toFriendlyReason(line) };
  }

  return {
    label: match[1],
    address: match[2],
    reason: toFriendlyReason(match[3]),
  };
}

export function RejectionView({ reason, onTryAgain }) {
  const reasonLines = (reason || "")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(parseReasonLine);

  return (
    <FormContainer title="This File Needs a Closer Look">
      <div className="space-y-6">
        <div className="space-y-4">
          {reasonLines.map((item, index) => {
            if (item.label && item.address) {
              return (
                <p
                  key={index}
                  className="text-[15px] leading-relaxed text-gys-label/90"
                >
                  <span className="font-bold">{item.label}</span>
                  {` (${item.address}): ${item.reason}`}
                </p>
              );
            }

            return (
              <p
                key={index}
                className="text-[15px] leading-relaxed text-gys-label/90"
              >
                {item.reason}
              </p>
            );
          })}
        </div>

        <p className="border-t border-gys-input-border pt-6 text-[15px] leading-relaxed text-gys-label/70">
          Based on the information submitted, this file doesn&apos;t fit as-is.
          Gabe will follow up with a few questions to confirm the details and
          see if there&apos;s another path forward.
        </p>
      </div>

      <div className="mt-8 flex justify-end">
        <SubmitButton type="button" onClick={onTryAgain}>
          Review & Update Details
        </SubmitButton>
      </div>
    </FormContainer>
  );
}
