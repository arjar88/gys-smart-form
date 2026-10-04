// Bot / junk filtering for the public contact form.
// See docs/contact-form-spam.md for the why.

export const HONEYPOT_FIELD = "website";
export const MIN_FILL_MS = 3000;
export const MAX_FILL_MS = 24 * 60 * 60 * 1000;
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
    });
    const result = await response.json();
    return { enabled: true, ok: Boolean(result.success) };
  } catch {
    // Fail open so a Cloudflare outage doesn't silently drop real leads.
    return { enabled: true, ok: true };
  }
}

/**
 * Returns { spam: boolean, reasons: string[] }.
 * Hard fails (honeypot, timing) block on their own; content signals are scored.
 */
export function checkSubmission(body, payload, now = Date.now()) {
  const reasons = [];

  if (String(body?.[HONEYPOT_FIELD] || "").trim()) {
    return { spam: true, reasons: ["honeypot"] };
  }

  const startedAt = Number(body?.startedAt);
  const elapsed = now - startedAt;
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return { spam: true, reasons: ["missing_start_time"] };
  }
  if (elapsed < MIN_FILL_MS) {
    return { spam: true, reasons: ["too_fast"] };
  }
  if (elapsed > MAX_FILL_MS) {
    return { spam: true, reasons: ["stale_start_time"] };
  }

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
