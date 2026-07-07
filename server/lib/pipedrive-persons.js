import { findOrCreateOrganization } from "./pipedrive-organizations.js";
import { pipedriveRequest } from "./pipedrive-request.js";
import { createLogger } from "./logger.js";

const log = createLogger("pipedrive-persons");
const COMPANY_DOMAIN = "gysmortgage";

function normalizePhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function extractPhoneValue(p) {
  return typeof p === "string" ? p : (p && p.value) || "";
}

function extractEmailValue(e) {
  return typeof e === "string" ? e : (e && e.value) || "";
}

function clonePhoneForPatch(p) {
  const value = extractPhoneValue(p);
  const obj = typeof p === "object" && p ? p : null;
  const out = { value, primary: !!(obj && obj.primary) };
  if (obj && obj.label) out.label = obj.label;
  return out;
}

function cloneEmailForPatch(e) {
  const value = extractEmailValue(e);
  const obj = typeof e === "object" && e ? e : null;
  const out = { value, primary: !!(obj && obj.primary) };
  if (obj && obj.label) out.label = obj.label;
  return out;
}

async function searchPersonByPhone(phone, apiToken) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const url =
    `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/persons/search` +
    `?term=${encodeURIComponent(normalized)}&fields=phone&exact_match=false&api_token=${apiToken}`;

  const { ok, data } = await pipedriveRequest("searchPersonByPhone", url);
  if (!ok) return null;

  const items = (data && data.data && data.data.items) || [];
  const hit = items.find((i) =>
    (i.item.phones || []).some(
      (p) => normalizePhone(extractPhoneValue(p)) === normalized
    )
  );

  if (!hit) return null;

  log.info("Found person by phone", { personId: hit.item.id });
  return {
    personId: hit.item.id,
    orgId: hit.item.organization ? hit.item.organization.id : null,
    phones: hit.item.phones || [],
    emails: hit.item.emails || [],
  };
}

async function searchPersonByEmail(email, apiToken) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  const url =
    `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/persons/search` +
    `?term=${encodeURIComponent(normalized)}&fields=email&exact_match=false&api_token=${apiToken}`;

  const { ok, data } = await pipedriveRequest("searchPersonByEmail", url);
  if (!ok) return null;

  const items = (data && data.data && data.data.items) || [];
  const hit = items.find((i) =>
    (i.item.emails || []).some(
      (e) => normalizeEmail(extractEmailValue(e)) === normalized
    )
  );

  if (!hit) return null;

  const item = hit.item;
  log.info("Found person by email", { personId: item.id });
  return {
    personId: item.id,
    orgId: item.organization ? item.organization.id : null,
    phones: item.phones || [],
    emails: item.emails || [],
  };
}

async function findExistingPerson(phone, email, apiToken) {
  const byPhone = await searchPersonByPhone(phone, apiToken);
  if (byPhone) return byPhone;
  return searchPersonByEmail(email, apiToken);
}

function getContactTypeId(label) {
  const map = {
    "Referral Partner": 157,
    Borrower: 158,
    Other: 159,
  };
  return map[label] || null;
}

