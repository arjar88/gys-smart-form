import { createLogger } from "./logger.js";

const log = createLogger("openai");
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

export const QUICK_REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    result: { type: "string", enum: ["PASS", "MANUAL_REVIEW"] },
    next_step: {
      type: "string",
      enum: ["REQUEST_FULL_SUBMISSION", "GABE_REVIEW"],
    },
    summary: { type: "string" },
    reason: { type: "string" },
    population_found: { type: "string" },
    available_equity: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "result",
    "next_step",
    "summary",
    "reason",
    "population_found",
    "available_equity",
    "flags",
  ],
  additionalProperties: false,
};

export const FULL_SUBMISSION_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    result: { type: "string", enum: ["PASS", "MANUAL_REVIEW"] },
    discovery_call_recommendation: { type: "boolean" },
    summary: { type: "string" },
    reason: { type: "string" },
    population_found: { type: "string" },
    available_equity: { type: "string" },
    flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "result",
    "discovery_call_recommendation",
    "summary",
    "reason",
    "population_found",
    "available_equity",
    "flags",
  ],
  additionalProperties: false,
};

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part.type === "output_text" && part.text) {
            return part.text;
          }
        }
      }
    }
  }

  return null;
}

function extractWebSearchCalls(data) {
  if (!Array.isArray(data.output)) return [];

  return data.output
    .filter((item) => item.type === "web_search_call")
    .map((item) => ({
      status: item.status,
      actionType: item.action?.type,
      query: item.action?.query,
    }));
}

const ADDRESS_REVIEW_REASONS = new Set([
  "Address does not match the submitted ZIP code.",
  "Unable to verify address and ZIP code.",
]);

const PROPERTY_TYPE_REASONS = {
  "Primary Residence": "Primary residence requires manual review.",
  "Ground-Up Construction": "Ground-up construction requires manual review.",
  Other: "Property type requires manual review.",
};

const EQUITY_PROPERTY_TYPES = new Set([
  "Commercial",
  "Mixed Use",
  "Multifamily",
  "Residential Investment",
  "Land",
]);

function formatDollars(amount) {
  const absolute = Math.abs(amount).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "-" : ""}$${absolute}`;
}

function parseZipPopulation(value, zipCode) {
  const text = String(value || "");
  const commaFormatted = text.match(/\b\d{1,3}(?:,\d{3})+\b/);
  if (commaFormatted) {
    return Number(commaFormatted[0].replaceAll(",", ""));
  }

  const candidates = text.match(/\b\d{4,7}\b/g) || [];
  const population = candidates
    .map(Number)
    .find(
      (number) =>
        String(number) !== String(zipCode) && (number < 1900 || number > 2100)
    );
  return population ?? null;
}

function withDecision(decision, result, reason, availableEquity = "") {
  const isQuickReview = Object.hasOwn(decision, "next_step");
  return {
    ...decision,
    result,
    ...(isQuickReview
      ? {
          next_step:
            result === "PASS" ? "REQUEST_FULL_SUBMISSION" : "GABE_REVIEW",
        }
      : { discovery_call_recommendation: result === "PASS" }),
    summary:
      result === "PASS"
        ? `Address and ZIP match, property type qualifies, and available equity is ${availableEquity}.`
        : reason,
    reason,
    available_equity: availableEquity,
    flags: [],
  };
}

/**
 * The model performs the web-dependent address and population checks. Enforce
 * deterministic screening rules in code so contradictory model prose cannot
 * reverse property-type, value, debt, population, or equity decisions.
 */
export function enforceScreeningDecision(decision, payload) {
  const propertyType = payload?.property_type;
  if (!propertyType || payload?.property_estimated_value === undefined) {
    return decision;
  }

  if (ADDRESS_REVIEW_REASONS.has(decision.reason)) {
    return withDecision(decision, "MANUAL_REVIEW", decision.reason);
  }

  const propertyTypeReason = PROPERTY_TYPE_REASONS[propertyType];
  if (propertyTypeReason) {
    return withDecision(decision, "MANUAL_REVIEW", propertyTypeReason);
  }
  if (!EQUITY_PROPERTY_TYPES.has(propertyType)) {
    return withDecision(
      decision,
      "MANUAL_REVIEW",
      "Property type requires manual review."
    );
  }

  if (propertyType === "Land") {
    const population = parseZipPopulation(
      decision.population_found,
      payload.zip_code
    );
    if (population === null) {
      return withDecision(
        decision,
        "MANUAL_REVIEW",
        "Unable to verify ZIP code population."
      );
    }
    if (population < 75000) {
      return withDecision(
        decision,
        "MANUAL_REVIEW",
        "Land requires a ZIP code population of at least 75,000."
      );
    }
  }

  const valueText = String(payload.property_estimated_value ?? "").trim();
  const propertyValue = Number(valueText.replaceAll(",", ""));
  if (!valueText || !Number.isFinite(propertyValue) || propertyValue <= 0) {
    return withDecision(
      decision,
      "MANUAL_REVIEW",
      "Property value requires manual review."
    );
  }

  const debtText = String(payload.debt_on_property ?? "").trim();
  const normalizedDebt = debtText.toLowerCase();
  const debtIsZero =
    !debtText ||
    normalizedDebt === "n/a" ||
    normalizedDebt === "unknown" ||
    Number(debtText.replaceAll(",", "")) === 0;
  const currentDebt = debtIsZero
    ? 0
    : Number(debtText.replaceAll(",", ""));

  if (!Number.isFinite(currentDebt)) {
    return withDecision(
      decision,
      "MANUAL_REVIEW",
      "Limited available equity."
    );
  }

  const availableEquity = propertyValue * 0.7 - currentDebt;
  const formattedEquity = formatDollars(availableEquity);
  if (availableEquity <= 100000) {
    return withDecision(
      decision,
      "MANUAL_REVIEW",
      "Limited available equity.",
      formattedEquity
    );
  }

  return withDecision(
    decision,
    "PASS",
    "Available equity exceeds $100,000.",
    formattedEquity
  );
}

export async function callOpenAI(
  systemPrompt,
  userPayload,
  { outputSchema = FULL_SUBMISSION_OUTPUT_SCHEMA } = {}
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  log.info("OpenAI request started", {
    model: OPENAI_MODEL,
    webSearch: true,
    payloadKeys: Object.keys(userPayload || {}),
  });

  const startedAt = Date.now();

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: systemPrompt,
      input: `Evaluate this submission:\n${JSON.stringify(userPayload, null, 2)}`,
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      text: {
        format: {
          type: "json_schema",
          name: "review_decision",
          strict: true,
          schema: outputSchema,
        },
      },
    }),
  });

  const durationMs = Date.now() - startedAt;

  if (!response.ok) {
    const errorBody = await response.text();
    log.error("OpenAI request failed", new Error(`HTTP ${response.status}`), {
      status: response.status,
      durationMs,
      body: errorBody.slice(0, 500),
    });
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const webSearchCalls = extractWebSearchCalls(data);

  log.info("Web search usage", {
    durationMs,
    searchCount: webSearchCalls.length,
    used: webSearchCalls.length > 0,
    searches: webSearchCalls,
  });

  const content = extractOutputText(data);

  if (!content) {
    log.error("OpenAI returned empty content", new Error("No content"), {
      durationMs,
    });
    throw new Error("No response returned from OpenAI.");
  }

  const parsed = enforceScreeningDecision(JSON.parse(content), userPayload);

  log.info("OpenAI request succeeded", {
    durationMs,
    result: parsed.result,
  });

  log.info("AI decision detail", { durationMs, decision: parsed });

  return parsed;
}
