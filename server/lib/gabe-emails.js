export const CALENDLY_URL = "https://calendly.com/gabriel-gysmortgage/30min";

const ISSUE = {
  PRIMARY_RESIDENCE: "primary_residence",
  LAND: "land",
  EQUITY: "equity",
  PROPERTY_TYPE: "property_type",
  UNCLEAR: "unclear",
};

/**
 * Map canonical screening reasons to Gabe email issue keys.
 * Also accepts close variants so older/partial reasons still map.
 */
export function resolveIssueKey(reason) {
  const text = String(reason || "").trim().toLowerCase();

  if (text.includes("primary residence")) {
    return ISSUE.PRIMARY_RESIDENCE;
  }
  if (
    text.includes("land requires a zip code population") ||
    text.includes("population of at least 75")
  ) {
    return ISSUE.LAND;
  }
  if (text.includes("limited available equity") || text === "limited equity") {
    return ISSUE.EQUITY;
  }
  if (
    text.includes("ground-up construction") ||
    text === "property type requires manual review."
  ) {
    return ISSUE.PROPERTY_TYPE;
  }

  // Address/ZIP, population verify, property value, and any other fail → unclear
  return ISSUE.UNCLEAR;
}

export function firstName(fullName, fallback = "there") {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0];
}

function unclearIssueSentence(reason) {
  const text = String(reason || "").trim();

  if (text === "Address does not match the submitted ZIP code.") {
    return "The ZIP code submitted does not appear to match the property address.";
  }
  if (text === "Unable to verify address and ZIP code.") {
    return "We were unable to verify that the address matches the submitted ZIP code.";
  }
  if (text === "Unable to verify ZIP code population.") {
    return "We were unable to verify the ZIP code population for this property.";
  }
  if (text === "Property value requires manual review.") {
    return "The property value submitted is unclear or missing.";
  }
  if (text) {
    return text.endsWith(".") ? text.slice(0, -1) : text;
  }
  return "One of the details submitted appears unclear or incorrect.";
}

function unclearQuestion(reason) {
  const text = String(reason || "").trim();

  if (
    text === "Address does not match the submitted ZIP code." ||
    text === "Unable to verify address and ZIP code."
  ) {
    return "Can you confirm the correct ZIP code?";
  }
  if (text === "Unable to verify ZIP code population.") {
    return "Can you confirm the property address and ZIP code?";
  }
  if (text === "Property value requires manual review.") {
    return "Can you confirm the estimated property value?";
  }
  return "Can you confirm that information?";
}

function quickIssueAndQuestion(issueKey, reason) {
  switch (issueKey) {
    case ISSUE.PRIMARY_RESIDENCE:
      return {
        issue:
          "I see this is the borrower's primary residence, which we don't lend against.",
        question:
          "Does the borrower own another commercial or investment property we could look at?",
      };
    case ISSUE.LAND:
      return {
        issue:
          "I see the property is vacant land, which we don't lend against in areas with a population below 75,000.",
        question:
          "Does the borrower own another commercial or investment property we could look at?",
      };
    case ISSUE.EQUITY:
      return {
        issue:
          "Based on the value and debt submitted, it looks like there may not be enough equity in the property.",
        question: "Are those numbers correct?",
      };
    case ISSUE.PROPERTY_TYPE:
      return {
        issue: "This property type needs a quick manual review before we move forward.",
        question:
          "Does the borrower own another commercial or investment property we could look at?",
      };
    case ISSUE.UNCLEAR:
    default:
      return {
        issue: unclearIssueSentence(reason),
        question: unclearQuestion(reason),
      };
  }
}

function fullIssueAndQuestion(issueKey, reason) {
  switch (issueKey) {
    case ISSUE.PRIMARY_RESIDENCE:
      return {
        issue: "I see this is your primary residence, which we don't lend against.",
        question:
          "Do you own another commercial or investment property we could look at?",
      };
    case ISSUE.LAND:
      return {
        issue:
          "I see the property is vacant land, which we don't lend against in this area.",
        question:
          "Do you own another commercial or investment property we could look at?",
      };
    case ISSUE.EQUITY:
      return {
        issue:
          "Based on the value and debt submitted, it looks like there may not be enough equity in the property.",
        question: "Are those numbers correct?",
      };
    case ISSUE.PROPERTY_TYPE:
      return {
        issue: "This property type needs a quick manual review before we move forward.",
        question:
          "Do you own another commercial or investment property we could look at?",
      };
    case ISSUE.UNCLEAR:
    default:
      return {
        issue: unclearIssueSentence(reason),
        question: unclearQuestion(reason),
      };
  }
}