async function createPerson(name, phone, email, orgId, contactType, apiToken) {
  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v2/persons?api_token=${apiToken}`;

  const normalizedPhone = normalizePhone(phone);
  const normalizedEmail = normalizeEmail(email);

  const body = {
    name,
    phones: [{ value: normalizedPhone, primary: true }],
  };

  if (normalizedEmail) {
    body.emails = [{ value: normalizedEmail, primary: true }];
  }
  if (orgId) body.org_id = orgId;
  if (contactType) {
    const typeId = getContactTypeId(contactType);
    if (typeId) {
      body.custom_fields = {
        ef1715a9601f0590e83f6b377d5db1350d6b7a21: typeId,
      };
    }
  }

  log.info("Creating person", { name, contactType, orgId });

  const { ok, data } = await pipedriveRequest("createPerson", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!ok || !data?.data) {
    throw new Error("Failed to create person in Pipedrive");
  }

  log.info("Created person", { personId: data.data.id, name: data.data.name });
  return data.data.id;
}

async function updatePersonContactInfo(
  personId,
  existingPhones,
  existingEmails,
  newPhone,
  newEmail,
  apiToken
) {
  const normalizedNewPhone = normalizePhone(newPhone);
  const normalizedNewEmail = normalizeEmail(newEmail);

  const updatedPhones = (existingPhones || []).map(clonePhoneForPatch);
  const updatedEmails = (existingEmails || []).map(cloneEmailForPatch);

  let phonesChanged = false;
  let emailsChanged = false;

  if (normalizedNewPhone) {
    const hasPhone = updatedPhones.some(
      (p) => normalizePhone(p.value) === normalizedNewPhone
    );
    if (!hasPhone) {
      updatedPhones.push({ value: normalizedNewPhone, primary: false });
      phonesChanged = true;
    }
  }

  if (normalizedNewEmail) {
    const hasEmail = updatedEmails.some(
      (e) => normalizeEmail(e.value) === normalizedNewEmail
    );
    if (!hasEmail) {
      updatedEmails.push({ value: normalizedNewEmail, primary: false });
      emailsChanged = true;
    }
  }

  if (!phonesChanged && !emailsChanged) {
    log.info("Person contact info unchanged", { personId });
    return;
  }

  const body = {};
  if (phonesChanged) body.phones = updatedPhones;
  if (emailsChanged) body.emails = updatedEmails;

  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${apiToken}`;

  await pipedriveRequest("updatePersonContactInfo", url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  log.info("Updated person contact info", { personId });
}

export async function findOrCreateBorrower(
  name,
  phone,
  email,
  businessName,
  apiToken
) {
  log.info("Finding or creating borrower", { name, email, businessName });

  const existing = await findExistingPerson(phone, email, apiToken);

  if (existing) {
    log.info("Using existing borrower", { personId: existing.personId });
    await updatePersonContactInfo(
      existing.personId,
      existing.phones,
      existing.emails,
      phone,
      email,
      apiToken
    );
    const orgId =
      existing.orgId ||
      (await findOrCreateOrganization(businessName, apiToken));
    return { personId: existing.personId, orgId };
  }

  const orgId = await findOrCreateOrganization(businessName, apiToken);
  const personId = await createPerson(
    name,
    phone,
    email,
    orgId,
    "Borrower",
    apiToken
  );
  return { personId, orgId };
}

export async function getPartnerDetailsById(id, apiToken) {
  if (!id) return null;

  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/persons/${id}?api_token=${apiToken}`;

  const { ok, data } = await pipedriveRequest("getPersonById", url);
  if (!ok || !data?.data) {
    log.info("No partner found by ID", { id });
    return null;
  }

  const person = data.data;
  const phoneArr = person.phone || person.phones || [];
  const emailArr = person.email || person.emails || [];
  const primaryPhone = phoneArr.find((p) => p.primary) || phoneArr[0];
  const primaryEmail = emailArr.find((e) => e.primary) || emailArr[0];

  return {
    personId: person.id,
    name: person.name || "",
    email: extractEmailValue(primaryEmail) || "",
    phone: normalizePhone(extractPhoneValue(primaryPhone)),
    company: person.org_id?.name || person.org_name || "",
  };
}

export async function findOrCreateRP(
  name,
  phone,
  email,
  companyName,
  apiToken
) {
  log.info("Finding or creating referral partner", { name, email, companyName });

  const existing = await findExistingPerson(phone, email, apiToken);
  if (existing) {
    log.info("Using existing referral partner", { personId: existing.personId });
    await updatePersonContactInfo(
      existing.personId,
      existing.phones,
      existing.emails,
      phone,
      email,
      apiToken
    );
    return existing.personId;
  }

  const orgId = await findOrCreateOrganization(companyName, apiToken);
  return createPerson(name, phone, email, orgId, "Referral Partner", apiToken);
}
