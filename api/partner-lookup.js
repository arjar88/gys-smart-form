import { lookupPartnerDetails } from "../server/lib/pipedrive.js";
import { createLogger } from "../server/lib/logger.js";

const log = createLogger("partner-lookup");

function clean(value) {
  return String(value || "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed." });
  }

  const id = clean(req.query?.id);

  if (!id) {
    return res.status(400).json({ error: "Partner ID is required." });
  }

  try {
    log.info("Looking up referral partner by ID", { id });

    const partner = await lookupPartnerDetails(id);

    if (!partner) {
      return res.status(404).json({ error: "No referral partner found for this ID." });
    }

    return res.status(200).json(partner);
  } catch (err) {
    log.error("Partner lookup failed", err, { id });
    return res.status(500).json({ error: "Unable to look up referral partner." });
  }
}
