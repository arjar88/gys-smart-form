import { callOpenAI } from "./lib/openai.js";
import { FROM_EMAIL, WORKER_EMAIL, sendEmail } from "./lib/email.js";
import { createLogger } from "./lib/logger.js";

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
- Property Type
- Property Value or Purchase Price
- Current Debt (debt_on_property)

Property Types: Commercial, Mixed Use, Multifamily, Residential Investment, Primary Residence, Land, Other

IMPORTANT RULES
- Use the values submitted by the referral partner.
- You may research the property to: confirm property type, confirm population, identify obvious concerns.
- Do NOT replace the submitted value with your own estimate.

STEP 1 — AUTOMATIC DECLINES
Immediately decline:
- Primary Residence → Reason: GYS does not finance primary residences.
- Ground-Up Construction → Reason: GYS does not finance ground-up construction.
- Land Property With Population Below 75,000 → Reason: Land population below minimum requirement.
- Commercial Property With Population Below 5,000 → Reason: Commercial market population below minimum requirement.

STEP 2 — PROPERTY TYPE REVIEW
Pull the data that was submitted to determine property type.

STEP 3 — RESIDENTIAL INVESTMENT REVIEW
Calculate Available Equity = (Property Value × 75%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Limited available equity.)
If Current Debt is zero or unknown, assume it could be a purchase → PASS (Reason: Potential fit for residential investment financing.)

STEP 4 — COMMERCIAL REVIEW
Calculate Available Equity = (Property Value × 70%) − Current Debt
If Available Equity > $100,000 → PASS
If Available Equity ≤ $100,000 → MANUAL_REVIEW (Reason: Property may be fully leveraged under standard commercial guidelines and requires review.)
If Current Debt is zero or unknown, assume it could be a purchase → PASS (Reason: Potential fit for commercial financing.)

STEP 5 — SPECIAL ASSET REVIEW
Automatically send to MANUAL_REVIEW: Hotels, Gas Stations, Churches, Schools, Assisted Living, Mobile Home Parks, Self Storage, Special Purpose Assets.
Reason: Special asset requires review before requesting a full submission.

STEP 6 — MANUAL REVIEW TRIGGERS
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

function formatMoney(value) {
  const n = Number(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value || "N/A");
  return `$${n.toLocaleString("en-US")}`;
}

async function sendRejectionEmail(payload, aiResult) {
  const rpEmail = payload.referral_partner_email;
  const rpName = payload.referral_partner_name || "there";

  const isManualReview = aiResult.result === "MANUAL_REVIEW";
  const subject = isManualReview
    ? "GYS Mortgage — Your Quick Review Requires Manual Review"
    : "GYS Mortgage — Quick Review Result";

  const bodyText = isManualReview
    ? `Hi ${rpName},\n\nThank you for submitting your deal for a quick review.\n\nYour submission requires a manual review before we can proceed. Our team will be in touch shortly to discuss next steps.\n\nProperty: ${payload.property_address || "N/A"}\nProperty Type: ${payload.property_type || "N/A"}\nProperty Value: ${formatMoney(payload.property_estimated_value)}\n\nIf you have any questions, please reply to this email.\n\nGYS Mortgage Team`
    : `Hi ${rpName},\n\nThank you for submitting your deal for a quick review.\n\nUnfortunately, your submission did not pass our initial screening.\n\nReason: ${aiResult.reason || "This opportunity does not meet our current lending criteria."}\n\nProperty: ${payload.property_address || "N/A"}\nProperty Type: ${payload.property_type || "N/A"}\nProperty Value: ${formatMoney(payload.property_estimated_value)}\n\nIf you would like to understand more about why your submission did not qualify, please reply to this email and we will be happy to explain.\n\nGYS Mortgage Team`;

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
      propertyType: payload.property_type,
      referralPartnerEmail: payload.referral_partner_email,
    });

    const aiResult = await callOpenAI(QUICK_REVIEW_SYSTEM_PROMPT, {
      property_address: payload.property_address,
      property_type: payload.property_type,
      property_estimated_value: payload.property_estimated_value,
      debt_on_property: payload.debt_on_property,
    });

    log.info("AI review complete", {
      result: aiResult.result,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
      summary: aiResult.summary,
      nextStep: aiResult.next_step,
      propertyTypeConfirmed: aiResult.property_type_confirmed,
      populationFound: aiResult.population_found,
      availableEquity: aiResult.available_equity,
      flags: aiResult.flags,
    });

    if (aiResult.result === "PASS") {
      log.info("PASS — no email sent");
      return res.status(200).json({ result: "PASS", summary: aiResult.summary });
    }

    log.info("Not PASS — sending email via Resend", { result: aiResult.result });
    await sendRejectionEmail(payload, aiResult);
    log.info("Email sent successfully");

    return res.status(200).json({
      result: aiResult.result,
      reason:
        aiResult.reason ||
        "Your submission does not meet our current lending criteria.",
    });
  } catch (err) {
    log.error("Request failed", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
