import { waitUntil } from "@vercel/functions";
import { callOpenAI } from "./lib/openai.js";
import {
  FROM_EMAIL,
  WORKER_EMAIL,
  formatAiReviewDetails,
  formatPropertyDetails,
  sendEmail,
} from "./lib/email.js";
import { submitToPipedrive } from "./lib/pipedrive.js";
import { createLogger } from "./lib/logger.js";

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
- Property Type
- Property Value or Purchase Price
- Current Debt (debt_on_property)
- Desired Loan Amount (loan_amount_request)
- Borrower Name
- Business Name

Property Types: Commercial, Mixed Use, Residential Investment, Primary Residence, Land, Multifamily, Other

IMPORTANT REVIEW RULES
- Use submitted values for calculations.
- You may research the property online and flag concerns.
- Do NOT replace the submitted value with your own estimate.
- Your goal is not perfect underwriting.
- Your goal is determining whether the deal deserves a conversation.

STEP 1 — AUTOMATIC DECLINES
Immediately decline:
- Primary Residence → Reason: GYS does not finance primary residences.
- Ground-Up Construction → Reason: GYS does not finance ground-up construction.
- Land Property With Population Below 75,000 → Reason: Land population below minimum requirement.
- Commercial Property With Population Below 5,000 → Reason: Commercial market population below minimum requirement.

STEP 2 — POPULATION CHECKS
If population cannot be determined with confidence → MANUAL_REVIEW (Reason: Unable to verify population.)
Never decline due to uncertainty.

STEP 3 — PROPERTY TYPE RULES
Mixed Use Properties: Treat as Commercial.

STEP 4 — SPECIAL ASSET REVIEW
Do NOT automatically decline: Hotels, Gas Stations, Churches, Schools, Assisted Living, Mobile Home Parks, Self Storage, Special Purpose Assets.
Result: MANUAL_REVIEW (Reason: Special asset type requires review.)

STEP 5 — RESIDENTIAL INVESTMENT REVIEW
Calculate Available Equity = (Property Value × 75%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Limited available equity. Never decline for low equity.)
If Current Debt is zero or not provided, assume it could be a purchase → PASS (Reason: Potential fit. Residential investment properties may qualify for financing up to approximately 85% LTV, subject to underwriting.)

STEP 6 — COMMERCIAL REVIEW
Calculate Available Equity = (Property Value × 70%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Property may be fully leveraged under conventional commercial guidelines but could still qualify under SBA or alternative lending programs. Never decline for low equity.)
If Current Debt is zero or not provided, assume it could be a purchase → PASS (Reason: Potential fit. Commercial properties may qualify for financing between 70% and 85% LTV depending on program.)

STEP 7 — LOAN AMOUNT SANITY CHECK
If requested loan amount appears materially larger than the available collateral supports → PASS but note this in flags.

STEP 8 — MANUAL REVIEW TRIGGERS
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

async function sendWorkerReviewEmail(payload, aiResult) {
  const rpEmail = payload.referral_partner_email;
  const rpName = payload.referral_partner_name || "there";
  const propertyDetails = formatPropertyDetails(payload);
  const aiReviewDetails = formatAiReviewDetails(aiResult);

  const subject =
    aiResult.result === "DECLINE"
      ? `GYS Mortgage — Deal Submission Update`
      : `GYS Mortgage — Deal Submission Under Review`;

  const bodyText =
    aiResult.result === "DECLINE"
      ? `Hi ${rpName},\n\nThank you for your submission to GYS Mortgage.\n\nAfter review, we are unable to move forward with this deal at this time.\n\n--- AI Review ---\n${aiReviewDetails}\n\n${propertyDetails}\nBorrower: ${payload.borrower_name || "N/A"}\n\nIf you would like to understand more about why this submission did not qualify, please reply to this email.\n\nGYS Mortgage Team`
      : `Hi ${rpName},\n\nThank you for your submission to GYS Mortgage.\n\nYour deal requires a manual review by our team. We will be in touch shortly to discuss next steps.\n\n--- AI Review ---\n${aiReviewDetails}\n\n${propertyDetails}\nBorrower: ${payload.borrower_name || "N/A"}\n\nIf you have any questions, please reply to this email.\n\nGYS Mortgage Team`;

  const toAddresses = rpEmail ? [rpEmail] : [WORKER_EMAIL];
  const ccAddresses = rpEmail ? [WORKER_EMAIL] : [];

  await sendEmail({
    from: FROM_EMAIL,
    to: toAddresses,
    cc: ccAddresses,
    subject,
    text: bodyText,
  });
}

async function processFullSubmission(payload) {
  try {
    log.info("Background processing started");
    log.info("Calling OpenAI for full submission review");
    const aiResult = await callOpenAI(FULL_SUBMISSION_SYSTEM_PROMPT, {
      property_address: payload.property_address,
      property_type: payload.property_type,
      property_estimated_value: payload.property_estimated_value,
      debt_on_property: payload.debt_on_property,
      loan_amount_request: payload.loan_amount_request,
      borrower_name: payload.borrower_name,
      business_name: payload.business_name,
    });

    log.info("AI review complete", {
      result: aiResult.result,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
      summary: aiResult.summary,
      discoveryCall: aiResult.discovery_call_recommendation,
      propertyTypeConfirmed: aiResult.property_type_confirmed,
      populationFound: aiResult.population_found,
      availableEquity: aiResult.available_equity,
      flags: aiResult.flags,
    });

    if (aiResult.result === "PASS") {
      log.info("PASS — sending to Pipedrive (no Resend email on pass)");
      const pipedriveResult = await submitToPipedrive(payload, aiResult.summary);
      log.info("Background processing complete", {
        action: "pipedrive",
        dealId: pipedriveResult.dealId,
      });
    } else {
      log.info("Not PASS — sending review email via Resend", {
        result: aiResult.result,
      });
      await sendWorkerReviewEmail(payload, aiResult);
      log.info("Background processing complete", { action: "resend" });
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
    propertyType: payload.property_type,
    referralPartnerEmail: payload.referral_partner_email,
  });

  // Keep the function alive after responding so OpenAI/Pipedrive/Resend can finish.
  waitUntil(processFullSubmission(payload));

  return res.status(200).json({ success: true });
}
