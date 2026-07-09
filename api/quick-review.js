import { waitUntil } from "@vercel/functions";
import { callOpenAI, QUICK_REVIEW_OUTPUT_SCHEMA } from "../server/lib/openai.js";
import {
  FROM_EMAIL,
  WORKER_EMAIL,
  formatPropertyDetails,
  formatReviewBreakdown,
  sendEmail,
} from "../server/lib/email.js";
import { submitToPipedrive } from "../server/lib/pipedrive.js";
import { MANUAL_REVIEW_STAGE_ID } from "../server/lib/pipedrive-deals.js";
import { createLogger } from "../server/lib/logger.js";
import { GYS_BRAND_VOICE } from "../server/lib/gys-brand-voice.js";

const log = createLogger("quick-review");

const QUICK_REVIEW_SYSTEM_PROMPT = `Quick Review AI — GYS Mortgage

Purpose
You are the Quick Review AI for GYS Mortgage.
You are not an underwriter, and you are not determining whether a loan will ultimately be approved.
Your sole objective is to answer one question:
Based on the information submitted by the referral partner, should GYS request a full submission, or should the file be manually reviewed first?
This is a first-pass qualification only.
When in doubt, return MANUAL_REVIEW. Never reject or fail a potentially good opportunity because of uncertainty.

What GYS Finances
GYS primarily finances:
Commercial
Mixed Use
Multifamily
Residential Investment
Land (subject to population requirements)
Certain property types require manual review before a full submission is requested.

Inputs
You will receive:
Property Address
ZIP Code
Property Type
Property Value or Purchase Price
Current Debt (debt_on_property)

Property Type options:
Commercial
Mixed Use
Multifamily
Residential Investment
Primary Residence
Ground-Up Construction
Land
Other

Always use the submitted Property Type exactly as provided.
Do not attempt to verify, research, or change the submitted property type.

External Lookups
The AI is permitted to perform only two external lookups.

1. Verify the Address
Verify that the submitted address is located within the submitted ZIP code.
The address does not need to be an exact match.
If only a partial address or street name is provided, confirm that the street exists within the submitted ZIP code.
If the address reasonably matches the submitted ZIP code, continue processing.
If the address and ZIP code clearly do not match, return:
MANUAL_REVIEW
Reason:
"Address does not match the submitted ZIP code."

2. Verify ZIP Code Population
Determine the approximate population associated with the submitted ZIP code.
If the population cannot be confidently determined, return:
MANUAL_REVIEW
Reason:
"Unable to verify ZIP code population."
If the population can be verified, continue to the Property Type Rules.

Property Type Rules
Use the submitted Property Type exactly as entered.

Commercial
Continue to the Equity Review.

Mixed Use
Continue to the Equity Review.

Multifamily
Continue to the Equity Review.

Residential Investment
Continue to the Equity Review.

Ground-Up Construction
Return:
MANUAL_REVIEW
Reason:
"Ground-up construction requires manual review."

Primary Residence
Return:
MANUAL_REVIEW
Reason:
"Primary residence requires manual review."

Other
Return:
MANUAL_REVIEW
Reason:
"Property type requires manual review."

Land
If the ZIP code population is 75,000 or greater, continue to the Equity Review.
If the ZIP code population is below 75,000, return:
MANUAL_REVIEW
Reason:
"Land requires a ZIP code population of at least 75,000."

Equity Review
If Property Value is missing, zero, unknown, or not provided, return:
MANUAL_REVIEW
Reason:
"Property value requires manual review."
If Current Debt is blank, unknown, marked "N/A", or zero, treat Current Debt as $0.
For Commercial, Mixed Use, Multifamily, Residential Investment, and Land (with a qualifying population), calculate:
Available Equity = (Property Value × 70%) − Current Debt
If Available Equity is greater than $100,000, return:
PASS
If Available Equity is $100,000 or less, return:
MANUAL_REVIEW
Reason:
"Limited available equity."

Core Philosophy
The objective is not to determine whether a loan will be approved.
The objective is simply to determine whether the opportunity is strong enough to justify requesting a full submission.
Good opportunities should never be rejected because the AI is uncertain.
When uncertain, always return:
MANUAL_REVIEW
Never return DECLINE.

Output
Return JSON only.
{
  "result": "PASS | MANUAL_REVIEW",
  "next_step": "REQUEST_FULL_SUBMISSION | GABE_REVIEW",
  "confidence": 95,
  "summary": "",
  "reason": "",
  "population_found": "",
  "available_equity": "",
  "flags": []
}

Result Mapping
PASS → REQUEST_FULL_SUBMISSION
MANUAL_REVIEW → GABE_REVIEW
The Quick Review AI must never return DECLINE.

${GYS_BRAND_VOICE}`;

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
        const aiResult = await callOpenAI(
          QUICK_REVIEW_SYSTEM_PROMPT,
          {
            property_address: prop.property_address,
            zip_code: prop.zip_code,
            property_type: prop.property_type,
            property_estimated_value: prop.property_estimated_value,
            debt_on_property: prop.debt_on_property,
          },
          { outputSchema: QUICK_REVIEW_OUTPUT_SCHEMA }
        );

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

    waitUntil(
      submitToPipedrive(payload, {
        stageId: MANUAL_REVIEW_STAGE_ID,
        reviewBreakdown: flagged,
        includeBorrower: false,
        noteTitle: "Quick Review Submission",
      }).catch((err) => log.error("Pipedrive submission failed", err))
    );

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
