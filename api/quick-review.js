import { callOpenAI } from "../server/lib/openai.js";
import {
  FROM_EMAIL,
  WORKER_EMAIL,
  formatPropertyDetails,
  formatReviewBreakdown,
  sendEmail,
} from "../server/lib/email.js";
import { createLogger } from "../server/lib/logger.js";

const log = createLogger("quick-review");

const QUICK_REVIEW_SYSTEM_PROMPT = `You are the Quick Review AI for GYS Mortgage.
Your purpose is to determine whether a referral partner should proceed with a full submission.
You are NOT an underwriter.
You are NOT determining whether the loan will be approved.
You are answering one question:
"Based on the property alone, is this opportunity strong enough to justify gathering borrower information and submitting a full file?"
When in doubt, choose MANUAL_REVIEW instead of DECLINE.

GYS FINANCES:
- Commercial Real Estate
- Multifamily
- Mixed Use
- Residential Investment Properties
- SBA Loans
- Bridge Loans
- CELOCs
- 30-Year Commercial Mortgages
- Second Position Loans
- Preferred Equity

GYS DOES NOT FINANCE:
- Primary Residences
- Ground-Up Construction

INPUTS
You will receive:
- Property Address
- Zip Code
- Property Type
- Property Value or Purchase Price
- Current Debt (debt_on_property)

Property Types: Commercial, Mixed Use, Multifamily, Residential Investment, Primary Residence, Land, Ground-Up Construction, Other

SEARCH STRATEGY & HIERARCHY
You MUST use web search to research the property using this specific priority order:
1. OFFICIAL CITY/COUNTY RECORDS: Search for the tax assessor, tax map, or zoning map.
   - For NEW YORK CITY: Search for the "BBL" (Borough, Block, Lot) via NYC ZoLa or ACRIS. This is the only way to get accurate square footage and units.
2. COMMERCIAL PLATFORMS: If the property appears commercial or mixed-use, search LoopNet, Crexi, or PropertyShark.
3. BUSINESS SEARCH: If the address is a storefront (e.g., "1816 Flatbush Ave"), search for the business name at that address to find building footprints or square footage.
4. RESIDENTIAL PLATFORMS: Use Zillow or Redfin ONLY for residential investment properties.

IMPORTANT RULES
- Use the values submitted by the referral partner.
- You MUST verify the submitted property type, verify zip code population, and identify obvious concerns.
- Do NOT replace the submitted value with your own estimate.
- ASSET TYPE DISCREPANCY: If the verified property type differs from what was submitted (e.g., submitted as Multifamily but is actually a Retail storefront), flag the discrepancy and return MANUAL_REVIEW.
- If property type cannot be determined after following the hierarchy → MANUAL_REVIEW.

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

STEP 5 — RESIDENTIAL INVESTMENT REVIEW
Calculate Available Equity = (Property Value × 75%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Limited available equity.)

STEP 6 — COMMERCIAL REVIEW
Calculate Available Equity = (Property Value × 70%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Property may be fully leveraged under standard commercial guidelines and requires review.)

STEP 7 — SPECIAL ASSET REVIEW
Automatically send to MANUAL_REVIEW: Hotels, Gas Stations, Churches, Schools, Assisted Living, Mobile Home Parks, Self Storage, Special Purpose Assets.
Reason: Special asset requires review before requesting a full submission.

STEP 8 — MANUAL REVIEW TRIGGERS
Return MANUAL_REVIEW if: property type is unclear, population cannot be verified, critical information is missing, AI confidence is below 80%, ownership appears unusual, major discrepancies are found.

CORE PHILOSOPHY
- PASS: Property appears to fit GYS guidelines. RP should proceed with a full submission.
- MANUAL_REVIEW: Property may fit, but Gabe should review before asking the RP to gather borrower information.
- DECLINE: Property clearly falls outside GYS guidelines.

OUTPUT FORMAT
Return JSON only:
{
  "result": "PASS | MANUAL_REVIEW | DECLINE",
  "next_step": "REQUEST_FULL_SUBMISSION | GABE_REVIEW | DECLINE",
  "confidence": 95,
  "summary": "",
  "reason": "",
  "property_type_confirmed": "",
  "population_found": "",
  "available_equity": "",
  "flags": []
}
Rules: PASS = REQUEST_FULL_SUBMISSION, MANUAL_REVIEW = GABE_REVIEW, DECLINE = DECLINE`;

function buildQuickReviewProperties(payload) {
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

async function sendRejectionEmail(payload, flagged) {
  const rpEmail = payload.referral_partner_email;
  const rpName = payload.referral_partner_name || "there";
  const propertyDetails = formatPropertyDetails(payload);
  const reviewExplanation = formatReviewBreakdown(flagged);
  const flaggedCount = (flagged || []).length;
  const propertyWord = flaggedCount === 1 ? "property" : "properties";
  const reviewVerb = flaggedCount === 1 ? "requires" : "require";

  const subject = "GYS Mortgage — Your Quick Review Requires Manual Review";

  const bodyText = `Hi ${rpName},\n\nThank you for submitting your deal for a quick review.\n\nYour submission requires a manual review before we can proceed. Our team will be in touch shortly to discuss next steps.\n\nThe following ${propertyWord} ${reviewVerb} review:\n${reviewExplanation}\n\n${propertyDetails}\n\nIf you have any questions, please reply to this email.\n\nGYS Mortgage Team`;

  const toAddresses = rpEmail ? [rpEmail] : [WORKER_EMAIL];

  await sendEmail({
    from: FROM_EMAIL,
    to: toAddresses,
    cc: [],
    subject,
    text: bodyText,
  });
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

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    log.info("Request received", {
      propertyAddress: payload.property_address,
      zipCode: payload.zip_code,
      propertyType: payload.property_type,
      referralPartnerEmail: payload.referral_partner_email,
    });

    const properties = buildQuickReviewProperties(payload);

    const aiResults = await Promise.all(
      properties.map(async (prop) => {
        const aiResult = await callOpenAI(QUICK_REVIEW_SYSTEM_PROMPT, {
          property_address: prop.property_address,
          zip_code: prop.zip_code,
          property_type: prop.property_type,
          property_estimated_value: prop.property_estimated_value,
          debt_on_property: prop.debt_on_property,
        });

        return {
          label: prop.label,
          address: prop.address,
          result: aiResult.result,
          reason:
            aiResult.reason ||
            aiResult.summary ||
            "Requires manual review.",
          summary: aiResult.summary,
        };
      })
    );

    const flagged = aiResults.filter((r) => r.result !== "PASS");

    log.info("AI review complete", {
      propertyCount: aiResults.length,
      flaggedCount: flagged.length,
      results: aiResults.map((r) => ({ label: r.label, result: r.result })),
    });

    if (flagged.length === 0) {
      log.info("PASS — no email sent");
      const summary = aiResults[0]?.summary || "Looks good";
      return res.status(200).json({ result: "PASS", summary });
    }

    log.info("Not PASS — sending email via Resend", { flagged });
    await sendRejectionEmail(payload, flagged);
    log.info("Email sent successfully");

    return res.status(200).json({
      result: "MANUAL_REVIEW",
      reason:
        formatReviewBreakdown(flagged) ||
        "Your submission does not meet our current lending criteria.",
    });
  } catch (err) {
    log.error("Request failed", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
