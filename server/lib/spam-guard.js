// Bot / junk filtering for the public contact form.
// See docs/contact-form-spam.md for the why.

export const HONEYPOT_FIELD = "website";
export const MIN_FILL_MS = 3000;
export const SPAM_SCORE_THRESHOLD = 2;

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

// A single unbroken token with lots of capitals in the middle, e.g. "fJMAXtJvJtCespdrlnXfCrNx".
export function looksLikeRandomString(value) {
  const text = String(value || "").trim();
  if (text.length < 12 || /\s/.test(text)) return false;
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length < 12) return false;
  const innerUpper = (letters.slice(1).match(/[A-Z]/g) || []).length;
  const lower = (letters.match(/[a-z]/g) || []).length;
  return innerUpper >= 4 && lower >= 4;
}

// Any word of 4+ letters with no vowels at all (e.g. "Vpfqr", "Nbcgvn").
export function hasVowellessWord(value) {
  return String(value || "")
    .split(/[\s-]+/)
    .some((word) => /^[A-Za-z]{4,}$/.test(word) && !/[aeiouy]/i.test(word));
}

// Gmail ignores dots, so bots sprinkle them to make one inbox look like many addresses.
export function isDottedGmail(email) {
  const [local = "", domain = ""] = String(email || "").toLowerCase().split("@");
  return GMAIL_DOMAINS.has(domain) && (local.match(/\./g) || []).length >= 3;
}

export async function verifyTurnstile(token, ip, { secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch } = {}) {
  if (!secret) return { enabled: false, ok: true };
  if (!token) return { enabled: true, ok: false };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json();
    return { enabled: true, ok: Boolean(result.success) };
  } catch {
    // Fail open so a Cloudflare outage or timeout doesn't silently drop real leads.
    return { enabled: true, ok: true };
  }
}

const NOT_SPAM = { spam: false, reasons: [] };
const GUARD_FIELDS = [HONEYPOT_FIELD, "startedAt", "turnstileToken"];

/** Honeypot + timing checks shared by every public form. */
export function checkBotSignals(body, now = Date.now()) {
  if (String(body?.[HONEYPOT_FIELD] || "").trim()) {
    return { spam: true, reasons: ["honeypot"] };
  }

  const startedAt = Number(body?.startedAt);
  if (!(startedAt > 0)) {
    return { spam: true, reasons: ["missing_start_time"] };
  }
  if (now - startedAt < MIN_FILL_MS) {
    return { spam: true, reasons: ["too_fast"] };
  }

  return NOT_SPAM;
}

/**
 * Contact form check: bot signals plus junk-content scoring.
 * Returns { spam: boolean, reasons: string[] }.
 */
export function checkSubmission(body, payload, now = Date.now()) {
  const signals = checkBotSignals(body, now);
  if (signals.spam) return signals;

  const reasons = [];
  let score = 0;
  if (looksLikeRandomString(payload.message)) {
    score += 2;
    reasons.push("random_message");
  }
  if (hasVowellessWord(`${payload.firstName} ${payload.lastName}`)) {
    score += 1;
    reasons.push("random_name");
  }
  if (isDottedGmail(payload.email)) {
    score += 1;
    reasons.push("dotted_gmail");
  }

  return { spam: score >= SPAM_SCORE_THRESHOLD, reasons };
}

export function clientIp(req) {
  return String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
}

/** Removes the guard fields so they never reach OpenAI, Pipedrive or emails. */
export function stripGuardFields(body) {
  const clean = { ...body };
  for (const field of GUARD_FIELDS) delete clean[field];
  return clean;
}

/**
 * Full check for a request: cheap local checks first, Cloudflare only if those pass.
 * Pass `localCheck` to replace the default honeypot + timing check (the contact form adds content scoring).
 */
export async function screenRequest(req, localCheck = checkBotSignals(req.body)) {
  const ip = clientIp(req);
  if (localCheck.spam) return { ...localCheck, ip };

  const turnstile = await verifyTurnstile(req.body?.turnstileToken, ip);
  return turnstile.ok ? { ...NOT_SPAM, ip } : { spam: true, reasons: ["turnstile_failed"], ip };
}
