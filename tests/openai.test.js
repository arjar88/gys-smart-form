import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;

describe("callOpenAI", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4o");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses Responses API with web_search and JSON schema output", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          result: "PASS",
          discovery_call_recommendation: true,
          summary: "Looks good",
          reason: "Strong equity",
          population_found: "50,000",
          available_equity: "$200,000",
          flags: [],
        }),
      }),
    });

    const { callOpenAI } = await import("../server/lib/openai.js");
    const result = await callOpenAI("System prompt", {
      property_address: "123 Main St",
      zip_code: "10001",
    });

    expect(result.result).toBe("PASS");
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");

    const body = JSON.parse(options.body);
    expect(body.model).toBe("gpt-4o");
    expect(body.tools).toEqual([{ type: "web_search" }]);
    expect(body.tool_choice).toBe("required");
    expect(body.instructions).toBe("System prompt");
    expect(body.input).toContain("123 Main St");
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
  });

  it("parses response when web search calls are present in output", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "web_search_call",
            status: "completed",
            action: { type: "search", query: "11210 zip code population" },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  result: "PASS",
                  next_step: "REQUEST_FULL_SUBMISSION",
                  summary: "Good deal",
                  reason: "Strong equity",
                  population_found: "60,000",
                  available_equity: "$500,000",
                  flags: [],
                }),
              },
            ],
          },
        ],
      }),
    });

    const { callOpenAI } = await import("../server/lib/openai.js");
    const result = await callOpenAI(
      "System prompt",
      {
        property_address: "1819 Flatbush Ave",
        zip_code: "11210",
      },
      { outputSchema: (await import("../server/lib/openai.js")).QUICK_REVIEW_OUTPUT_SCHEMA }
    );

    expect(result.result).toBe("PASS");
  });
});

describe("enforceScreeningDecision", () => {
  const quickPass = {
    result: "PASS",
    next_step: "REQUEST_FULL_SUBMISSION",
    summary: "Model summary",
    reason: "Model reason",
    population_found: "Not applicable.",
    available_equity: "$0",
    flags: ["model flag"],
  };

  it("overrides contradictory equity decisions and preserves the boundary", async () => {
    const { enforceScreeningDecision } = await import(
      "../server/lib/openai.js"
    );
    const result = enforceScreeningDecision(quickPass, {
      property_type: "Commercial",
      property_estimated_value: "500000",
      debt_on_property: "250000",
    });

    expect(result).toMatchObject({
      result: "MANUAL_REVIEW",
      next_step: "GABE_REVIEW",
      reason: "Limited available equity.",
      available_equity: "$100,000",
    });
  });

  it("treats blank debt as zero and corrects a false manual review", async () => {
    const { enforceScreeningDecision } = await import(
      "../server/lib/openai.js"
    );
    const result = enforceScreeningDecision(
      {
        ...quickPass,
        result: "MANUAL_REVIEW",
        next_step: "GABE_REVIEW",
        reason: "Limited available equity.",
      },
      {
        property_type: "Commercial",
        property_estimated_value: "200000",
        debt_on_property: "",
      }
    );

    expect(result).toMatchObject({
      result: "PASS",
      next_step: "REQUEST_FULL_SUBMISSION",
      reason: "Available equity exceeds $100,000.",
      available_equity: "$140,000",
    });
  });

  it("enforces a numeric Land ZIP population below the threshold", async () => {
    const { enforceScreeningDecision } = await import(
      "../server/lib/openai.js"
    );
    const result = enforceScreeningDecision(
      {
        ...quickPass,
        population_found: "Approximately 12,000 residents in ZIP 13617.",
      },
      {
        property_type: "Land",
        property_estimated_value: "500000",
        debt_on_property: "100000",
        zip_code: "13617",
      }
    );

    expect(result).toMatchObject({
      result: "MANUAL_REVIEW",
      next_step: "GABE_REVIEW",
      reason: "Land requires a ZIP code population of at least 75,000.",
    });
  });

  it("uses full-submission recommendation mapping", async () => {
    const { enforceScreeningDecision } = await import(
      "../server/lib/openai.js"
    );
    const result = enforceScreeningDecision(
      {
        result: "PASS",
        discovery_call_recommendation: true,
        summary: "Model summary",
        reason: "Model reason",
        population_found: "Not applicable.",
        available_equity: "$0",
        flags: [],
      },
      {
        property_type: "Primary Residence",
        property_estimated_value: "1000000",
        debt_on_property: "0",
      }
    );

    expect(result).toMatchObject({
      result: "MANUAL_REVIEW",
      discovery_call_recommendation: false,
      reason: "Primary residence requires manual review.",
    });
  });
});
