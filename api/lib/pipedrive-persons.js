import { findOrCreateOrganization } from "./pipedrive-organizations.js";

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

  const res = await fetch(url);
  const data = await res.json();
  const items = (data && data.data && data.data.items) || [];

  const hit = items.find((i) =>
    (i.item.phones || []).some(
      (p) => normalizePhone(extractPhoneValue(p)) === normalized
    )
  );
  if (!hit) return null;

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

  const res = await fetch(url);
  const data = await res.json();
  const items = (data && data.data && data.data.items) || [];

  const hit = items.find((i) =>
    (i.item.emails || []).some(
      (e) => normalizeEmail(extractEmailValue(e)) === normalized
    )
  );
  if (!hit) return null;

  return {
    personId: hit.item.id,
    orgId: hit.item.organization ? hit.item.organization.id : null,
    phones: hit.item.phones || [],
    emails: hit.item.emails || [],
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

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!data.success || !data.data) {
    console.error("Create person failed:", data);
    throw new Error("Failed to create person in Pipedrive");
  }

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

  if (!phonesChanged && !emailsChanged) return;

  const body = {};
  if (phonesChanged) body.phones = updatedPhones;
  if (emailsChanged) body.emails = updatedEmails;

  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v2/persons/${personId}?api_token=${apiToken}`;

  await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function findOrCreateBorrower(
  name,
  phone,
  email,
  businessName,
  apiToken
) {
  const existing = await findExistingPerson(phone, email, apiToken);

  if (existing) {
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

export async function findOrCreateRP(
  name,
  phone,
  email,
  companyName,
  apiToken
) {
  const existing = await findExistingPerson(phone, email, apiToken);
  if (existing) {
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
