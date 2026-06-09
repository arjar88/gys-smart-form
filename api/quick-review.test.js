import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/openai.js", () => ({
  callOpenAI: vi.fn(),
}));

vi.mock("./lib/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sendEmail: vi.fn(),
  };
});

import handler from "./quick-review.js";
import { callOpenAI } from "./lib/openai.js";
import { sendEmail, WORKER_EMAIL } from "./lib/email.js";

const samplePayload = {
  property_address: "123 Main St",
  property_type: "Commercial",
  property_estimated_value: "500000",
  debt_on_property: "100000",
  referral_partner_name: "Jane RP",
  referral_partner_email: "jane@example.com",
  referral_partner_number: "+15551234567",
};

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

describe("quick-review handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns PASS without sending email", async () => {
    callOpenAI.mockResolvedValue({
      result: "PASS",
      summary: "Looks good",
      confidence: 95,
    });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: "PASS", summary: "Looks good" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends manual review email with AI details on MANUAL_REVIEW", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
      reason: "Limited equity",
      summary: "Needs Gabe review",
      confidence: 80,
    });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe("MANUAL_REVIEW");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: [WORKER_EMAIL],
        subject: "GYS Mortgage — Your Quick Review Requires Manual Review",
        text: expect.stringContaining("--- AI Review ---"),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain("Reason: Limited equity");
    expect(sendEmail.mock.calls[0][0].text).toContain("123 Main St");
  });

  it("sends decline email with AI details on DECLINE", async () => {
    callOpenAI.mockResolvedValue({
      result: "DECLINE",
      reason: "Primary residence",
      summary: "Not eligible",
      confidence: 99,
    });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe("DECLINE");
    expect(res.body.reason).toBe("Primary residence");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "GYS Mortgage — Quick Review Result",
        text: expect.stringContaining("Unfortunately, your submission did not pass"),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain("Reason: Primary residence");
  });

  it("falls back to worker email when referral partner email is missing", async () => {
    callOpenAI.mockResolvedValue({
      result: "DECLINE",
      reason: "Out of guidelines",
    });

    const res = createMockRes();
    await handler(
      {
        method: "POST",
        body: { ...samplePayload, referral_partner_email: "" },
      },
      res
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [WORKER_EMAIL],
        cc: [],
      })
    );
  });
});
