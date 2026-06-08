import { findOrCreateBorrower, findOrCreateRP } from "./pipedrive-persons.js";
import {
  createDeal,
  addReferralPartnerToDeal,
  addDealNote,
} from "./pipedrive-deals.js";

export async function submitToPipedrive(payload, aiSummary) {
  const apiToken = process.env.PIPEDRIVE_API_KEY;
  if (!apiToken) throw new Error("PIPEDRIVE_API_KEY is not configured.");

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

  const dealId = await createDeal(
    payload,
    borrowerId,
    organizationId,
    rpId,
    apiToken
  );

  await Promise.all([
    addReferralPartnerToDeal(dealId, rpId, apiToken),
    addDealNote(payload, dealId, aiSummary, apiToken),
  ]);

  return { success: true, dealId };
}
