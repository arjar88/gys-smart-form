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
import handler from "../api/full-submission.js";
import { callOpenAI } from "../server/lib/openai.js";
import { submitToPipedrive } from "../server/lib/pipedrive.js";
import { sendEmail, WORKER_EMAIL } from "../server/lib/email.js";

const samplePayload = {
  property_address: "456 Oak Ave",
  property_type: "Commercial",
  property_estimated_value: "750000",
  debt_on_property: "200000",
  loan_amount_request: "400000",
  borrower_name: "John Borrower",
  business_name: "Oak Holdings LLC",
  borrower_email: "john@example.com",
  borrower_phone: "+15559876543",
  referral_partner_name: "Jane RP",
  referral_partner_email: "jane@example.com",
  referral_partner_number: "+15551234567",
  referral_partner_company: "RP Co",
  relationship_with_borrower: "We are tight",
  zip_code: "10001",
  notes: "Test note",
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

async function runHandler(payload = samplePayload) {
  const res = createMockRes();
  await handler({ method: "POST", body: payload }, res);
  await waitUntil.mock.calls[0][0];
  return res;
}

describe("full-submission handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("responds immediately with success", async () => {
    callOpenAI.mockResolvedValue({ result: "PASS", summary: "Approved" });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    const res = createMockRes();
    await handler({ method: "POST", body: samplePayload }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("submits to Pipedrive on PASS without sending email", async () => {
    callOpenAI.mockResolvedValue({
      result: "PASS",
      summary: "Worth a discovery call",
      confidence: 92,
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(submitToPipedrive).toHaveBeenCalledOnce();
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends manual review email to RP and CCs borrower on MANUAL_REVIEW", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
      reason: "Special asset type",
      summary: "Needs review",
      confidence: 75,
    });

    await runHandler();

    expect(submitToPipedrive).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: ["john@example.com"],
        subject: "GYS Mortgage — Deal Submission Under Review",
      })
    );
    expect(sendEmail.mock.calls[0][0].text).not.toContain("--- AI Review ---");
    expect(sendEmail.mock.calls[0][0].text).toContain("John Borrower");
  });

  it("sends decline email to RP and CCs borrower on DECLINE", async () => {
    callOpenAI.mockResolvedValue({
      result: "DECLINE",
      reason: "Primary residence",
      summary: "Not eligible",
      confidence: 99,
    });

    await runHandler();

    expect(submitToPipedrive).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: ["john@example.com"],
        subject: "GYS Mortgage — Deal Submission Update",
        text: expect.stringContaining("unable to move forward"),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).not.toContain("--- AI Review ---");
  });

  it("does not pass loan_amount_request to OpenAI", async () => {
    callOpenAI.mockResolvedValue({ result: "PASS", summary: "Approved" });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    const openAiPayload = callOpenAI.mock.calls[0][1];
    expect(openAiPayload).not.toHaveProperty("loan_amount_request");
    expect(openAiPayload).toHaveProperty("zip_code", "10001");
  });

  it("falls back to worker email when RP email is missing", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
      reason: "Needs review",
    });

    await runHandler({ ...samplePayload, referral_partner_email: "" });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [WORKER_EMAIL],
        cc: ["john@example.com"],
      })
    );
  });
});
