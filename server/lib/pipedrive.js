import {
  findExistingPerson,
  findOrCreateBorrower,
  findOrCreateRP,
  getPartnerDetailsById,
} from "./pipedrive-persons.js";
import {
  createDeal,
  setCalendlyUid,
  addReferralPartnerToDeal,
  addDealNote,
  setSubmissionNoteId,
} from "./pipedrive-deals.js";
import { createLogger } from "./logger.js";

const log = createLogger("pipedrive");

export async function lookupExistingBorrower(phone, email) {
  const apiToken = process.env.PIPEDRIVE_API_KEY;
  if (!apiToken) throw new Error("PIPEDRIVE_API_KEY is not configured.");

  return findExistingPerson(phone, email, apiToken);
}

export async function lookupPartnerDetails(id) {
  const apiToken = process.env.PIPEDRIVE_API_KEY;
  if (!apiToken) throw new Error("PIPEDRIVE_API_KEY is not configured.");

  const partner = await getPartnerDetailsById(id, apiToken);
  if (!partner) return null;

  return {
    referral_partner_name: partner.name,
    referral_partner_email: partner.email,
    referral_partner_number: partner.phone,
    referral_partner_company: partner.company,
  };
}

export async function submitToPipedrive(payload, options = {}) {
  const apiToken = process.env.PIPEDRIVE_API_KEY;
  if (!apiToken) throw new Error("PIPEDRIVE_API_KEY is not configured.");

  log.info("Starting Pipedrive submission", {
    propertyAddress: payload.property_address,
    referralPartnerEmail: payload.referral_partner_email,
    borrowerName: payload.borrower_name,
  });

  const includeBorrower = options.includeBorrower !== false;
  let rpId;
  let borrowerId = null;
  let organizationId = null;

  if (includeBorrower) {
    log.info("Looking up referral partner and borrower in parallel");
    const [rp, borrower] = await Promise.all([
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
    rpId = rp;
    borrowerId = borrower.personId;
    organizationId = borrower.orgId;
  } else {
    log.info("Looking up referral partner only (no borrower)");
    rpId = await findOrCreateRP(
      payload.referral_partner_name,
      payload.referral_partner_number,
      payload.referral_partner_email,
      payload.referral_partner_company,
      apiToken
    );
  }

  log.info("Person lookup complete", { rpId, borrowerId, organizationId });

  log.info("Creating deal in Pipedrive");
  const dealId = await createDeal(
    payload,
    borrowerId,
    organizationId,
    rpId,
    apiToken,
    options.stageId
  );

  log.info("Setting Calendly UID and adding deal participant and note", {
    dealId,
  });
  const [noteId] = await Promise.all([
    addDealNote(
      payload,
      dealId,
      apiToken,
      options.reviewBreakdown || [],
      options.noteTitle,
      options.existingBorrower || null
    ),
    setCalendlyUid(dealId, apiToken),
    addReferralPartnerToDeal(dealId, rpId, apiToken),
  ]);

  if (noteId) {
    log.info("Saving Submission Note ID to deal", { dealId, noteId });
    await setSubmissionNoteId(dealId, noteId, apiToken);
  }

  log.info("Pipedrive submission complete", {
    dealId,
    rpId,
    borrowerId,
    organizationId,
  });

  return { success: true, dealId };
}
