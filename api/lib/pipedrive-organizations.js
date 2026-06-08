const COMPANY_DOMAIN = "gysmortgage";

function normalizeOrgName(name) {
  return (name || "").trim().toLowerCase();
}

async function searchOrganization(name, apiToken) {
  const normalized = normalizeOrgName(name);
  if (!normalized) return null;

  const url =
    `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/organizations/search` +
    `?term=${encodeURIComponent(normalized)}&exact_match=false&api_token=${apiToken}`;

  const res = await fetch(url);
  const data = await res.json();
  const items = (data.data && data.data.items) || [];

  const hit = items.find((i) => normalizeOrgName(i.item.name) === normalized);
  return hit ? hit.item.id : null;
}

async function createOrganization(name, apiToken) {
  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/organizations?api_token=${apiToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });

  const data = await res.json();

  if (!data.success || !data.data) {
    console.error("Organization creation failed:", data);
    throw new Error("Failed to create organization in Pipedrive");
  }

  return data.data.id;
}

export async function findOrCreateOrganization(name, apiToken) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;

  const existingId = await searchOrganization(trimmed, apiToken);
  if (existingId) return existingId;

  return createOrganization(trimmed, apiToken);
}
