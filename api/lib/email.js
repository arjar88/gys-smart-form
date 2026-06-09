import { Resend } from "resend";
import { createLogger } from "./logger.js";

const log = createLogger("email");

export const FROM_EMAIL = "GYS Mortgage <subs@gysmortgage.com>";
export const WORKER_EMAIL = "gabriel@gysmortgage.com";

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
