import { Resend } from "resend";
import { createLogger } from "./logger.js";

const log = createLogger("email");

export const FROM_EMAIL = "GYS Mortgage <subs@gysmortgage.com>";
export const WORKER_EMAIL = "gabriel@gysmortgage.com";

function formatMoney(value) {
  const n = Number(String(value || "").replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value || "N/A");
  return `$${n.toLocaleString("en-US")}`;
}

export function formatPropertyDetails(payload) {
  const lines = [
    `Address: ${payload.property_address || "N/A"}`,
  ];
  if (payload.zip_code) {
    lines.push(`Zip Code: ${payload.zip_code}`);
  }
  lines.push(
    `Value: ${formatMoney(payload.property_estimated_value)}`,
    `Debt: ${formatMoney(payload.debt_on_property)}`,
    `Property Type: ${payload.property_type || "N/A"}`
  );
  return lines.join("\n");
}

export function formatAiReviewDetails(aiResult) {
  const lines = [];

  if (aiResult.reason) lines.push(`Reason: ${aiResult.reason}`);
  if (aiResult.summary) lines.push(`Summary: ${aiResult.summary}`);
  if (aiResult.confidence != null) {
    lines.push(`Confidence: ${aiResult.confidence}%`);
  }
  if (aiResult.property_type_confirmed) {
    lines.push(`Property Type Confirmed: ${aiResult.property_type_confirmed}`);
  }
  if (aiResult.population_found) {
    lines.push(`Population: ${aiResult.population_found}`);
  }
  if (aiResult.available_equity) {
    lines.push(`Available Equity: ${aiResult.available_equity}`);
  }
  if (Array.isArray(aiResult.flags) && aiResult.flags.length > 0) {
    lines.push(`Flags: ${aiResult.flags.join("; ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No additional review details available.";
}

export async function sendEmail(params) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  log.info("Sending email", {
    to: params.to,
    cc: params.cc,
    subject: params.subject,
  });

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send(params);

  if (error) {
    log.error("Resend API rejected send", error, {
      to: params.to,
      subject: params.subject,
    });
    throw new Error(`Resend send failed: ${error.message}`);
  }

  log.info("Email sent", { emailId: data?.id, to: params.to });
  return data;
}
