import { findOrCreateBorrower, findOrCreateRP } from "./pipedrive-persons.js";
import {
  createDeal,
  addReferralPartnerToDeal,
  addDealNote,
} from "./pipedrive-deals.js";
import { createLogger } from "./logger.js";

const log = createLogger("pipedrive");

export async function submitToPipedrive(payload, aiSummary) {
  const apiToken = process.env.PIPEDRIVE_API_KEY;
  if (!apiToken) throw new Error("PIPEDRIVE_API_KEY is not configured.");

  log.info("Starting Pipedrive submission", {
    propertyAddress: payload.property_address,
    referralPartnerEmail: payload.referral_partner_email,
    borrowerName: payload.borrower_name,
  });

  log.info("Looking up referral partner and borrower in parallel");
  const [rpId, borrower] = await Promise.all([
    findOrCreateRP(
      payload.referral_partner_name,
      payload.referral_partner_number,
      payload.referral_partner_email,
      payload.referral_partner_company,
      apiToken
    ),
    findOrCreateBorrower(
      payload.borrower_name,
      payload.borrower_phone,
      payload.borrower_email,
      payload.business_name,
      apiToken
    ),
  ]);

  const { personId: borrowerId, orgId: organizationId } = borrower;
  log.info("Person lookup complete", { rpId, borrowerId, organizationId });

  log.info("Creating deal in Pipedrive");
  const dealId = await createDeal(
    payload,
    borrowerId,
    organizationId,
    rpId,
    apiToken
  );

  log.info("Adding deal participant and note in parallel", { dealId });
  await Promise.all([
    addReferralPartnerToDeal(dealId, rpId, apiToken),
    addDealNote(payload, dealId, aiSummary, apiToken),
  ]);

  log.info("Pipedrive submission complete", {
    dealId,
    rpId,
    borrowerId,
    organizationId,
  });

  return { success: true, dealId };
}
