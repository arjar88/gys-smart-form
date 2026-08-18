import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/pipedrive-organizations.js", () => ({
  findOrCreateOrganization: vi.fn(),
}));

vi.mock("../server/lib/pipedrive-request.js", () => ({
  pipedriveRequest: vi.fn(),
}));

import { findOrCreateOrganization } from "../server/lib/pipedrive-organizations.js";
import { pipedriveRequest } from "../server/lib/pipedrive-request.js";
import {
  findOrCreateBorrower,
  findOrCreateRP,
  splitPersonName,
} from "../server/lib/pipedrive-persons.js";

describe("splitPersonName", () => {
  it("puts the last word in last name and the rest in first name", () => {
    expect(splitPersonName("Eduardo Mercado")).toEqual({
      fullName: "Eduardo Mercado",
      firstName: "Eduardo",
      lastName: "Mercado",
    });
  });

  it("keeps middle names with first name", () => {
    expect(splitPersonName("Mary Ann Smith")).toEqual({
      fullName: "Mary Ann Smith",
      firstName: "Mary Ann",
      lastName: "Smith",
    });
  });

  it("uses a single word as first name", () => {
    expect(splitPersonName("Eduardo")).toEqual({
      fullName: "Eduardo",
      firstName: "Eduardo",
      lastName: "",
    });
  });

  it("collapses extra whitespace", () => {
    expect(splitPersonName("  Jane   Q.  Public  ")).toEqual({
      fullName: "Jane Q. Public",
      firstName: "Jane Q.",
      lastName: "Public",
    });
  });
});

describe("create person name fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOrCreateOrganization.mockResolvedValue(303);
    pipedriveRequest
      .mockResolvedValueOnce({ ok: true, data: { data: { items: [] } } })
      .mockResolvedValueOnce({ ok: true, data: { data: { items: [] } } })
      .mockResolvedValueOnce({
        ok: true,
        data: { data: { id: 202, name: "Eduardo Mercado" } },
      });
  });

  it("sends first_name and last_name when creating a borrower", async () => {
    await findOrCreateBorrower(
      "Eduardo Mercado",
      "+15551112222",
      "eduardo@example.com",
      "Acme LLC",
      "test-token"
    );

    const createCall = pipedriveRequest.mock.calls.find(
      ([action]) => action === "createPerson"
    );
    expect(createCall).toBeTruthy();
    const body = JSON.parse(createCall[2].body);
    expect(body.first_name).toBe("Eduardo");
    expect(body.last_name).toBe("Mercado");
    expect(body.name).toBeUndefined();
  });

  it("sends first_name and last_name when creating a referral partner", async () => {
    await findOrCreateRP(
      "Jane Q. Public",
      "+15553334444",
      "jane@example.com",
      "RP Co",
      "test-token"
    );

    const createCall = pipedriveRequest.mock.calls.find(
      ([action]) => action === "createPerson"
    );
    expect(createCall).toBeTruthy();
    const body = JSON.parse(createCall[2].body);
    expect(body.first_name).toBe("Jane Q.");
    expect(body.last_name).toBe("Public");
    expect(body.name).toBeUndefined();
  });
});
