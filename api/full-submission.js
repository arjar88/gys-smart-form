import { Resend } from "resend";
import { callOpenAI } from "./lib/openai.js";
import { submitToPipedrive } from "./lib/pipedrive.js";

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

function formatMoney(value) {
  const n = Number(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value || "N/A");
  return `$${n.toLocaleString("en-US")}`;
}

async function sendWorkerPassEmail(payload, aiResult, dealId) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("RESEND_API_KEY not configured — skipping email.");
    return;
  }

  const resend = new Resend(resendKey);

  await resend.emails.send({
    from: "GYS Mortgage <noreply@gysmortgage.com>",
    to: ["gabriel@gysmortgage.com"],
    subject: `New Deal Submitted — ${payload.business_name || payload.borrower_name}`,
    text: `A new deal has been submitted and passed the AI review.

Referral Partner: ${payload.referral_partner_name || "N/A"}
RP Email: ${payload.referral_partner_email || "N/A"}
RP Phone: ${payload.referral_partner_number || "N/A"}

Borrower: ${payload.borrower_name || "N/A"}
Borrower Email: ${payload.borrower_email || "N/A"}
Borrower Phone: ${payload.borrower_phone || "N/A"}
Business: ${payload.business_name || "N/A"}

Property: ${payload.property_address || "N/A"}
Property Type: ${payload.property_type || "N/A"}
Property Value: ${formatMoney(payload.property_estimated_value)}
Debt on Property: ${formatMoney(payload.debt_on_property)}
Loan Amount Requested: ${formatMoney(payload.loan_amount_request)}

AI Summary: ${aiResult.summary || "N/A"}
AI Confidence: ${aiResult.confidence || "N/A"}%
${aiResult.flags && aiResult.flags.length ? `\nFlags:\n${aiResult.flags.join("\n")}` : ""}

Pipedrive Deal ID: ${dealId || "N/A"}`,
  });
}

async function sendWorkerReviewEmail(payload, aiResult) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("RESEND_API_KEY not configured — skipping email.");
    return;
  }

  const resend = new Resend(resendKey);

  const rpEmail = payload.referral_partner_email;
  const rpName = payload.referral_partner_name || "there";

  const subject =
    aiResult.result === "DECLINE"
      ? `GYS Mortgage — Deal Submission Update`
      : `GYS Mortgage — Deal Submission Under Review`;

  const bodyText =
    aiResult.result === "DECLINE"
      ? `Hi ${rpName},\n\nThank you for your submission to GYS Mortgage.\n\nAfter review, we are unable to move forward with this deal at this time.\n\nReason: ${aiResult.reason || "This opportunity does not meet our current lending criteria."}\n\nProperty: ${payload.property_address || "N/A"}\nProperty Type: ${payload.property_type || "N/A"}\nBorrower: ${payload.borrower_name || "N/A"}\n\nIf you would like to understand more about why this submission did not qualify, please reply to this email.\n\nGYS Mortgage Team`
      : `Hi ${rpName},\n\nThank you for your submission to GYS Mortgage.\n\nYour deal requires a manual review by our team. We will be in touch shortly to discuss next steps.\n\nProperty: ${payload.property_address || "N/A"}\nProperty Type: ${payload.property_type || "N/A"}\nBorrower: ${payload.borrower_name || "N/A"}\n\nIf you have any questions, please reply to this email.\n\nGYS Mortgage Team`;

  const toAddresses = rpEmail ? [rpEmail] : ["gabriel@gysmortgage.com"];

  await resend.emails.send({
    from: "GYS Mortgage <noreply@gysmortgage.com>",
    to: toAddresses,
    cc: rpEmail ? ["gabriel@gysmortgage.com"] : [],
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

  // Return 200 immediately — the frontend shows "Thank you" right away.
  res.status(200).json({ success: true });

  try {
    const payload =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const aiResult = await callOpenAI(FULL_SUBMISSION_SYSTEM_PROMPT, {
      property_address: payload.property_address,
      property_type: payload.property_type,
      property_estimated_value: payload.property_estimated_value,
      debt_on_property: payload.debt_on_property,
      loan_amount_request: payload.loan_amount_request,
      borrower_name: payload.borrower_name,
      business_name: payload.business_name,
    });

    if (aiResult.result === "PASS") {
      const { dealId } = await submitToPipedrive(payload, aiResult.summary);
      await sendWorkerPassEmail(payload, aiResult, dealId).catch((err) =>
        console.error("Failed to send pass email:", err)
      );
    } else {
      await sendWorkerReviewEmail(payload, aiResult).catch((err) =>
        console.error("Failed to send review email:", err)
      );
    }
  } catch (err) {
    console.error("full-submission background error:", err);
  }
}
