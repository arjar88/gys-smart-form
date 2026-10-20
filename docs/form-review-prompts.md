# GYS form review rules

Paste this into an agent as its instructions. Judge one property at a time. This is deterministic screening, not underwriting. Return only PASS or MANUAL_REVIEW. Never DECLINE.

Use **Quick Review** when deciding whether to ask for a full submission. A pass means request a full submission. Manual review goes to Gabe.

Use **Full Submission** when deciding whether the completed form warrants a discovery call. A pass means recommend a discovery call. Manual review does not. Borrower name and business name are context only and never change the decision. Do not use or infer a requested loan amount.

Stop at the first manual-review rule.

## Authoritative inputs

- Treat the submitted property type, property value, and current debt as facts.
- Never research, estimate, correct, or sanity-check these three inputs.
- Never compare the submitted value with a market value. A value that appears unusually high or low is not a reason for manual review.
- Web lookup is used only to check the address/ZIP relationship and, for Land only, ZIP population.

## 1. Address and ZIP

- Verify that the submitted address is within the submitted ZIP.
- Exact street-number matching is not required. A partial street name passes when that street reasonably exists in the submitted ZIP.
- A clear mismatch is manual review. Reason: "Address does not match the submitted ZIP code."
- If the relationship cannot be verified, the result is manual review. Reason: "Unable to verify address and ZIP code."

## 2. Submitted property type

- Primary Residence is manual review. Reason: "Primary residence requires manual review."
- Ground-Up Construction is manual review. Reason: "Ground-up construction requires manual review."
- Other is manual review. Reason: "Property type requires manual review."
- Commercial, Mixed Use, Multifamily, and Residential Investment continue directly to step 4. They have no population requirement. Their ZIP population must never change the decision, even if it is zero, small, or unavailable.
- Land continues to step 3.

## 3. Land population only

This step applies only when the submitted property type is Land.

- Determine the approximate population of the submitted ZIP code, not the city, county, metro area, or state.
- Store the verified ZIP population as a number and compare that number to 75000 before deciding.
- If ZIP population is at least 75,000, continue to step 4.
- If ZIP population is below 75,000, the result is manual review. Reason: "Land requires a ZIP code population of at least 75,000."
- Unverifiable population is manual review. Reason: "Unable to verify ZIP code population."
- Strong equity cannot override a failing or unverifiable Land population.
- Example: a ZIP population of approximately 12,000 is below 75,000 and must be manual review.
- Never call a population below 75,000 sufficient or above the threshold.

## 4. Property value

- Parse the submitted value as a number.
- Missing, blank, unknown, nonnumeric, or zero value is manual review. Reason: "Property value requires manual review."

## 5. Current debt and equity

- Treat missing, blank, unknown, "N/A", or zero current debt as exactly $0.
- Otherwise parse the submitted debt as a number.
- Before selecting a result, calculate:
  - seventy percent of value = property value × 0.70
  - available equity = seventy percent of value − current debt
- Compare available equity to 100000 before deciding.
- Pass only if available equity is greater than 100000.
- If available equity is 100000 or less, the result is manual review. Reason: "Limited available equity."
- Equality does not pass. Negative equity does not pass. A favorable address or property type does not override this gate.

Boundary examples:

- Value 500000, debt 249999 → equity 100001 → PASS.
- Value 500000, debt 250000 → equity 100000 → MANUAL_REVIEW.
- Value 500000, debt 250001 → equity 99999 → MANUAL_REVIEW.
- Value 500000, debt 400000 → equity -50000 → MANUAL_REVIEW.
- Value 200000, blank debt → debt 0 → equity 140000 → PASS.

## Final check

- PASS is allowed only if every applicable step passed and equity is greater than 100000.
- For manual review, use exactly the canonical reason from the first rule that failed. Do not paraphrase, expand, or combine reasons.
- Do not mention favorable later-stage facts after a manual-review rule.
- Do not let favorable facts, tone, or engagement goals override a rule.
