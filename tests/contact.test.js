import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/lib/email.js", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, sendEmail: vi.fn() };
});

import handler from "../api/contact.js";
import { sendEmail } from "../server/lib/email.js";
import {
  checkSubmission,
  hasVowellessWord,
  isDottedGmail,
  looksLikeRandomString,
  verifyTurnstile,
} from "../server/lib/spam-guard.js";

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res;
}

const realLead = {
  firstName: "Michael",
  lastName: "Schwartz",
  email: "michael.schwartz@gmail.com",
  phone: "+12125551234",
  message: "Looking for a bridge loan on a mixed-use property in Brooklyn.",
  smsConsent: true,
};

// The actual junk submission received on Oct 1, 2026.
const botLead = {
  firstName: "Vpfqr",
  lastName: "Nbcgvn",
  email: "b.rendanm.cc.o.n.n.e.ll.fg6.0.2@gmail.com",
  phone: "+15275276215",
  message: "fJMAXtJvJtCespdrlnXfCrNx",
  smsConsent: true,
};

const humanTiming = () => ({ startedAt: Date.now() - 20000, website: "" });

describe("spam-guard helpers", () => {
  it("detects random mixed-case strings", () => {
    expect(looksLikeRandomString("fJMAXtJvJtCespdrlnXfCrNx")).toBe(true);
    expect(looksLikeRandomString("Please call me tomorrow")).toBe(false);
    expect(looksLikeRandomString("McDonaldsMortgage")).toBe(false);
  });

  it("detects vowelless names without flagging normal names", () => {
    expect(hasVowellessWord("Vpfqr Nbcgvn")).toBe(true);
    expect(hasVowellessWord("Michael Schwartz")).toBe(false);
    expect(hasVowellessWord("Lynn Glynn")).toBe(false);
  });

  it("detects heavily dotted Gmail addresses", () => {
    expect(isDottedGmail(botLead.email)).toBe(true);
    expect(isDottedGmail("michael.schwartz@gmail.com")).toBe(false);
    expect(isDottedGmail("a.b.c.d@company.com")).toBe(false);
  });

  it("blocks honeypot, missing timing and too-fast submissions", () => {
    expect(checkSubmission({ website: "x", startedAt: 1 }, realLead).reasons).toEqual(["honeypot"]);
    expect(checkSubmission({}, realLead).reasons).toEqual(["missing_start_time"]);
    expect(checkSubmission({ startedAt: Date.now() - 500 }, realLead).reasons).toEqual(["too_fast"]);
  });

  it("scores the screenshot submission as spam and a real lead as clean", () => {
    expect(checkSubmission(humanTiming(), botLead).spam).toBe(true);
    expect(checkSubmission(humanTiming(), realLead).spam).toBe(false);
  });

  it("skips Turnstile when no secret is configured", async () => {
    expect(await verifyTurnstile("", "", { secret: "" })).toEqual({ enabled: false, ok: true });
  });

  it("rejects a missing Turnstile token when configured", async () => {
    expect(await verifyTurnstile("", "", { secret: "s" })).toEqual({ enabled: true, ok: false });
  });

  it("passes the Cloudflare verdict through", async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ success: false }) }));
    expect(await verifyTurnstile("t", "1.2.3.4", { secret: "s", fetchImpl })).toEqual({ enabled: true, ok: false });
  });
});

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockReset();
    delete process.env.TURNSTILE_SECRET_KEY;
  });

  it("emails a real lead", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { ...realLead, ...humanTiming() } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("silently drops bot submissions without emailing", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: { ...botLead, ...humanTiming() } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("drops direct API posts that skip the form", async () => {
    const res = mockRes();
    await handler({ method: "POST", headers: {}, body: realLead }, res);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
