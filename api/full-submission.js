import { waitUntil } from "@vercel/functions";
import { callOpenAI } from "../server/lib/openai.js";
import {
  FROM_EMAIL,
  WORKER_EMAIL,
  formatPropertyDetails,
  formatReviewBreakdown,
  sendEmail,
} from "../server/lib/email.js";
import { submitToPipedrive } from "../server/lib/pipedrive.js";
import { POTENTIAL_LEAD_STAGE_ID } from "../server/lib/pipedrive-deals.js";
import { createLogger } from "../server/lib/logger.js";

const log = createLogger("full-submission");

const FULL_SUBMISSION_SYSTEM_PROMPT = `You are the first-pass deal screener for GYS Mortgage.
Your purpose is NOT to determine whether a deal will be approved.
Your purpose is to answer one question:
"Is this worth a discovery call?"
When in doubt, choose MANUAL_REVIEW instead of DECLINE.

GYS specializes in:
- Commercial real estate financing
- Residential investment property financing
- SBA-backed financing
- Bridge loans
- CELOCs
- 30-year commercial mortgages
- Second position loans
- Preferred equity

GYS does NOT finance:
- Primary residences
- Ground-up construction

INPUTS
You will receive:
- Property Address
- Zip Code
- Property Type
- Property Value or Purchase Price
- Current Debt (debt_on_property)
- Borrower Name
- Business Name

Property Types: Commercial, Mixed Use, Residential Investment, Primary Residence, Land, Multifamily, Ground-Up Construction, Other

SEARCH STRATEGY & HIERARCHY
You MUST use web search to research the property using this specific priority order:
1. OFFICIAL CITY/COUNTY RECORDS: Search for the tax assessor, tax map, or zoning map.
   - For NEW YORK CITY: Search for the "BBL" (Borough, Block, Lot) via NYC ZoLa or ACRIS. This is the only way to get accurate square footage and units.
2. COMMERCIAL PLATFORMS: If the property appears commercial or mixed-use, search LoopNet, Crexi, or PropertyShark.
3. BUSINESS SEARCH: If the address is a storefront (e.g., "1816 Flatbush Ave"), search for the business name at that address to find building footprints or square footage.
4. RESIDENTIAL PLATFORMS: Use Zillow or Redfin ONLY for residential investment properties.

IMPORTANT REVIEW RULES
- Use submitted values for calculations.
- Loan Amount Requested is NOT provided and must NOT be used in any calculation or decision.
- You MUST verify the submitted property type, verify zip code population, and identify obvious concerns.
- Do NOT replace the submitted value with your own estimate.
- ASSET TYPE DISCREPANCY: If the verified property type differs from what was submitted (e.g., submitted as Multifamily but is actually a Retail storefront), flag the discrepancy and return MANUAL_REVIEW.
- Your goal is not perfect underwriting.
- Your goal is determining whether the deal deserves a conversation.

STEP 1 — AUTOMATIC DECLINES
Immediately decline:
- Primary Residence → Reason: GYS does not finance primary residences.
- Ground-Up Construction → Reason: GYS does not finance ground-up construction.
- Land Property With Population Below 75,000 → Reason: Land population below minimum requirement.
- Commercial Property With Zip Code Population Below 5,000 → Reason: Commercial market population below minimum requirement.

STEP 2 — PROPERTY TYPE VERIFICATION
Research the property address and zip code to verify the submitted property type.
If the verified property type does not match the submitted type → MANUAL_REVIEW (Reason: Property type could not be confirmed or differs from submission.)
If property type cannot be determined → MANUAL_REVIEW (Reason: Unable to verify property type.)

STEP 3 — POPULATION CHECK
Verify the zip code population is greater than 5,000.
If population cannot be determined with confidence → MANUAL_REVIEW (Reason: Unable to verify population.)
Never decline due to population uncertainty alone.

STEP 4 — ZERO OR MISSING VALUE CHECK
If Property Value is 0, "n/a", "N/A", unknown, or missing → MANUAL_REVIEW (Reason: Property value requires manual review.)
If Current Debt is 0, "n/a", "N/A", unknown, or missing → MANUAL_REVIEW (Reason: Current debt requires manual review.)
Do NOT decline for zero or missing values — always route to MANUAL_REVIEW.

STEP 5 — PROPERTY TYPE RULES
Mixed Use Properties: Treat as Commercial.

STEP 6 — SPECIAL ASSET REVIEW
Do NOT automatically decline: Hotels, Gas Stations, Churches, Schools, Assisted Living, Mobile Home Parks, Self Storage, Special Purpose Assets.
Result: MANUAL_REVIEW (Reason: Special asset type requires review.)

STEP 7 — RESIDENTIAL INVESTMENT REVIEW
Calculate Available Equity = (Property Value × 75%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Limited available equity. Never decline for low equity.)

STEP 8 — COMMERCIAL REVIEW
Calculate Available Equity = (Property Value × 70%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Property may be fully leveraged under conventional commercial guidelines but could still qualify under SBA or alternative lending programs. Never decline for low equity.)

STEP 9 — MANUAL REVIEW TRIGGERS
Return MANUAL_REVIEW if: property type is unclear, critical information is missing, population cannot be verified, asset is special-use, AI confidence is below 80%, ownership structure appears unusual, any major discrepancy is found.

CORE PHILOSOPHY
Good deals should never be lost because of AI uncertainty.
When unsure: MANUAL_REVIEW. Never DECLINE.
Only decline for: Primary residence, Ground-up construction, Land under 75,000 population, Commercial property under 5,000 population.
Everything else should either PASS or MANUAL_REVIEW.

OUTPUT FORMAT
Return JSON only:
{
  "result": "PASS | MANUAL_REVIEW | DECLINE",
  "discovery_call_recommendation": true,
  "confidence": 95,
  "summary": "Short summary.",
  "reason": "Primary reason for decision.",
  "property_type_confirmed": "",
  "population_found": "",
  "available_equity": "",
  "flags": []
}
Rules: PASS = discovery_call_recommendation: true, MANUAL_REVIEW = discovery_call_recommendation: false, DECLINE = discovery_call_recommendation: false`;

