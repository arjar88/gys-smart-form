import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/pipedrive-persons.js", () => ({
  findOrCreateBorrower: vi.fn(),
  findOrCreateRP: vi.fn(),
  getPartnerDetailsById: vi.fn(),
  findExistingPerson: vi.fn(),
}));

vi.mock("../server/lib/pipedrive-deals.js", () => ({
  createDeal: vi.fn(),
  setCalendlyUid: vi.fn(),
  addReferralPartnerToDeal: vi.fn(),
  addDealNote: vi.fn(),
  setSubmissionNoteId: vi.fn(),
}));

import {
  lookupExistingBorrower,
  lookupPartnerDetails,
  submitToPipedrive,
} from "../server/lib/pipedrive.js";
import {
  findExistingPerson,
  findOrCreateBorrower,
  findOrCreateRP,
  getPartnerDetailsById,
} from "../server/lib/pipedrive-persons.js";
import {
  createDeal,
  setCalendlyUid,
  addReferralPartnerToDeal,
  addDealNote,
  setSubmissionNoteId,
} from "../server/lib/pipedrive-deals.js";

const samplePayload = {
  property_address: "789 Pine Rd",
  property_type: "Commercial",
  property_estimated_value: "600000",
  debt_on_property: "150000",
  loan_amount_request: "300000",
  borrower_name: "Alice Borrower",
  business_name: "Pine LLC",
  borrower_email: "alice@example.com",
  borrower_phone: "+15551112222",
  referral_partner_name: "Bob RP",
  referral_partner_email: "bob@example.com",
  referral_partner_number: "+15553334444",
  referral_partner_company: "Bob Co",
  relationship_with_borrower: "We spoke a few times",
  zip_code: "90210",
  notes: "Follow up soon",
};

describe("submitToPipedrive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIPEDRIVE_API_KEY = "test-api-token";
  });

  it("orchestrates person lookup, deal creation, and post-create steps", async () => {
    findOrCreateRP.mockResolvedValue(101);
    findOrCreateBorrower.mockResolvedValue({ personId: 202, orgId: 303 });
    createDeal.mockResolvedValue(40405);
    addDealNote.mockResolvedValue(12345);

    const result = await submitToPipedrive(samplePayload);

    expect(findOrCreateRP).toHaveBeenCalledWith(
      samplePayload.referral_partner_name,
      samplePayload.referral_partner_number,
      samplePayload.referral_partner_email,
      samplePayload.referral_partner_company,
      "test-api-token"
    );
    expect(findOrCreateBorrower).toHaveBeenCalledWith(
      samplePayload.borrower_name,
      samplePayload.borrower_phone,
      samplePayload.borrower_email,
      samplePayload.business_name,
      "test-api-token"
    );
    expect(createDeal).toHaveBeenCalledWith(
      samplePayload,
      202,
      303,
      101,
      "test-api-token",
      undefined
    );
    expect(setCalendlyUid).toHaveBeenCalledWith(40405, "test-api-token");
    expect(addReferralPartnerToDeal).toHaveBeenCalledWith(
      40405,
      101,
      "test-api-token"
    );
    expect(addDealNote).toHaveBeenCalledWith(
      samplePayload,
      40405,
      "test-api-token",
      [],
      undefined,
      null
    );
    expect(setSubmissionNoteId).toHaveBeenCalledWith(40405, 12345, "test-api-token");
    expect(result).toEqual({ success: true, dealId: 40405 });
  });

  it("forwards stageId option to createDeal", async () => {
    findOrCreateRP.mockResolvedValue(101);
    findOrCreateBorrower.mockResolvedValue({ personId: 202, orgId: 303 });
    createDeal.mockResolvedValue(40405);

    await submitToPipedrive(samplePayload, { stageId: 54 });

    expect(createDeal).toHaveBeenCalledWith(
      samplePayload,
      202,
      303,
      101,
      "test-api-token",
      54
    );
  });

  it("forwards reviewBreakdown to addDealNote", async () => {
    findOrCreateRP.mockResolvedValue(101);
    findOrCreateBorrower.mockResolvedValue({ personId: 202, orgId: 303 });
    createDeal.mockResolvedValue(40405);

    const reviewBreakdown = [
      {
        label: "Property 2",
        address: "789 Pine Rd",
        result: "MANUAL_REVIEW",
        reason: "Limited available equity",
      },
    ];

    await submitToPipedrive(samplePayload, {
      stageId: 54,
      reviewBreakdown,
    });

    expect(addDealNote).toHaveBeenCalledWith(
      samplePayload,
      40405,
      "test-api-token",
      reviewBreakdown,
      undefined,
      null
    );
  });

  it("forwards existingBorrower to addDealNote", async () => {
    findOrCreateRP.mockResolvedValue(101);
    findOrCreateBorrower.mockResolvedValue({ personId: 202, orgId: 303 });
    createDeal.mockResolvedValue(40405);

    const existingBorrower = { personId: 202, matchedBy: "phone" };

    await submitToPipedrive(samplePayload, {
      stageId: 54,
      existingBorrower,
    });

    expect(addDealNote).toHaveBeenCalledWith(
      samplePayload,
      40405,
      "test-api-token",
      [],
      undefined,
      existingBorrower
    );
  });

  it("skips borrower lookup when includeBorrower is false", async () => {
    findOrCreateRP.mockResolvedValue(101);
    createDeal.mockResolvedValue(40405);
    addDealNote.mockResolvedValue(12345);

    const quickReviewPayload = {
      property_address: "123 Main St",
      property_type: "Commercial",
      property_estimated_value: "500000",
      debt_on_property: "100000",
      zip_code: "10001",
      referral_partner_name: "Jane RP",
      referral_partner_email: "jane@example.com",
      referral_partner_number: "+15551234567",
    };

    await submitToPipedrive(quickReviewPayload, {
      stageId: 182,
      reviewBreakdown: [
        {
          label: "Property 1",
          address: "123 Main St",
          result: "MANUAL_REVIEW",
          reason: "Limited equity",
        },
      ],
      includeBorrower: false,
      noteTitle: "Quick Review Submission",
    });

    expect(findOrCreateBorrower).not.toHaveBeenCalled();
    expect(findOrCreateRP).toHaveBeenCalledOnce();
    expect(createDeal).toHaveBeenCalledWith(
      quickReviewPayload,
      null,
      null,
      101,
      "test-api-token",
      182
    );
    expect(addDealNote).toHaveBeenCalledWith(
      quickReviewPayload,
      40405,
      "test-api-token",
      [
        {
          label: "Property 1",
          address: "123 Main St",
          result: "MANUAL_REVIEW",
          reason: "Limited equity",
        },
      ],
      "Quick Review Submission",
      null
    );
  });

  it("throws when PIPEDRIVE_API_KEY is missing", async () => {
    delete process.env.PIPEDRIVE_API_KEY;

    await expect(submitToPipedrive(samplePayload)).rejects.toThrow("PIPEDRIVE_API_KEY is not configured.");
  });
});

