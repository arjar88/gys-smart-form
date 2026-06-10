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
          next_step: null,
          discovery_call_recommendation: true,
          confidence: 95,
          summary: "Looks good",
          reason: "Strong equity",
          property_type_confirmed: "Commercial",
          population_found: "50,000",
          available_equity: "$200,000",
          flags: [],
        }),
      }),
    });

    const { callOpenAI } = await import("./openai.js");
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
  });

  it("logs web search calls when present in response output", async () => {
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
                  discovery_call_recommendation: null,
                  confidence: 90,
                  summary: "Good deal",
                  reason: "Strong equity",
                  property_type_confirmed: "Multifamily",
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

    const { callOpenAI } = await import("./openai.js");
    const result = await callOpenAI("System prompt", {
      property_address: "1819 Flatbush Ave",
      zip_code: "11210",
    });

    expect(result.result).toBe("PASS");
  });
});