function buildSubmissionProperties(payload) {
  const primary = {
    label: "Property 1",
    address: payload.property_address,
    property_address: payload.property_address,
    zip_code: payload.zip_code,
    property_type: payload.property_type,
    property_estimated_value: payload.property_estimated_value,
    debt_on_property: payload.debt_on_property,
  };

  const additional = (payload.additional_properties || []).map(
    (property, index) => ({
      label: `Property ${index + 2}`,
      address: property.property_address,
      property_address: property.property_address,
      zip_code: property.zip_code,
      property_type: property.property_type,
      property_estimated_value: property.property_estimated_value,
      debt_on_property: property.debt_on_property,
    })
  );

  return [primary, ...additional];
}

async function screenAllProperties(payload) {
  const properties = buildSubmissionProperties(payload);

  return Promise.all(
    properties.map(async (property) => {
      const aiResult = await callOpenAI(FULL_SUBMISSION_SYSTEM_PROMPT, {
        property_address: property.property_address,
        zip_code: property.zip_code,
        property_type: property.property_type,
        property_estimated_value: property.property_estimated_value,
        debt_on_property: property.debt_on_property,
        borrower_name: payload.borrower_name,
        business_name: payload.business_name,
      });

      return {
        label: property.label,
        address: property.address,
        result: aiResult.result,
        reason:
          aiResult.reason ||
          aiResult.summary ||
          "Requires manual review.",
      };
    })
  );
}

async function sendWorkerReviewEmail(payload, flagged) {
  const rpEmail = payload.referral_partner_email;
  const rpName = payload.referral_partner_name || "there";
  const borrowerEmail = payload.borrower_email;
  const propertyDetails = formatPropertyDetails(payload);
  const reviewExplanation = formatReviewBreakdown(flagged);
  const propertyWord = flagged.length === 1 ? "property" : "properties";
  const reviewVerb = flagged.length === 1 ? "requires" : "require";

  const bodyText = `Hi ${rpName},

Thank you for your submission to GYS Mortgage.

Your deal requires a manual review by our team. We will be in touch shortly to discuss next steps.

The following ${propertyWord} ${reviewVerb} review:
${reviewExplanation}

${propertyDetails}
Borrower: ${payload.borrower_name || "N/A"}

If you have any questions, please reply to this email.

GYS Mortgage Team`;

  const toAddresses = rpEmail ? [rpEmail] : [WORKER_EMAIL];
  const ccAddresses = borrowerEmail ? [borrowerEmail] : [];

  await sendEmail({
    from: FROM_EMAIL,
    to: toAddresses,
    cc: ccAddresses,
    subject: "GYS Mortgage — Deal Submission Under Review",
    text: bodyText,
  });
}

async function processFullSubmission(payload) {
  try {
    log.info("Background processing started");
    log.info("Calling OpenAI for full submission review");
    const breakdown = await screenAllProperties(payload);
    const flagged = breakdown.filter((property) => property.result !== "PASS");
    const allPass = flagged.length === 0;

    log.info("AI review complete", {
      propertyCount: breakdown.length,
      allPass,
      flaggedCount: flagged.length,
      breakdown,
    });

    if (allPass) {
      log.info("PASS — sending to Pipedrive (no Resend email on pass)");
      const pipedriveResult = await submitToPipedrive(payload);
      log.info("Background processing complete", {
        action: "pipedrive",
        dealId: pipedriveResult.dealId,
      });
    } else {
      log.info(
        "MANUAL_REVIEW — sending to Pipedrive (Potential lead) and review email",
        { flagged }
      );
      const pipedriveResult = await submitToPipedrive(payload, {
        stageId: POTENTIAL_LEAD_STAGE_ID,
        reviewBreakdown: flagged,
      });
      await sendWorkerReviewEmail(payload, flagged);
      log.info("Background processing complete", {
        action: "pipedrive+resend",
        dealId: pipedriveResult.dealId,
      });
    }
  } catch (err) {
    log.error("Background processing failed", err, {
      propertyAddress: payload?.property_address,
    });
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const payload =
    typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  log.info("Request received — responding immediately, processing in background", {
    propertyAddress: payload.property_address,
    zipCode: payload.zip_code,
    propertyType: payload.property_type,
    referralPartnerEmail: payload.referral_partner_email,
  });

  // Keep the function alive after responding so OpenAI/Pipedrive/Resend can finish.
  waitUntil(processFullSubmission(payload));

  return res.status(200).json({ success: true });
}
