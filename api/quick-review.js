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
import { QUICK_REVIEW_SYSTEM_PROMPT } from "../server/lib/prompts/quick-review.js";

const log = createLogger("quick-review");

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
