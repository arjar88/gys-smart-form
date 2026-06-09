import { pipedriveRequest } from "./pipedrive-request.js";
import { createLogger } from "./logger.js";

const log = createLogger("pipedrive-orgs");
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

  const { ok, data } = await pipedriveRequest("searchOrganization", url);
  if (!ok) return null;

  const items = (data.data && data.data.items) || [];
  const hit = items.find((i) => normalizeOrgName(i.item.name) === normalized);

  if (hit) {
    log.info("Found existing organization", { orgId: hit.item.id, name: hit.item.name });
    return hit.item.id;
  }

  log.info("No organization match found", { name });
  return null;
}

async function createOrganization(name, apiToken) {
  const url = `https://${COMPANY_DOMAIN}.pipedrive.com/api/v1/organizations?api_token=${apiToken}`;

  const { ok, data } = await pipedriveRequest("createOrganization", url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });

  if (!ok || !data?.data) {
    throw new Error("Failed to create organization in Pipedrive");
  }

  log.info("Created organization", { orgId: data.data.id, name: data.data.name });
  return data.data.id;
}

export async function findOrCreateOrganization(name, apiToken) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    log.info("Skipping organization — no name provided");
    return null;
  }

  log.info("Finding or creating organization", { name: trimmed });
  const existingId = await searchOrganization(trimmed, apiToken);
  if (existingId) return existingId;

  return createOrganization(trimmed, apiToken);
}
