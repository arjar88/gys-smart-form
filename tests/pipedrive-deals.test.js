import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/pipedrive-request.js", () => ({
  pipedriveRequest: vi.fn(),
}));

import { pipedriveRequest } from "../server/lib/pipedrive-request.js";
import { createDeal } from "../server/lib/pipedrive-deals.js";

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
});
