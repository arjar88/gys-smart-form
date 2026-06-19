import { SiteHeader } from "../components/SiteHeader";

export function PrivacyPolicyView() {
  return (
    <div className="gys-legal-page min-h-screen bg-gys-cream text-gys-label">
      <SiteHeader />

      <main className="px-6 pb-20 pt-28 text-left sm:px-10">
        <article className="max-w-4xl">
          <h1 className="font-serif text-4xl font-normal leading-tight sm:text-[2.75rem]">
            Privacy Policy
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed">Effective Date: Jan 2025</p>

          <div className="mt-8 space-y-5 text-[15px] leading-relaxed">
            <p>
              At GYS Mortgage, your privacy is very important to us. This Privacy Policy
              explains how we collect, use, and protect your information when you visit
              our website{" "}
              <a
                href="https://www.gysmortgage.com"
                className="underline hover:text-gys-navy"
              >
                www.gysmortgage.com
              </a>{" "}
              or interact with our services, including text message communications.
            </p>

            <section>
              <p>1. Information We Collect</p>
              <p className="mt-3">
                We may collect the following information when you interact with us:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  Personal Information you provide (such as name, email, phone number, or
                  business details) when you complete a contact form or opt in to receive
                  messages.
                </li>
                <li>
                  Automatically Collected Information such as IP address, browser type, and
                  usage data via cookies or analytics tools.
                </li>
              </ul>
            </section>

            <section>
              <p>2. How We Use Your Information</p>
              <p className="mt-3">We use your information to:</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>Respond to your inquiries and provide mortgage/loan-related services.</li>
                <li>
                  Send you updates and information (by email, phone, or SMS) that you have
                  consented to receive.
                </li>
                <li>Improve our services and website experience.</li>
              </ul>
            </section>

            <section>
              <p>3. Text Messaging (SMS/MMS)</p>
              <ul className="mt-3 list-disc space-y-2 pl-6">
                <li>
                  By providing your phone number and opting in, you consent to receive text
                  messages from GYS Mortgage.
                </li>
                <li>
                  Message frequency may vary. Standard message and data rates may apply.
                </li>
                <li>You can opt out at any time by replying STOP to any message.</li>
                <li>
                  We do not share, sell, or rent your SMS consent or phone number with any
                  third parties for marketing purposes.
                </li>
                <li>
                  Your SMS consent is used only by GYS Mortgage for the purposes you agreed
                  to when opting in.
                </li>
              </ul>
            </section>

            <section>
              <p>4. Sharing of Information</p>
              <p className="mt-3">
                We do not sell, rent, or share your personal information or SMS consent with
                third parties, except as required by law or to protect our rights.
              </p>
            </section>

            <section>
              <p>5. Data Security</p>
              <p className="mt-3">
                We take reasonable measures to protect your personal information. However, no
                system is 100% secure.
              </p>
            </section>

            <section>
              <p>6. Your Rights</p>
              <p className="mt-3">
                You may request access to, update, or delete your personal information at
                any time. For SMS, you may reply STOP to unsubscribe.
              </p>
            </section>

            <section>
              <p>7. Updates</p>
              <p className="mt-3">
                We may update this Privacy Policy from time to time. The updated version
                will be posted here with a revised effective date.
              </p>
            </section>

            <section>
              <p>8. Contact Us</p>
              <p className="mt-3">
                If you have questions about this Privacy Policy, please contact us at:
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
          </div>
        </article>
      </main>
    </div>
  );
}
