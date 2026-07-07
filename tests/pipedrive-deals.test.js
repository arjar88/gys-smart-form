import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/pipedrive-request.js", () => ({
  pipedriveRequest: vi.fn(),
}));

import { pipedriveRequest } from "../server/lib/pipedrive-request.js";
import { addDealNote, createDeal, setSubmissionNoteId } from "../server/lib/pipedrive-deals.js";

const basePayload = {
  business_name: "Acme LLC",
  property_address: "123 Main St",
  property_estimated_value: "500000",
  debt_on_property: "100000",
  loan_amount_request: "300000",
  zip_code: "10001",
  relationship_with_borrower: "We are tight",
};

describe("createDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipedriveRequest.mockResolvedValue({
      ok: true,
      data: { data: { id: 999, title: "Acme LLC" } },
    });
  });

  it("maps Ground-Up Construction to Pipedrive option 169", async () => {
    await createDeal(
      { ...basePayload, property_type: "Ground-Up Construction" },
      1,
      2,
      3,
      "test-token"
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.db5e38e15d0e3e685800ebf6974f1e6851f21877).toBe(169);
  });

  it("maps Multifamily to Pipedrive option 150", async () => {
    await createDeal(
      { ...basePayload, property_type: "Multifamily" },
      1,
      2,
      3,
      "test-token"
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.db5e38e15d0e3e685800ebf6974f1e6851f21877).toBe(150);
  });

  it("uses Scheduling a Call stage by default", async () => {
    await createDeal(
      { ...basePayload, property_type: "Commercial" },
      1,
      2,
      3,
      "test-token"
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.stage_id).toBe(56);
  });

  it("uses provided stageId when specified", async () => {
    await createDeal(
      { ...basePayload, property_type: "Commercial" },
      1,
      2,
      3,
      "test-token",
      54
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.stage_id).toBe(54);
  });

  it("uses property address as title when business_name is missing", async () => {
    const { business_name: _businessName, ...payloadWithoutBusiness } =
      basePayload;

    await createDeal(
      { ...payloadWithoutBusiness, property_type: "Commercial" },
      null,
      null,
      3,
      "test-token",
      182
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.title).toBe("123 Main St");
    expect(body.person_id).toBeUndefined();
    expect(body.org_id).toBeUndefined();
    expect(body.stage_id).toBe(182);
  });
});

const notePayload = {
  borrower_name: "John Borrower",
  borrower_phone: "+15559876543",
  borrower_email: "john@example.com",
  business_name: "Acme LLC",
  referral_partner_name: "Jane RP",
  referral_partner_number: "+15551234567",
  referral_partner_email: "jane@example.com",
  property_address: "123 Main St",
  property_estimated_value: "500000",
  debt_on_property: "100000",
  loan_amount_request: "300000",
  zip_code: "10001",
  property_type: "Commercial",
  relationship_with_borrower: "We are tight",
  notes: "Primary note",
};

describe("addDealNote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipedriveRequest.mockResolvedValue({
      ok: true,
      data: { data: { id: 12345 } },
    });
  });

  it("creates a note without additional properties section when none are provided and returns note id", async () => {
    const noteId = await addDealNote(notePayload, 999, "test-token");

    expect(noteId).toBe(12345);
    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.deal_id).toBe(999);
    expect(body.content).toContain("Property Address: 123 Main St");
    expect(body.content).not.toContain("ADDITIONAL PROPERTIES");
  });

  it("appends additional properties to the same deal note", async () => {
    await addDealNote(
      {
        ...notePayload,
        additional_properties: [
          {
            property_address: "456 Oak Ave",
            zip_code: "10002",
            property_type: "Multifamily",
            property_estimated_value: "750000",
            debt_on_property: "200000",
            loan_amount_request: "400000",
          },
        ],
      },
      999,
      "test-token"
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.content).toContain("--- ADDITIONAL PROPERTIES (1) ---");
    expect(body.content).toContain("PROPERTY 2");
    expect(body.content).toContain("Property Address: 456 Oak Ave");
    expect(body.content).toContain("Property Estimated Value: $750,000");
    expect(body.content).toContain("Loan Amount Requested: $400,000");
  });

  it("appends flagged properties to the deal note when reviewBreakdown is provided", async () => {
    await addDealNote(
      notePayload,
      999,
      "test-token",
      [
        {
          label: "Property 2",
          address: "456 Oak Ave",
          result: "MANUAL_REVIEW",
          reason: "Property type could not be confirmed.",
        },
      ]
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.content).toContain("--- PROPERTIES NEEDING REVIEW (1) ---");
    expect(body.content).toContain(
      "Property 2 (456 Oak Ave): Property type could not be confirmed."
    );
  });

  it("uses custom note title when provided", async () => {
    await addDealNote(notePayload, 999, "test-token", [], "Quick Review Submission");

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.content).toContain("Quick Review Submission");
    expect(body.content).not.toContain("Website Lead Submission");
  });

  it("falls back to N/A for missing borrower fields", async () => {
    await addDealNote(
      {
        ...notePayload,
        borrower_name: undefined,
        borrower_phone: undefined,
        borrower_email: undefined,
      },
      999,
      "test-token"
    );

    const body = JSON.parse(pipedriveRequest.mock.calls[0][2].body);
    expect(body.content).toContain("Borrower: N/A");
    expect(body.content).toContain("Phone: N/A");
    expect(body.content).toContain("Email: N/A");
  });
});

describe("setSubmissionNoteId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pipedriveRequest.mockResolvedValue({ ok: true });
  });

  it("updates the deal with the submission note id", async () => {
    await setSubmissionNoteId(999, 12345, "test-token");

    expect(pipedriveRequest).toHaveBeenCalledWith(
      "setSubmissionNoteId",
      expect.stringContaining("/deals/999"),
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          "47b5f017160cbae79caa4bcaa0c778f8637ea380": "12345",
        }),
      })
    );
  });
});
