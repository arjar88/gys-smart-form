import { buildScreenerSystemPrompt } from "../constants/qualificationCriteria";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function parseNumeric(value) {
  if (value == null || String(value).trim() === "") return NaN;
  return Number(String(value).replace(/,/g, ""));
}

export async function screenDeal({ property_type, property_estimated_value, loan_amount_request }) {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const propertyValue = parseNumeric(property_estimated_value);
  const loanAmount = parseNumeric(loan_amount_request);

  const userMessage = JSON.stringify({
    property_type,
    property_estimated_value: propertyValue,
    loan_amount_request: loanAmount,
  });

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildScreenerSystemPrompt() },
        {
          role: "user",
          content: `Evaluate this deal submission:\n${userMessage}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Screening request failed (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No screening result returned from OpenAI.");
  }

  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error("Invalid screening response format.");
  }

  if (typeof result.qualified !== "boolean") {
    throw new Error("Screening response missing qualified flag.");
  }

  return {
    qualified: result.qualified,
    reason: result.reason || (result.qualified ? "Your deal meets our initial criteria." : "This deal does not meet our lending criteria."),
  };
}
