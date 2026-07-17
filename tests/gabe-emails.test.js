import { describe, expect, it } from "vitest";
import {
  CALENDLY_URL,
  buildFullManualReviewEmail,
  buildFullPassEmail,
  buildQuickManualReviewEmail,
  firstName,
  pickPassTemplateId,
  resolveIssueKey,
} from "../server/lib/gabe-emails.js";

describe("resolveIssueKey", () => {
  it("maps canonical screening reasons", () => {
    expect(resolveIssueKey("Primary residence requires manual review.")).toBe(
      "primary_residence"
    );
    expect(
      resolveIssueKey("Land requires a ZIP code population of at least 75,000.")
    ).toBe("land");
    expect(resolveIssueKey("Limited available equity.")).toBe("equity");
    expect(
      resolveIssueKey("Ground-up construction requires manual review.")
    ).toBe("property_type");
    expect(resolveIssueKey("Property type requires manual review.")).toBe(
      "property_type"
    );
  });

  it("maps unclear / address reasons to unclear", () => {
    expect(
      resolveIssueKey("Address does not match the submitted ZIP code.")
    ).toBe("unclear");
    expect(resolveIssueKey("Unable to verify ZIP code population.")).toBe(
      "unclear"
    );
    expect(resolveIssueKey("Property value requires manual review.")).toBe(
      "unclear"
    );
  });
});

describe("firstName", () => {
  it("returns the first token", () => {
    expect(firstName("Jane RP")).toBe("Jane");
  });

  it("falls back when missing", () => {
    expect(firstName("")).toBe("there");
    expect(firstName(null, "friend")).toBe("friend");
  });
});

describe("pickPassTemplateId", () => {
  it("returns 1–4 based on seed", () => {
    expect(pickPassTemplateId(0)).toBe(1);
    expect(pickPassTemplateId(1)).toBe(2);
    expect(pickPassTemplateId(2)).toBe(3);
    expect(pickPassTemplateId(3)).toBe(4);
    expect(pickPassTemplateId(4)).toBe(1);
  });
});

describe("buildQuickManualReviewEmail", () => {
  const payload = {
    referral_partner_name: "Jane RP",
    property_address: "123 Main St",
  };

  it("builds equity email in Gabe voice", () => {
    const email = buildQuickManualReviewEmail({
      payload,
      reason: "Limited available equity.",
      address: "123 Main St",
    });

    expect(email.subject).toBe("Quick Review — 123 Main St");
    expect(email.text).toContain("Hey Jane,");
    expect(email.text).toContain("not be enough equity");
    expect(email.text).toContain("Are those numbers correct?");
    expect(email.text).toContain("Gabe\nGYS Mortgage");
    expect(email.text).not.toContain("GYS Mortgage Team");
  });

  it("builds primary residence email", () => {
    const email = buildQuickManualReviewEmail({
      payload,
      reason: "Primary residence requires manual review.",
    });

    expect(email.text).toContain("primary residence");
    expect(email.text).toContain("another commercial or investment property");
  });
});

describe("buildFullManualReviewEmail", () => {
  const payload = {
    borrower_name: "John Borrower",
    referral_partner_name: "Jane RP",
    property_address: "456 Oak Ave",
  };

  it("greets borrower and RP and asks reply all", () => {
    const email = buildFullManualReviewEmail({
      payload,
      reason: "Limited available equity.",
      address: "456 Oak Ave",
    });

    expect(email.subject).toBe("Full Submission — 456 Oak Ave");
    expect(email.text).toContain("Hey John and Jane,");
    expect(email.text).toContain("Please reply all and let me know.");
    expect(email.text).toContain("Are those numbers correct?");
  });

  it("asks the borrower directly for primary residence", () => {
    const email = buildFullManualReviewEmail({
      payload,
      reason: "Primary residence requires manual review.",
    });

    expect(email.text).toContain("your primary residence");
    expect(email.text).toContain("Do you own another commercial");
  });
});

describe("buildFullPassEmail", () => {
  const payload = {
    business_name: "Oak Holdings LLC",
    borrower_name: "John Borrower",
    referral_partner_name: "Jane RP",
  };

  it("rotates through templates 1–4 with Calendly link", () => {
    for (const templateId of [1, 2, 3, 4]) {
      const email = buildFullPassEmail({ payload, templateId });
      expect(email.subject).toContain("Oak Holdings LLC");
      expect(email.text).toContain("Hey John and Jane,");
      expect(email.text).toContain(CALENDLY_URL);
      expect(email.text).toContain("Schedule Your Discovery Call");
      expect(email.text).toContain("Gabe\nGYS Mortgage");
    }
  });

  it("clamps invalid template ids via pickPassTemplateId", () => {
    const email = buildFullPassEmail({ payload, templateId: 99 });
    expect(email.text).toContain(CALENDLY_URL);
  });
});
