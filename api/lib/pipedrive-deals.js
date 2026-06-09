import { pipedriveRequest } from "./pipedrive-request.js";
import { createLogger } from "./logger.js";

const log = createLogger("pipedrive-deals");
const COMPANY_DOMAIN = "gysmortgage";

function getPropertyTypeId(label) {
  const map = {
    Commercial: 146,
    "Residential Investment": 147,
    "Primary Residence": 148,
    "Mixed Use": 149,
    Multifamily: 150,
    Other: 151,
  };
  return map[label] || null;
}

function getRelationshipTypeId(label) {
  const map = {
    "We are tight": 166,
    "No idea who this is": 167,
    "We spoke a few times": 168,
  };
  return map[label] || null;
}

function parseNumericValue(value) {
  if (value == null || String(value).trim() === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

function formatMoneyForNote(value) {
  if (value == null || String(value).trim() === "") return "N/A";
  const n = Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US");
}

export async function createDeal(payload, borrowerId, organizationId, rpId, apiToken) {
  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/deals?api_token=${apiToken}`;

  const dealData = {
    title: payload.business_name,
    person_id: borrowerId,
    org_id: organizationId,
    pipeline_id: 10,
    stage_id: 54,
    status: "open",
    d903d5c1eb13f0b080d804d8da57d4cef97f5720: rpId,
    "16579d25bd4835bcd26420525830ab4d36632c8a": payload.property_address,
    "30c6290521974089a460239c0bcef01782803a9e": parseNumericValue(
      payload.property_estimated_value
    ),
    "9a0d6ccdf53b022fade3c1467e9b69301b277660": parseNumericValue(
      payload.debt_on_property
    ),
    db5e38e15d0e3e685800ebf6974f1e6851f21877: getPropertyTypeId(
      payload.property_type
    ),
    b854a87bb38f026b9c5cc8591960e291e36642d1: parseNumericValue(
      payload.loan_amount_request
    ),
    e197b5d57a279834d7f0779caeb45e61f888a409: payload.zip_code,
    d4a3e6efc23e30a7f95654def5c386a678166f58: getRelationshipTypeId(
      payload.relationship_with_borrower
    ),
  };

  log.info("Creating deal", {
    title: dealData.title,
    borrowerId,
    organizationId,
    rpId,
    propertyType: payload.property_type,
    propertyTypeId: dealData.db5e38e15d0e3e685800ebf6974f1e6851f21877,
  });

  const { ok, data } = await pipedriveRequest("createDeal", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(dealData),
  });

  if (!ok || !data?.data) {
    throw new Error("Deal creation failed");
  }

  log.info("Deal created", { dealId: data.data.id, title: data.data.title });
  return data.data.id;
}

export async function addReferralPartnerToDeal(dealId, rpId, apiToken) {
  if (!rpId) {
    log.info("Skipping deal participant — no referral partner id", { dealId });
    return;
  }

  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/deals/${dealId}/participants?api_token=${apiToken}`;

  const { ok } = await pipedriveRequest("addReferralPartnerToDeal", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id: rpId }),
  });

  if (!ok) {
    throw new Error("Failed to add referral partner to deal");
  }

  log.info("Added referral partner to deal", { dealId, rpId });
}

export async function addDealNote(payload, dealId, aiSummary, apiToken) {
  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/notes?api_token=${apiToken}`;

  const noteData = {
    deal_id: dealId,
    content: `Website Lead Submission

Borrower: ${payload.borrower_name}
Phone: ${payload.borrower_phone}
Email: ${payload.borrower_email}
Company: ${payload.business_name || "N/A"}

Referral Partner: ${payload.referral_partner_name || "N/A"}
RP Phone: ${payload.referral_partner_number || "N/A"}
RP Email: ${payload.referral_partner_email || "N/A"}

Property Address: ${payload.property_address}
Property Estimated Value: $${formatMoneyForNote(payload.property_estimated_value)}
Debt on Property: $${formatMoneyForNote(payload.debt_on_property)}
Property Type: ${payload.property_type}
Loan Amount Requested: $${formatMoneyForNote(payload.loan_amount_request)}
Zip Code: ${payload.zip_code || "N/A"}
Relationship With Borrower: ${payload.relationship_with_borrower || "N/A"}

Notes: ${payload.notes || "N/A"}

--- AI Review ---
${aiSummary || "N/A"}`,
  };

  log.info("Adding deal note", { dealId });

  const { ok } = await pipedriveRequest("addDealNote", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(noteData),
  });

  if (!ok) {
    throw new Error("Failed to add deal note");
  }

  log.info("Deal note added", { dealId });
}
