import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn((promise) => promise),
}));

vi.mock("../server/lib/openai.js", () => ({
  callOpenAI: vi.fn(),
}));

vi.mock("../server/lib/pipedrive.js", () => ({
  submitToPipedrive: vi.fn(),
}));

vi.mock("../server/lib/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    sendEmail: vi.fn(),
  };
});

import { waitUntil } from "@vercel/functions";
import handler from "../api/quick-review.js";
import { callOpenAI } from "../server/lib/openai.js";
import { submitToPipedrive } from "../server/lib/pipedrive.js";
import { sendEmail, WORKER_EMAIL } from "../server/lib/email.js";
import { MANUAL_REVIEW_STAGE_ID } from "../server/lib/pipedrive-deals.js";

const samplePayload = {
  property_address: "123 Main St",
  zip_code: "10001",
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
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });
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
    expect(submitToPipedrive).not.toHaveBeenCalled();
  });

  it("sends manual review email to RP only on MANUAL_REVIEW", async () => {
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
    expect(res.body.reason).toContain("Property 1 (123 Main St): Limited equity");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: [],
        subject: "GYS Mortgage — Your Quick Review Requires Manual Review",
      })
    );
    expect(sendEmail.mock.calls[0][0].text).not.toContain("--- AI Review ---");
    expect(sendEmail.mock.calls[0][0].text).toContain("123 Main St");
    expect(sendEmail.mock.calls[0][0].text).toContain("10001");
    expect(sendEmail.mock.calls[0][0].text).toContain("The following property requires review:");
    expect(waitUntil).toHaveBeenCalledOnce();
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload, {
      stageId: MANUAL_REVIEW_STAGE_ID,
      reviewBreakdown: [
        {
          label: "Property 1",
          address: "123 Main St",
          result: "MANUAL_REVIEW",
          reason: "Limited equity",
          summary: "Needs Gabe review",
        },
      ],
      includeBorrower: false,
      noteTitle: "Quick Review Submission",
    });
  });

  it("folds DECLINE into manual review (no separate decline path)", async () => {
    callOpenAI.mockResolvedValue({
      result: "DECLINE",
      reason: "Primary residence",
      summary: "Not eligible",
      confidence: 99,
    });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe("MANUAL_REVIEW");
    expect(res.body.reason).toContain("Property 1 (123 Main St): Primary residence");
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: [],
        subject: "GYS Mortgage — Your Quick Review Requires Manual Review",
        text: expect.stringContaining("requires a manual review"),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).not.toContain("--- AI Review ---");
    expect(submitToPipedrive).toHaveBeenCalledOnce();
  });

  it("falls back to worker email when referral partner email is missing", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
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

  it("passes zip_code to OpenAI", async () => {
    callOpenAI.mockResolvedValue({
      result: "PASS",
      summary: "Looks good",
    });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(callOpenAI).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ zip_code: "10001" })
    );
  });

  it("screens each property and returns PASS only when all pass (no email)", async () => {
    const multiPayload = {
      ...samplePayload,
      additional_properties: [
        {
          property_address: "456 Oak Ave",
          zip_code: "10002",
          property_type: "Multifamily",
          property_estimated_value: "800000",
          debt_on_property: "150000",
        },
      ],
    };

    callOpenAI
      .mockResolvedValueOnce({ result: "PASS", summary: "Good primary" })
      .mockResolvedValueOnce({ result: "PASS", summary: "Good additional" });

    const res = createMockRes();
    await handler({ method: "POST", body: multiPayload }, res);

    expect(callOpenAI).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ result: "PASS", summary: "Good primary" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(submitToPipedrive).not.toHaveBeenCalled();
  });

  it("returns MANUAL_REVIEW and sends email with flagged property details when one additional property fails", async () => {
    const multiPayload = {
      ...samplePayload,
      additional_properties: [
        {
          property_address: "456 Oak Ave",
          zip_code: "10002",
          property_type: "Multifamily",
          property_estimated_value: "800000",
          debt_on_property: "150000",
        },
      ],
    };

    callOpenAI
      .mockResolvedValueOnce({ result: "PASS", summary: "Good primary" })
      .mockResolvedValueOnce({
        result: "MANUAL_REVIEW",
        reason: "Limited available equity",
      });

    const res = createMockRes();
    await handler({ method: "POST", body: multiPayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.result).toBe("MANUAL_REVIEW");
    expect(res.body.reason).toContain("Property 2 (456 Oak Ave): Limited available equity");

    expect(sendEmail).toHaveBeenCalledOnce();
    const emailText = sendEmail.mock.calls[0][0].text;
    expect(emailText).toContain("The following property requires review:");
    expect(emailText).toContain("Property 2 (456 Oak Ave): Limited available equity");
    expect(emailText).toContain("Additional Properties (1):");
    expect(emailText).toContain("Property 2: 456 Oak Ave");
    expect(submitToPipedrive).toHaveBeenCalledOnce();
  });
});
