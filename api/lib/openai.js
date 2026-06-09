import { createLogger } from "./logger.js";

const log = createLogger("openai");
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export async function callOpenAI(systemPrompt, userPayload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  log.info("OpenAI request started", {
    model: "gpt-4o",
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
      model: "gpt-4o",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Evaluate this submission:\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ],
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
  const content = data.choices?.[0]?.message?.content;

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
