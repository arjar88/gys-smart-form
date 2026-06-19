import { SiteHeader } from "../components/SiteHeader";

export function TermsDisclaimerView() {
  return (
    <div className="gys-legal-page min-h-screen bg-gys-cream text-gys-label">
      <SiteHeader />

      <main className="px-6 pb-20 pt-28 text-left sm:px-10">
        <article className="max-w-4xl">
          <h1 className="font-serif text-4xl font-normal leading-tight sm:text-[2.75rem]">
            Terms &amp; Disclaimer
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed">Effective Date: Jan 2025</p>

          <div className="mt-8 space-y-5 text-[15px] leading-relaxed">
            <p>
              Welcome to GYS Mortgage. By using this website (
              <a
                href="https://www.gysmortgage.com"
                className="underline hover:text-gys-navy"
              >
                www.gysmortgage.com
              </a>
              ) or engaging with our services, you agree to the following terms:
            </p>

            <section>
              <p>1. General Use</p>
              <p className="mt-3">
                The content on this website is provided for informational purposes only. It
                should not be considered financial, legal, or tax advice. Always consult with
                qualified professionals before making financial decisions.
              </p>
            </section>

            <section>
              <p>2. Broker, Not a Lender</p>
              <p className="mt-3">
                GYS Mortgage is a commercial mortgage brokerage. We do not make loans or
                credit decisions. Instead, we arrange and facilitate financing through a
                network of lenders and financial institutions.
              </p>
              <p className="mt-3">
                All loans are subject to the lender&apos;s approval, underwriting, and
                applicable terms. Loan terms, rates, and approvals are not guaranteed.
              </p>
            </section>

            <section>
              <p>3. No Warranties</p>
              <p className="mt-3">
                While we make reasonable efforts to ensure accuracy, we do not guarantee that
                information on this site is complete, current, or error-free. Use of this site
                and reliance on any content is at your own risk.
              </p>
            </section>

            <section>
              <p>4. Limitation of Liability</p>
              <p className="mt-3">
                To the fullest extent permitted by law, GYS Mortgage is not liable for any
                losses, damages, or claims that may arise from use of this site, reliance on
                its content, or engagement with lenders or third-party services.
              </p>
            </section>

            <section>
              <p>5. Third-Party Links</p>
              <p className="mt-3">
                Our website may include links to other websites. These links are provided for
                convenience only. We are not responsible for the content or privacy practices
                of third-party sites.
              </p>
            </section>

            <section>
              <p>6. Communications Consent</p>
              <p className="mt-3">
                By providing your contact information, you consent to receive communications
                (including SMS, phone calls, and emails) from GYS Mortgage. Standard message
                and data rates may apply. You may opt out at any time.
              </p>
            </section>

            <section>
              <p>7. Changes to Terms</p>
              <p className="mt-3">
                We may update these Terms &amp; Disclaimer at any time. Updated versions will
                be posted here with a revised effective date.
              </p>
            </section>

            <section>
              <p>8. Contact Us</p>
              <p className="mt-3">
                For questions about these Terms &amp; Disclaimer, please contact us:
              </p>
              <div className="mt-3 space-y-1">
                <p>GYS Mortgage</p>
                <p>
                  Email:{" "}
                  <a
                    href="mailto:gabriel@gysmortgage.com"
                    className="underline hover:text-gys-navy"
                  >
                    gabriel@gysmortgage.com
                  </a>
                </p>
                <p>
                  Phone:{" "}
                  <a href="tel:+16466244897" className="underline hover:text-gys-navy">
                    +1 (646) 624-4897
                  </a>
                </p>
              </div>
            </section>

            <section className="pt-6">
              <h2 className="font-serif text-2xl font-normal leading-tight sm:text-[1.75rem]">
                SMS Terms and Conditions
              </h2>

              <p className="mt-5">1. Introduction</p>
              <p className="mt-3">
                Welcome to GYS Mortgage. By accessing or using our services, including
                receiving SMS communications, you agree to comply with and be bound by these
                Terms and Conditions. If you do not agree with these terms, please do not
                engage with our services.
              </p>

              <p className="mt-5">2. Consent for SMS Communication</p>
              <p className="mt-3">
                By providing your consent to receive SMS communications, you acknowledge and
                agree to receive text messages from GYS Mortgage at the phone number you
                provide. Information obtained as part of the SMS consent process will not be
                shared with third parties.
              </p>

              <p className="mt-5">3. Types of SMS Communications</p>
              <p className="mt-3">
                If you have consented to receive text messages, you may receive SMS
                communications related to the following:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  Customers and Guests: Updates regarding your orders, deliveries, or other
                  relevant information.
                </li>
                <li>
                  Job Applicants: Information about your application status, onboarding
                  materials, or other employment-related updates.
                </li>
                <li>Appointment reminders</li>
                <li>Follow-up messages</li>
                <li>Billing inquiries (if applicable)</li>
              </ul>

              <p className="mt-5">4. Opt-In Method</p>
              <p className="mt-3">
                You may opt-in to receive SMS messages in the following ways, whichever is
                applicable:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Verbally, during a conversation</li>
              </ul>

              <p className="mt-5">5. Standard Messaging Disclosures</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Message and data rates may apply.</li>
                <li>You can opt out at any time by texting &quot;STOP.&quot;</li>
                <li>
                  For assistance, text &quot;HELP&quot; to any text message or contact us
                  directly at{" "}
                  <a href="tel:+16466244897" className="underline hover:text-gys-navy">
                    +1 (646) 624-4897
                  </a>
                  , you can email us at{" "}
                  <a
                    href="mailto:gabriel@gysmortgage.com"
                    className="underline hover:text-gys-navy"
                  >
                    gabriel@gysmortgage.com
                  </a>{" "}
                  or visit our{" "}
                  <a href="/privacy-policy" className="underline hover:text-gys-navy">
                    Privacy Policy
                  </a>{" "}
                  and SMS Terms &amp; Conditions.
                </li>
                <li>Message frequency may vary.</li>
              </ul>
            </section>
          </div>
        </article>
      </main>
    </div>
  );
}
