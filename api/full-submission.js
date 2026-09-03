import { waitUntil } from "@vercel/functions";
import {
  callOpenAI,
  FULL_SUBMISSION_OUTPUT_SCHEMA,
} from "../server/lib/openai.js";
import {
  FROM_EMAIL,
  WORKER_EMAIL,
  sendEmail,
} from "../server/lib/email.js";
import {
  buildFullManualReviewEmail,
  buildFullPassEmail,
  pickPassTemplateId,
} from "../server/lib/gabe-emails.js";
import {
  lookupExistingBorrower,
  submitToPipedrive,
} from "../server/lib/pipedrive.js";
import { POTENTIAL_LEAD_STAGE_ID } from "../server/lib/pipedrive-deals.js";
import { createLogger } from "../server/lib/logger.js";
import { FULL_SUBMISSION_SYSTEM_PROMPT } from "../server/lib/prompts/full-submission.js";

const log = createLogger("full-submission");

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
  const borrowerEmail = payload.borrower_email;
  const primary = flagged?.[0] || {};
  const { subject, text } = buildFullManualReviewEmail({
    payload,
    reason: primary.reason,
    address: primary.address || payload.property_address,
  });

  const toAddresses = rpEmail ? [rpEmail] : [WORKER_EMAIL];
  const ccAddresses = borrowerEmail ? [borrowerEmail] : [];

  await sendEmail({
    from: FROM_EMAIL,
    to: toAddresses,
    cc: ccAddresses,
    subject,
    text,
  });
}

async function sendPassEmail(payload) {
  const rpEmail = payload.referral_partner_email;
  const borrowerEmail = payload.borrower_email;
  const templateId = pickPassTemplateId(Date.now());
  const { subject, text } = buildFullPassEmail({ payload, templateId });

  const toAddresses = rpEmail ? [rpEmail] : [WORKER_EMAIL];
  const ccAddresses = borrowerEmail ? [borrowerEmail] : [];

  await sendEmail({
    from: FROM_EMAIL,
    to: toAddresses,
    cc: ccAddresses,
    subject,
    text,
  });
}

async function processFullSubmission(payload) {
  try {
    log.info("Background processing started");
    log.info("Calling OpenAI for full submission review");
    const breakdown = await screenAllProperties(payload);
    const flagged = breakdown.filter((property) => property.result !== "PASS");
    const allPass = flagged.length === 0;
    const existingBorrower = await lookupExistingBorrower(
      payload.borrower_phone,
      payload.borrower_email
    );

    log.info("AI review complete", {
      propertyCount: breakdown.length,
      allPass,
      flaggedCount: flagged.length,
      existingBorrower: existingBorrower
        ? {
            personId: existingBorrower.personId,
            matchedBy: existingBorrower.matchedBy,
          }
        : null,
      breakdown,
    });

    if (allPass && !existingBorrower) {
      log.info("PASS — sending to Pipedrive and discovery-call email");
      const pipedriveResult = await submitToPipedrive(payload);
      await sendPassEmail(payload);
      log.info("Background processing complete", {
        action: "pipedrive+resend",
        dealId: pipedriveResult.dealId,
      });
    } else {
      log.info(
        existingBorrower
          ? "EXISTING_BORROWER — sending to Pipedrive (Potential lead) with Gabe note"
          : "MANUAL_REVIEW — sending to Pipedrive (Potential lead) and review email",
        {
          flagged,
          existingBorrower: existingBorrower
            ? {
                personId: existingBorrower.personId,
                matchedBy: existingBorrower.matchedBy,
              }
            : null,
        }
      );
      const pipedriveResult = await submitToPipedrive(payload, {
        stageId: POTENTIAL_LEAD_STAGE_ID,
        reviewBreakdown: flagged,
        ...(existingBorrower ? { existingBorrower } : {}),
      });
      if (flagged.length > 0) {
        await sendWorkerReviewEmail(payload, flagged);
      }
      log.info("Background processing complete", {
        action: flagged.length > 0 ? "pipedrive+resend" : "pipedrive",
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
