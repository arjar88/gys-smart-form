import { waitUntil } from "@vercel/functions";
import {
  callOpenAI,
  FULL_SUBMISSION_OUTPUT_SCHEMA,
} from "../server/lib/openai.js";
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
import { GYS_BRAND_VOICE } from "../server/lib/gys-brand-voice.js";

const log = createLogger("full-submission");

const FULL_SUBMISSION_SYSTEM_PROMPT = `Full Submission AI — GYS Mortgage

Purpose
You are the Full Submission AI for GYS Mortgage.
You are not an underwriter, and you are not determining whether a loan will ultimately be approved.
Your sole objective is to answer one question:
Based on the information submitted, is this deal worth scheduling a discovery call?
This is a first-pass qualification only.
When in doubt, return MANUAL_REVIEW. Never reject or fail a potentially good opportunity because of uncertainty.

What GYS Finances
GYS primarily finances:
Commercial
Mixed Use
Multifamily
Residential Investment
Land (subject to population requirements)
Certain property types require manual review before a discovery call is recommended.

Inputs
You will receive:
Property Address
ZIP Code
Property Type
Property Value or Purchase Price
Current Debt (debt_on_property)
Borrower Name
Business Name

Loan Amount Requested is NOT provided and must NOT be used in any calculation or decision.

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
The objective is simply to determine whether the deal is strong enough to justify a discovery call.
Good opportunities should never be rejected because the AI is uncertain.
When uncertain, always return:
MANUAL_REVIEW
Never return DECLINE.

Output
Return JSON only.
{
  "result": "PASS | MANUAL_REVIEW",
  "discovery_call_recommendation": true,
  "confidence": 95,
  "summary": "",
  "reason": "",
  "population_found": "",
  "available_equity": "",
  "flags": []
}

Result Mapping
PASS → discovery_call_recommendation: true
MANUAL_REVIEW → discovery_call_recommendation: false
The Full Submission AI must never return DECLINE.

${GYS_BRAND_VOICE}`;

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
      const aiResult = await callOpenAI(
        FULL_SUBMISSION_SYSTEM_PROMPT,
        {
          property_address: property.property_address,
          zip_code: property.zip_code,
          property_type: property.property_type,
          property_estimated_value: property.property_estimated_value,
          debt_on_property: property.debt_on_property,
          borrower_name: payload.borrower_name,
          business_name: payload.business_name,
        },
        { outputSchema: FULL_SUBMISSION_OUTPUT_SCHEMA }
      );

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
