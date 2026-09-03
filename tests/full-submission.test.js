import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn((promise) => promise),
}));

vi.mock("../server/lib/openai.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    callOpenAI: vi.fn(),
  };
});

vi.mock("../server/lib/pipedrive.js", () => ({
  submitToPipedrive: vi.fn(),
  lookupExistingBorrower: vi.fn(),
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
import {
  lookupExistingBorrower,
  submitToPipedrive,
} from "../server/lib/pipedrive.js";
import { sendEmail, WORKER_EMAIL } from "../server/lib/email.js";
import { CALENDLY_URL } from "../server/lib/gabe-emails.js";

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
    lookupExistingBorrower.mockResolvedValue(null);
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

  it("submits to Pipedrive on PASS and sends discovery-call email", async () => {
    callOpenAI.mockResolvedValue({
      result: "PASS",
      summary: "Worth a discovery call",
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(submitToPipedrive).toHaveBeenCalledOnce();
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: ["john@example.com"],
      })
    );
    const email = sendEmail.mock.calls[0][0];
    expect(email.subject).toContain("Oak Holdings LLC");
    expect(email.text).toContain("Hey John and Jane,");
    expect(email.text).toContain(CALENDLY_URL);
    expect(email.text).toContain("Gabe\nGYS Mortgage");
  });

  it("sends Gabe-style manual review email to RP and CCs borrower on MANUAL_REVIEW", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
      reason: "Property type requires manual review.",
      summary: "Needs review",
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(submitToPipedrive).toHaveBeenCalledOnce();
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload, {
      stageId: 54,
      reviewBreakdown: [
        {
          label: "Property 1",
          address: "456 Oak Ave",
          result: "MANUAL_REVIEW",
          reason: "Property type requires manual review.",
        },
      ],
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: ["john@example.com"],
        subject: "Full Submission — 456 Oak Ave",
      })
    );
    const emailText = sendEmail.mock.calls[0][0].text;
    expect(emailText).toContain("Hey John and Jane,");
    expect(emailText).toContain("Please reply all and let me know.");
    expect(emailText).toContain("Gabe\nGYS Mortgage");
    expect(emailText).not.toContain("The following property requires review:");
    expect(emailText).not.toContain("GYS Mortgage Team");
  });

  it("routes DECLINE to potential lead and review email instead of email-only", async () => {
    callOpenAI.mockResolvedValue({
      result: "DECLINE",
      reason: "Primary residence requires manual review.",
      summary: "Not eligible",
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(submitToPipedrive).toHaveBeenCalledOnce();
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload, {
      stageId: 54,
      reviewBreakdown: [
        {
          label: "Property 1",
          address: "456 Oak Ave",
          result: "DECLINE",
          reason: "Primary residence requires manual review.",
        },
      ],
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["jane@example.com"],
        cc: ["john@example.com"],
        subject: "Full Submission — 456 Oak Ave",
        text: expect.stringContaining("primary residence"),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain("Please reply all");
    expect(sendEmail.mock.calls[0][0].text).not.toContain("unable to move forward");
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
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler({ ...samplePayload, referral_partner_email: "" });

    expect(submitToPipedrive).toHaveBeenCalledWith(
      { ...samplePayload, referral_partner_email: "" },
      {
        stageId: 54,
        reviewBreakdown: [
          {
            label: "Property 1",
            address: "456 Oak Ave",
            result: "MANUAL_REVIEW",
            reason: "Needs review",
          },
        ],
      }
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: [WORKER_EMAIL],
        cc: ["john@example.com"],
      })
    );
  });

  it("screens each property and passes when all properties pass", async () => {
    callOpenAI
      .mockResolvedValueOnce({ result: "PASS", summary: "Approved" })
      .mockResolvedValueOnce({ result: "PASS", summary: "Approved" });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    const payloadWithAdditional = {
      ...samplePayload,
      additional_properties: [
        {
          property_address: "789 Pine Rd",
          zip_code: "10003",
          property_type: "Commercial",
          property_estimated_value: "900000",
          debt_on_property: "150000",
          loan_amount_request: "500000",
        },
      ],
    };

    await runHandler(payloadWithAdditional);

    expect(callOpenAI).toHaveBeenCalledTimes(2);
    expect(submitToPipedrive).toHaveBeenCalledWith(payloadWithAdditional);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].text).toContain(CALENDLY_URL);
  });

  it("routes to manual review when one additional property is flagged", async () => {
    callOpenAI
      .mockResolvedValueOnce({ result: "PASS", summary: "Approved" })
      .mockResolvedValueOnce({
        result: "MANUAL_REVIEW",
        reason: "Limited available equity.",
      });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    const payloadWithAdditional = {
      ...samplePayload,
      additional_properties: [
        {
          property_address: "789 Pine Rd",
          zip_code: "10003",
          property_type: "Commercial",
          property_estimated_value: "900000",
          debt_on_property: "150000",
          loan_amount_request: "500000",
        },
      ],
    };

    await runHandler(payloadWithAdditional);

    expect(submitToPipedrive).toHaveBeenCalledWith(payloadWithAdditional, {
      stageId: 54,
      reviewBreakdown: [
        {
          label: "Property 2",
          address: "789 Pine Rd",
          result: "MANUAL_REVIEW",
          reason: "Limited available equity.",
        },
      ],
    });
    expect(sendEmail.mock.calls[0][0].subject).toBe(
      "Full Submission — 789 Pine Rd"
    );
    expect(sendEmail.mock.calls[0][0].text).toContain("not be enough equity");
    expect(sendEmail.mock.calls[0][0].text).toContain("Hey John and Jane,");
    expect(sendEmail.mock.calls[0][0].text).not.toContain("Additional Properties");
  });

  it("routes a passing deal to Manual Review when the borrower already exists", async () => {
    callOpenAI.mockResolvedValue({
      result: "PASS",
      summary: "Worth a discovery call",
    });
    lookupExistingBorrower.mockResolvedValue({
      personId: 202,
      matchedBy: "phone",
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(lookupExistingBorrower).toHaveBeenCalledWith(
      samplePayload.borrower_phone,
      samplePayload.borrower_email
    );
    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload, {
      stageId: 182,
      reviewBreakdown: [],
      existingBorrower: {
        personId: 202,
        matchedBy: "phone",
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("keeps property review email and adds existing-borrower note when both apply", async () => {
    callOpenAI.mockResolvedValue({
      result: "MANUAL_REVIEW",
      reason: "Limited available equity.",
    });
    lookupExistingBorrower.mockResolvedValue({
      personId: 202,
      matchedBy: "email",
    });
    submitToPipedrive.mockResolvedValue({ success: true, dealId: 12345 });

    await runHandler();

    expect(submitToPipedrive).toHaveBeenCalledWith(samplePayload, {
      stageId: 182,
      reviewBreakdown: [
        {
          label: "Property 1",
          address: "456 Oak Ave",
          result: "MANUAL_REVIEW",
          reason: "Limited available equity.",
        },
      ],
      existingBorrower: {
        personId: 202,
        matchedBy: "email",
      },
    });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].text).toContain("not be enough equity");
  });
});
