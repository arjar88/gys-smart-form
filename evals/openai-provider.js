import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  callOpenAI,
  QUICK_REVIEW_OUTPUT_SCHEMA,
  FULL_SUBMISSION_OUTPUT_SCHEMA,
} from "../server/lib/openai.js";
import { QUICK_REVIEW_SYSTEM_PROMPT } from "../server/lib/prompts/quick-review.js";
import { FULL_SUBMISSION_SYSTEM_PROMPT } from "../server/lib/prompts/full-submission.js";

function loadEnvFile(filename) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Promptfoo loads `.env`; local Vercel/Vite setup often uses `.env.local`.
loadEnvFile(".env");
loadEnvFile(".env.local");

const PROMPT_CONFIG = {
  "quick-review": {
    systemPrompt: QUICK_REVIEW_SYSTEM_PROMPT,
    outputSchema: QUICK_REVIEW_OUTPUT_SCHEMA,
  },
  "full-submission": {
    systemPrompt: FULL_SUBMISSION_SYSTEM_PROMPT,
    outputSchema: FULL_SUBMISSION_OUTPUT_SCHEMA,
  },
};

function buildPayload(vars) {
  const payload = {
    property_address: vars.property_address,
    zip_code: vars.zip_code,
    property_type: vars.property_type,
    property_estimated_value: vars.property_estimated_value,
    debt_on_property: vars.debt_on_property,
  };

  if (vars.prompt === "full-submission") {
    payload.borrower_name = vars.borrower_name ?? "Eval Borrower";
    payload.business_name = vars.business_name ?? "Eval Holdings LLC";
  }

  return payload;
}

/**
 * Mirrors what production surfaces to the RP:
 * - PASS: summary shown after quick review
 * - MANUAL_REVIEW: reason used in the API response + email review line
 */
function buildUserFacingOutput(decision, vars) {
  const reason =
    decision.reason || decision.summary || "Requires manual review.";
  const address = vars.property_address || "N/A";
  const reviewLine = `Property 1 (${address}): ${reason}`;

  if (decision.result === "PASS") {
    return {
      ...decision,
      user_facing_message: decision.summary || "Looks good",
      email_review_line: null,
    };
  }

  return {
    ...decision,
    user_facing_message: reviewLine,
    email_review_line: reviewLine,
  };
}

export default class GysOpenAIProvider {
  id = () => "gys-openai";

  callApi = async (_prompt, context) => {
    const vars = context?.vars ?? {};
    const promptId = vars.prompt;

    const config = PROMPT_CONFIG[promptId];
    if (!config) {
      return {
        error: `Unknown prompt id "${promptId}". Use "quick-review" or "full-submission".`,
      };
    }

    try {
      const decision = await callOpenAI(
        config.systemPrompt,
        buildPayload(vars),
        { outputSchema: config.outputSchema }
      );

      return {
        output: JSON.stringify(buildUserFacingOutput(decision, vars), null, 2),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  };
}
