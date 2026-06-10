import { createLogger } from "./logger.js";

const log = createLogger("openai");
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

const REVIEW_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    result: { type: "string", enum: ["PASS", "MANUAL_REVIEW", "DECLINE"] },
    next_step: { type: ["string", "null"] },
    discovery_call_recommendation: { type: ["boolean", "null"] },
    confidence: { type: "number" },
    summary: { type: "string" },
    reason: { type: "string" },
    property_type_confirmed: { type: ["string", "null"] },
    population_found: { type: ["string", "null"] },
    available_equity: { type: ["string", "null"] },
    flags: { type: "array", items: { type: "string" } },
  },
  required: [
    "result",
    "next_step",
    "discovery_call_recommendation",
    "confidence",
    "summary",
    "reason",
    "property_type_confirmed",
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

export async function callOpenAI(systemPrompt, userPayload) {
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
          schema: REVIEW_OUTPUT_SCHEMA,
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

  const parsed = JSON.parse(content);

  log.info("OpenAI request succeeded", {
    durationMs,
    result: parsed.result,
    confidence: parsed.confidence,
  });

  log.info("AI decision detail", { durationMs, decision: parsed });

  return parsed;
}
