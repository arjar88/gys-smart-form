import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn((promise) => promise) }));
vi.mock("../server/lib/openai.js", async (importOriginal) => ({
  ...(await importOriginal()),
  callOpenAI: vi.fn(async () => ({ result: "PASS", summary: "ok" })),
}));
vi.mock("../server/lib/pipedrive.js", () => ({ submitToPipedrive: vi.fn(async () => ({})) }));
vi.mock("../server/lib/pipedrive-persons.js", async (importOriginal) => ({
  ...(await importOriginal()),
  findPersonByPhone: vi.fn(async () => null),
  findPersonByEmail: vi.fn(async () => null),
}));
vi.mock("../server/lib/email.js", async (importOriginal) => ({
  ...(await importOriginal()),
  sendEmail: vi.fn(),
}));

import quickReview from "../api/quick-review.js";
import fullSubmission from "../api/full-submission.js";
import { callOpenAI } from "../server/lib/openai.js";
import { submitToPipedrive } from "../server/lib/pipedrive.js";
import { sendEmail } from "../server/lib/email.js";
import { screenRequest, stripGuardFields } from "../server/lib/spam-guard.js";

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.end = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res;
}

const deal = {
  property_address: "123 Main St",
  zip_code: "10001",
  property_type: "Commercial",
  property_estimated_value: "500000",
  debt_on_property: "100000",
  referral_partner_email: "victim@gmail.com",
};

const botBodies = {
  honeypot: { ...deal, website: "spam.com", startedAt: Date.now() - 20000 },
  "direct API post": { ...deal },
  "instant submit": { ...deal, startedAt: Date.now() },
};

describe.each([
  ["quick review", quickReview],
  ["full submission", fullSubmission],
])("%s bot blocking", (_name, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it.each(Object.entries(botBodies))("blocks %s with no OpenAI, Pipedrive or email", async (_label, body) => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { ...body } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(callOpenAI).not.toHaveBeenCalled();
    expect(submitToPipedrive).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("blocks a missing Turnstile token when Turnstile is on", async () => {
    process.env.TURNSTILE_SECRET_KEY = "s";
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { ...deal, startedAt: Date.now() - 20000 } }, res);
    expect(callOpenAI).not.toHaveBeenCalled();
  });

  it("lets a real form submission through to OpenAI", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { ...deal, website: "", startedAt: Date.now() - 20000 } }, res);
    expect(callOpenAI).toHaveBeenCalled();
  });
});

describe("shared guard helpers", () => {
  it("strips guard fields before data reaches OpenAI or Pipedrive", () => {
    expect(stripGuardFields({ a: 1, website: "", startedAt: 5, turnstileToken: "t" })).toEqual({ a: 1 });
  });

  it("skips the Cloudflare call when the local check already failed", async () => {
    process.env.TURNSTILE_SECRET_KEY = "s";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await screenRequest({ headers: {}, body: { website: "x" } });
    expect(result.spam).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
    delete process.env.TURNSTILE_SECRET_KEY;
  });
});