/**
 * Pick rotating full-submission PASS template id 1–4.
 */
export function pickPassTemplateId(seed = Date.now()) {
  const n = Math.abs(Number(seed)) || 0;
  return (n % 4) + 1;
}

export function buildQuickManualReviewEmail({ payload, reason, address }) {
  const rpFirst = firstName(payload?.referral_partner_name);
  const propertyAddress = address || payload?.property_address || "N/A";
  const issueKey = resolveIssueKey(reason);
  const { issue, question } = quickIssueAndQuestion(issueKey, reason);

  const subject = `Quick Review — ${propertyAddress}`;
  const text = `Hey ${rpFirst},

Thanks for submitting this.

${issue} ${question}

Gabe
GYS Mortgage`;

  return { subject, text };
}

export function buildFullManualReviewEmail({ payload, reason, address }) {
  const borrowerFirst = firstName(payload?.borrower_name);
  const rpFirst = firstName(payload?.referral_partner_name);
  const propertyAddress = address || payload?.property_address || "N/A";
  const issueKey = resolveIssueKey(reason);
  const { issue, question } = fullIssueAndQuestion(issueKey, reason);

  const subject = `Full Submission — ${propertyAddress}`;
  const text = `Hey ${borrowerFirst} and ${rpFirst},

Thanks for sending this over.

${issue} ${question}

Please reply all and let me know.

Gabe
GYS Mortgage`;

  return { subject, text };
}

const FULL_PASS_TEMPLATES = {
  1: ({ businessName, borrowerFirst, rpFirst }) => ({
    subject: `${businessName}, your file has potential.`,
    text: `Hey ${borrowerFirst} and ${rpFirst},

Thanks for sending this in.

This one made it through our first review and looks like a file worth digging into.

${borrowerFirst}, the next step is to grab a time for a quick discovery call so we can understand the full picture and see what we can put together.

Schedule Your Discovery Call: ${CALENDLY_URL}

${rpFirst}, we'll keep you in the loop as the file moves forward.

Gabe
GYS Mortgage`,
  }),
  2: ({ businessName, borrowerFirst, rpFirst }) => ({
    subject: `${businessName} — This File Looks Promising`,
    text: `Hey ${borrowerFirst} and ${rpFirst},

Based on the information submitted, this looks like a file worth taking to the next step.

${borrowerFirst}, grab a time for a quick discovery call so we can understand the full picture and see what we can put together.

Schedule Your Discovery Call: ${CALENDLY_URL}

${rpFirst}, we'll keep you in the loop as the file moves forward.

Gabe
GYS Mortgage`,
  }),
  3: ({ businessName, borrowerFirst, rpFirst }) => ({
    subject: `${businessName}, we see potential here.`,
    text: `Hey ${borrowerFirst} and ${rpFirst},

The information submitted gives us enough to take a closer look.

${borrowerFirst}, grab a time for a discovery call so we can go through the details and figure out the best path forward.

Schedule Your Discovery Call: ${CALENDLY_URL}

${rpFirst}, we'll keep you updated throughout the process.

Gabe
GYS Mortgage`,
  }),
  4: ({ businessName, borrowerFirst, rpFirst }) => ({
    subject: `${businessName}, this file has enough potential to move forward.`,
    text: `Hey ${borrowerFirst} and ${rpFirst},

This looks like a situation worth digging into.

${borrowerFirst}, use the link below to schedule a discovery call so we can understand what you need and see what options may make sense.

Schedule Your Discovery Call: ${CALENDLY_URL}

${rpFirst}, we'll keep you posted as things move forward.

Gabe
GYS Mortgage`,
  }),
};

export function buildFullPassEmail({ payload, templateId } = {}) {
  const id = [1, 2, 3, 4].includes(templateId)
    ? templateId
    : pickPassTemplateId();
  const businessName =
    String(payload?.business_name || "").trim() || "Your file";
  const borrowerFirst = firstName(payload?.borrower_name);
  const rpFirst = firstName(payload?.referral_partner_name);

  return FULL_PASS_TEMPLATES[id]({
    businessName,
    borrowerFirst,
    rpFirst,
  });
}
