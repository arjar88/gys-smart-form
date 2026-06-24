import { describe, expect, it } from "vitest";
import {
  formatAiReviewDetails,
  formatPropertyDetails,
  formatReviewBreakdown,
} from "../server/lib/email.js";

describe("formatPropertyDetails", () => {
  it("formats all property fields including zip code", () => {
    const result = formatPropertyDetails({
      property_address: "123 Main St",
      zip_code: "10001",
      property_estimated_value: "500000",
      debt_on_property: "100,000",
      property_type: "Commercial",
    });

    expect(result).toContain("Address: 123 Main St");
    expect(result).toContain("Zip Code: 10001");
    expect(result).toContain("Value: $500,000");
    expect(result).toContain("Debt: $100,000");
    expect(result).toContain("Property Type: Commercial");
  });

  it("omits zip code line when not provided", () => {
    const result = formatPropertyDetails({
      property_address: "123 Main St",
      property_type: "Commercial",
    });

    expect(result).not.toContain("Zip Code:");
  });

  it("uses N/A for missing text fields and $0 for missing numeric fields", () => {
    const result = formatPropertyDetails({});

    expect(result).toContain("Address: N/A");
    expect(result).toContain("Value: $0");
    expect(result).toContain("Debt: $0");
    expect(result).toContain("Property Type: N/A");
  });

  it("includes additional properties when provided", () => {
    const result = formatPropertyDetails({
      property_address: "123 Main St",
      zip_code: "10001",
      property_estimated_value: "500000",
      debt_on_property: "100000",
      property_type: "Commercial",
      additional_properties: [
        {
          property_address: "456 Oak Ave",
          zip_code: "10002",
          property_estimated_value: "750000",
          debt_on_property: "200000",
          property_type: "Multifamily",
          loan_amount_request: "400000",
        },
      ],
    });

    expect(result).toContain("Additional Properties (1):");
    expect(result).toContain("Property 2: 456 Oak Ave");
    expect(result).toContain("Loan Amount Requested: $400,000");
  });
});

describe("formatReviewBreakdown", () => {
  it("formats flagged properties with label, address, and reason", () => {
    const result = formatReviewBreakdown([
      {
        label: "Property 2",
        address: "456 Oak Ave",
        result: "MANUAL_REVIEW",
        reason: "Limited available equity",
      },
    ]);

    expect(result).toBe(
      "Property 2 (456 Oak Ave): Limited available equity"
    );
  });

  it("returns fallback when no flagged properties are provided", () => {
    expect(formatReviewBreakdown([])).toBe(
      "No specific property details available."
    );
  });
});

describe("formatAiReviewDetails", () => {
  it("formats all AI review fields", () => {
    const result = formatAiReviewDetails({
      reason: "Limited equity",
      summary: "Needs review",
      confidence: 85,
      property_type_confirmed: "Commercial",
      population_found: "50,000",
      available_equity: "$150,000",
      flags: ["Special asset", "Low confidence"],
    });

    expect(result).toContain("Reason: Limited equity");
    expect(result).toContain("Summary: Needs review");
    expect(result).toContain("Confidence: 85%");
    expect(result).toContain("Property Type Confirmed: Commercial");
    expect(result).toContain("Population: 50,000");
    expect(result).toContain("Available Equity: $150,000");
    expect(result).toContain("Flags: Special asset; Low confidence");
  });

  it("returns fallback when no details are available", () => {
    expect(formatAiReviewDetails({})).toBe(
      "No additional review details available."
    );
  });

  it("omits empty flags array", () => {
    const result = formatAiReviewDetails({
      reason: "Primary residence",
      flags: [],
    });

    expect(result).toContain("Reason: Primary residence");
    expect(result).not.toContain("Flags:");
  });
});