describe("lookupExistingBorrower", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIPEDRIVE_API_KEY = "test-api-token";
  });

  it("returns the matching Pipedrive person when found", async () => {
    findExistingPerson.mockResolvedValue({
      personId: 202,
      matchedBy: "phone",
    });

    const result = await lookupExistingBorrower(
      "+15551112222",
      "alice@example.com"
    );

    expect(findExistingPerson).toHaveBeenCalledWith(
      "+15551112222",
      "alice@example.com",
      "test-api-token"
    );
    expect(result).toEqual({
      personId: 202,
      matchedBy: "phone",
    });
  });

  it("returns null when no matching person is found", async () => {
    findExistingPerson.mockResolvedValue(null);

    const result = await lookupExistingBorrower(
      "+15551112222",
      "alice@example.com"
    );

    expect(result).toBeNull();
  });

  it("throws when PIPEDRIVE_API_KEY is missing", async () => {
    delete process.env.PIPEDRIVE_API_KEY;

    await expect(
      lookupExistingBorrower("+15551112222", "alice@example.com")
    ).rejects.toThrow("PIPEDRIVE_API_KEY is not configured.");
  });
});

describe("lookupPartnerDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PIPEDRIVE_API_KEY = "test-api-token";
  });

  it("returns mapped partner details when found", async () => {
    getPartnerDetailsById.mockResolvedValue({
      personId: 101,
      name: "Bob RP",
      email: "bob@example.com",
      phone: "+15553334444",
      company: "Bob Co",
    });

    const result = await lookupPartnerDetails("101");

    expect(getPartnerDetailsById).toHaveBeenCalledWith(
      "101",
      "test-api-token"
    );
    expect(result).toEqual({
      referral_partner_name: "Bob RP",
      referral_partner_email: "bob@example.com",
      referral_partner_number: "+15553334444",
      referral_partner_company: "Bob Co",
    });
  });

  it("returns null when partner is not found", async () => {
    getPartnerDetailsById.mockResolvedValue(null);

    const result = await lookupPartnerDetails("999");

    expect(result).toBeNull();
  });

  it("throws when PIPEDRIVE_API_KEY is missing", async () => {
    delete process.env.PIPEDRIVE_API_KEY;

    await expect(lookupPartnerDetails("101")).rejects.toThrow(
      "PIPEDRIVE_API_KEY is not configured."
    );
  });
});
