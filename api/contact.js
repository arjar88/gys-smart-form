import { FROM_EMAIL, WORKER_EMAIL, sendEmail } from "../server/lib/email.js";
import { createLogger } from "../server/lib/logger.js";

const log = createLogger("contact");

function clean(value) {
  return String(value || "").trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildText(payload) {
  return [
    "New contact form submission",
    "",
    `Name: ${payload.firstName} ${payload.lastName || ""}`.trim(),
    `Email: ${payload.email}`,
    `Phone: ${payload.phone}`,
    `SMS Consent: ${payload.smsConsent ? "Yes" : "No"}`,
    "",
    "Message:",
    payload.message,
  ].join("\n");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const payload = {
      firstName: clean(req.body?.firstName),
      lastName: clean(req.body?.lastName),
      phone: clean(req.body?.phone),
      email: clean(req.body?.email),
      message: clean(req.body?.message),
      smsConsent: Boolean(req.body?.smsConsent),
    };

    if (!payload.firstName || !payload.phone || !payload.email || !payload.message) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }

    if (!isValidEmail(payload.email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    log.info("Received contact submission", {
      email: payload.email,
      smsConsent: payload.smsConsent,
    });

    await sendEmail({
      from: FROM_EMAIL,
      to: WORKER_EMAIL,
      replyTo: payload.email,
      subject: `New GYS Mortgage contact request from ${payload.firstName}`,
      text: buildText(payload),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    log.error("Contact submission failed", err);
    return res.status(500).json({ error: "Unable to submit contact request." });
  }
}
