import { useState } from "react";
import { FormPhoneInput } from "../components/FormPhoneInput";
import { LogoMark } from "../components/LogoMark";
import { SiteHeader } from "../components/SiteHeader";

const CALENDLY_URL = "https://calendly.com/gabriel-gysmortgage/30min";
const TESTIMONIALS_BG_URL =
  "https://static.wixstatic.com/media/11062b_6ca2b81a96324a81b4be0388bbe57197~mv2.jpg/v1/fill/w_1800,h_1200,al_c,q_85,enc_avif,quality_auto/11062b_6ca2b81a96324a81b4be0388bbe57197~mv2.jpg";

const programs = [
  {
    title: "EBITDA Loan",
    intro: "Clients with strong credit and profitable financials.",
    points: [
      "High Loan-to-Value (LTV): 85%–90%",
      "Low rates: Prime +1/3",
      "Long terms: 10–25 years (Principal & Interest)",
      "Nationwide availability",
    ],
  },
  {
    title: "Bridge Loan",
    intro: "Clients needing fast funding with poor credit or no financial records.",
    points: [
      "Quick 3-week close",
      "Low LTV: 50%–60%",
      "Rates: Prime +5",
      "Short terms: 1–2 years (Interest Only)",
      "Minimal prepayment requirements",
    ],
  },
  {
    title: "30-Year Loan",
    intro: "Clients with moderate credit or cash flow seeking long-term stability.",
    points: [
      "Flexible terms: 30-year duration",
      "Moderate LTV: 70%",
      "Rates: Prime +3/4",
      "No financial documentation required",
    ],
  },
];

const features = [
  {
    title: "Partners You Can Trust",
    body: "Our team builds custom solutions tailored to your unique needs.",
    image: "/icons/handshake.png",
    alt: "Handshake icon",
  },
  {
    title: "Private Lending for Every Situation",
    body: "Specializing in non-bankable clients, we ensure access to funding when others can't.",
    image: "/icons/money.png",
    alt: "Money icon",
  },
  {
    title: "Nationwide Expertise",
    body: "Serving industries in all 50 states.",
    image: "/icons/us-map.png",
    alt: "United States map icon",
  },
];

const testimonials = [
  {
    quote:
      "Simon was able to procure capital for our company when we were in a cash crunch...Simon is very responsive... and he does what he says he will do.",
    author: "Shane Matteson, GA",
  },
  {
    quote:
      "...Allows us to continue to work smoothly during times of waiting for the government to pay... They have come through very quickly, professionally, and with the utmost courtesy.",
    author: "Jared & Randy Pew, CA",
  },
  {
    quote:
      "I have worked with Simon over the last couple of years and he has been a great help in getting me my loans. He has been very professional and quick to get me the loans.",
    author: "George Foster, CA",
  },
];

function PillButton({ children, variant = "gold", onClick, href, className = "" }) {
  const styles =
    variant === "navy"
      ? "border-gys-navy bg-gys-navy text-white hover:bg-white hover:text-gys-navy"
      : variant === "cream"
        ? "border-gys-gold-light bg-gys-gold-light text-gys-navy hover:bg-white"
        : variant === "light"
          ? "border-gys-testimonial bg-gys-testimonial text-gys-navy hover:bg-white"
          : "border-gys-gold bg-gys-gold text-gys-navy hover:border-gys-navy hover:bg-white";

  const classes = `inline-flex items-center justify-center rounded-full border px-8 py-3 text-base font-bold transition ${styles} ${className}`;

  if (href) {
    const isExternal = href.startsWith("http");
    return (
      <a
        href={href}
        {...(isExternal ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        className={classes}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

function ArrowButton({ children, variant = "gold", onClick, href }) {
  const className =
    variant === "navy"
      ? "border-gys-navy bg-gys-navy text-white hover:bg-white hover:text-gys-navy"
      : variant === "outline"
        ? "border-white/80 bg-white/10 text-white hover:bg-white hover:text-gys-navy"
        : "border-gys-gold bg-gys-gold text-gys-navy hover:border-gys-navy hover:bg-white";

  const content = (
    <>
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-base transition ${className}`}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-base transition ${className}`}
    >
      {content}
    </button>
  );
}

function FeatureIcon({ src, alt }) {
  return (
    <img
      src={src}
      alt={alt}
      className="h-14 w-14 shrink-0 object-contain"
      width={56}
      height={56}
    />
  );
}

function SectionHeading({ eyebrow, title, body, centered = false, light = false }) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {eyebrow && (
        <p
          className={`mb-3 text-sm font-bold uppercase tracking-[0.24em] ${
            light ? "text-gys-gold" : "text-gys-muted"
          }`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-serif text-3xl leading-tight sm:text-4xl ${
          light ? "text-gys-gold" : "text-gys-navy"
        }`}
      >
        {title}
      </h2>
      {body && (
        <p
          className={`mt-5 text-lg leading-relaxed ${
            light ? "text-white/85" : "text-gys-label/75"
          }`}
        >
          {body}
        </p>
      )}
    </div>
  );
}

function ContactForm() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    message: "",
    smsConsent: false,
  });
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, type, checked, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" || type === "radio" ? checked : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.smsConsent) {
      setError("Please acknowledge the disclosure below before submitting.");
      return;
    }

    setStatus("submitting");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to submit contact request.");
      }

      setStatus("success");
      setForm({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        message: "",
        smsConsent: false,
      });
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }

  const inputClass =
    "w-full rounded-md border-0 bg-white px-3 py-2.5 text-sm text-gys-label outline-none transition focus:ring-2 focus:ring-gys-navy/15 sm:text-base";
  const labelClass = "text-sm font-bold";

  return (
    <form
      onSubmit={handleSubmit}
      className="contact-form w-full rounded-3xl bg-gys-form-tan p-5 text-gys-label sm:p-6"
    >
      <h3 className="font-serif text-2xl text-gys-navy sm:text-3xl">Contact us</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          First name *
          <input
            required
            name="firstName"
            value={form.firstName}
            onChange={updateField}
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <label className={labelClass}>
          Last name
          <input
            name="lastName"
            value={form.lastName}
            onChange={updateField}
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <div>
          <FormPhoneInput
            label="Phone number"
            name="phone"
            value={form.phone}
            onChange={updateField}
            required
          />
        </div>
        <label className={labelClass}>
          Email *
          <input
            required
            name="email"
            type="email"
            value={form.email}
            onChange={updateField}
            className={`mt-2 ${inputClass}`}
          />
        </label>
      </div>
      <label className={`mt-4 block ${labelClass}`}>
        Message *
        <textarea
          required
          name="message"
          value={form.message}
          onChange={updateField}
          placeholder="Type your message here..."
          rows={4}
          className={`mt-2 ${inputClass}`}
        />
      </label>
      <div className="mt-4">
        <p className={`${labelClass} mb-3`}>Single choice</p>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="smsConsent"
            type="radio"
            checked={form.smsConsent}
            onChange={() =>
              setForm((current) => ({ ...current, smsConsent: true }))
            }
            className="h-4 w-4 shrink-0 accent-gys-navy"
          />
          <span>Disclosure Below</span>
        </label>
      </div>
      <div className="mt-4 space-y-2 text-xs leading-relaxed sm:text-sm">
        <p>
          By checking this box, I consent to receive conversational SMS from GYS
          Mortgage. Reply STOP to opt-out; Reply HELP for support. Message &amp;
          data rates may apply; Messaging frequency may vary.
        </p>
        <p>
          Visit{" "}
          <a
            href="/privacy-policy"
            className="text-gys-primary underline hover:text-gys-navy"
          >
            https://www.gysmortgage.com/privacy-policy
          </a>{" "}
          to see our privacy policy and{" "}
          <a
            href="/terms-disclaimer"
            className="text-gys-primary underline hover:text-gys-navy"
          >
            https://www.gysmortgage.com/terms-disclaimer
          </a>{" "}
          for our Terms of Service.
        </p>
      </div>
      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex rounded-full bg-gys-navy px-8 py-2.5 text-sm text-white transition hover:bg-white hover:text-gys-navy disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
        >
          {status === "submitting" ? "Submitting..." : "Submit"}
        </button>
      </div>
      {status === "success" && (
        <p className="mt-4 text-right text-sm font-bold text-gys-navy">
          Thanks, we received your submission.
        </p>
      )}
      {status === "error" && (
        <p className="mt-4 text-right text-sm font-bold text-red-700">{error}</p>
      )}
    </form>
  );
}

export function WebsiteView({ onQuickReview, onFullSubmission }) {
  return (
    <div className="min-h-screen bg-gys-cream text-gys-label">
      <SiteHeader />

      <main>
        <section className="relative flex min-h-screen items-center overflow-hidden bg-gys-navy px-6 pb-24 pt-32 text-white sm:px-10">
          <div
            className="absolute inset-0 bg-[url('https://static.wixstatic.com/media/11062b_592b365d7c5d4b94a9ae3f73b5ad3c2d~mv2.jpg/v1/fill/w_1800,h_1200,al_c,q_85,enc_avif,quality_auto/11062b_592b365d7c5d4b94a9ae3f73b5ad3c2d~mv2.jpg')] bg-cover bg-center"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gys-navy/80" />
          <div className="relative mx-auto max-w-4xl text-center">
            <h1 className="font-serif text-4xl leading-tight text-gys-gold-light sm:text-5xl lg:text-6xl">
              Access the Mortgage Needed to Fund Your Business Growth
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
              Your trusted partner for private commercial mortgages. We provide
              innovative, flexible funding solutions to help your business
              succeed.
            </p>
            <div className="mt-10">
              <PillButton href="#contact" variant="cream">
                Contact Us
              </PillButton>
            </div>
          </div>
        </section>

        <section id="programs" className="bg-white px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-[1600px]">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="font-serif text-3xl text-gys-navy sm:text-4xl">
                Our Mortgage Programs
              </h2>
              <p className="mt-5 text-base leading-relaxed text-gys-label sm:text-lg">
                We offer tailored programs to meet a wide range of business needs.
                These are amongst the most popular:
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {programs.map((program, index) => (
                <article
                  key={program.title}
                  className={`rounded-3xl p-8 ${
                    index === 1 ? "bg-gys-gold" : "bg-gys-card-cream"
                  }`}
                >
                  <h3 className="text-center font-serif text-2xl text-gys-navy">
                    {program.title}
                  </h3>
                  <p className="mt-4 text-center text-base leading-relaxed">
                    <span className="font-bold">Who It&apos;s For:</span>{" "}
                    {program.intro}
                  </p>
                  <ul className="mt-6 list-disc space-y-2 pl-5 text-base leading-relaxed">
                    {program.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
            <div className="mt-12 text-center">
              <PillButton href={CALENDLY_URL}>Schedule a Consultation</PillButton>
            </div>
          </div>
        </section>

        <section className="bg-gys-cream px-6 py-20 sm:px-10">
          <div className="mx-auto grid max-w-[1600px] items-stretch gap-8 lg:grid-cols-2">
            <div className="flex flex-col justify-center rounded-3xl bg-gys-gold p-8 lg:p-12">
              <h2 className="font-serif text-3xl text-gys-navy sm:text-4xl">
                Our Mission
              </h2>
              <p className="mt-6 text-base leading-relaxed text-gys-navy sm:text-lg">
                At GYS Mortgage, we believe every business deserves access to the
                financial tools needed for growth.
              </p>
              <p className="mt-4 text-base leading-relaxed text-gys-navy sm:text-lg">
                We&apos;re here to support you with fast, reliable, and customized
                loan solutions.
              </p>
              <div className="mt-8">
                <PillButton href="#contact" variant="navy">
                  Get in Touch
                </PillButton>
              </div>
            </div>
            <div className="grid gap-5">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="grid items-center gap-4 rounded-3xl border border-gys-navy bg-white p-6 sm:grid-cols-[auto_1fr_1.2fr]"
                >
                  <div className="flex justify-center sm:justify-start">
                    <FeatureIcon src={feature.image} alt={feature.alt} />
                  </div>
                  <h3 className="text-center text-lg font-bold text-gys-navy sm:text-left">
                    {feature.title}
                  </h3>
                  <p className="text-center text-sm leading-relaxed text-gys-label sm:text-left">
                    {feature.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-gys-cream px-6 py-20 sm:px-10">
          <div className="mx-auto grid max-w-[1600px] items-center gap-12 lg:grid-cols-2">
            <div>
              <SectionHeading
                title="How we help SMBs thrive"
                body="We specialize in providing flexible, private lending solutions for small and medium-sized business owners across the U.S. Whether you're expanding your operations, acquiring a new property, or leveraging assets for business growth, we have the expertise and resources to help."
              />
              <div className="mt-8">
                <ArrowButton onClick={onQuickReview} variant="navy">
                  Get in Touch
                </ArrowButton>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] bg-gys-gold/40 shadow-sm">
              <img
                src="https://static.wixstatic.com/media/11062b_84479b35a4a64b55aab009caae445961~mv2.jpg/v1/fill/w_900,h_900,al_c,q_85,enc_avif,quality_auto/11062b_84479b35a4a64b55aab009caae445961~mv2.jpg"
                alt="Pointing pencil"
                className="h-full min-h-[360px] w-full object-cover mix-blend-multiply"
              />
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden px-6 py-20 sm:px-10">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${TESTIMONIALS_BG_URL}')` }}
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gys-navy/75" aria-hidden="true" />
          <div className="relative mx-auto max-w-[1600px]">
            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure
                  key={testimonial.author}
                  className="rounded-[2rem] bg-gys-testimonial px-8 py-10 text-center text-gys-label sm:px-10 sm:py-12"
                >
                  <div className="mx-auto mb-6 flex justify-center text-gys-navy">
                    <svg
                      viewBox="25 52 151 96"
                      className="h-10 w-10"
                      aria-hidden="true"
                    >
                      <path
                        fill="currentColor"
                        d="M107.443 113.262c0 19.604 16.131 35.483 35.639 34.711 17.787-.701 32.199-15.307 32.891-33.333.762-19.77-14.906-36.117-34.251-36.117h-.121c-6.24.025-10.8-6.023-8.928-12.058a71.563 71.563 0 0 1 4.764-11.628c.39-.592.39-1.381.195-1.974-.195-.394-.584-.789-.974-.789-.584-.197-1.168 0-1.947.592-8.181 7.106-15.192 16.383-19.867 26.647-4.284 9.474-6.816 19.54-7.206 30.199-.191 1.184-.191 2.566-.191 3.75h-.004Z"
                      />
                      <path
                        fill="currentColor"
                        d="M25.175 113.262c0 19.604 16.131 35.483 35.64 34.711 17.785-.701 32.198-15.307 32.89-33.333.762-19.77-14.906-36.117-34.25-36.117h-.122c-6.24.025-10.8-6.023-8.928-12.058a71.576 71.576 0 0 1 4.764-11.628c.39-.592.39-1.381.195-1.974-.195-.394-.584-.789-.974-.789-.584-.197-1.168 0-1.947.592-8.18 7.106-15.192 16.383-19.866 26.647-4.285 9.474-6.817 19.54-7.207 30.199-.191 1.184-.191 2.566-.191 3.75h-.004Z"
                      />
                    </svg>
                  </div>
                  <blockquote className="text-base leading-relaxed sm:text-lg">
                    {testimonial.quote}
                  </blockquote>
                  <figcaption className="mt-6 text-base font-bold sm:text-lg">
                    {testimonial.author}
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-12 text-center">
              <PillButton href={CALENDLY_URL} variant="light">
                Schedule a Consultation
              </PillButton>
            </div>
          </div>
        </section>

        <section id="contact" className="bg-white px-6 py-20 sm:px-10">
          <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-[1fr_minmax(0,600px)] lg:gap-16">
            <div className="flex items-center justify-center lg:px-8">
              <div className="mx-auto max-w-md text-left lg:mx-0">
                <h2 className="font-serif text-4xl leading-[1.15] text-gys-label sm:text-5xl lg:text-6xl">
                  Your Growth
                  <br />
                  Starts Here
                </h2>
                <p className="mt-8 text-base leading-[1.7] text-gys-label sm:text-lg">
                  Whether you&apos;re purchasing commercial property, refinancing for
                  better rates, or cashing out equity, GYS Mortgage is here to help.
                  Let&apos;s discuss your business goals and create a loan solution
                  that fits.
                </p>
              </div>
            </div>
            <div className="w-full justify-self-center lg:justify-self-end">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gys-footer px-6 py-14 text-white sm:px-10">
        <div className="mx-auto max-w-[1600px]">
          <LogoMark light />
          <div className="mt-10 space-y-1 text-sm leading-relaxed">
            <p className="font-bold">Contact us</p>
            <p>Tel. +1-646-624-4897</p>
            <p>
              Email{" "}
              <a
                href="mailto:gabriel@gysmortgage.com"
                className="text-white hover:text-gys-gold"
              >
                gabriel@gysmortgage.com
              </a>
            </p>
            <p>500 East Broward Boulevard, Suite 900</p>
            <p>Fort Lauderdale, FL 33394</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/privacy-policy" className="underline hover:text-gys-gold">
              Privacy Policy
            </a>
            <a href="/terms-disclaimer" className="underline hover:text-gys-gold">
              Terms & Disclaimers
            </a>
          </div>
          <p className="mt-8 text-sm text-white/90">
            © 2025 by GYS Mortgage. Created by{" "}
            <a
              href="https://www.meetpenina.com"
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-gys-gold"
            >
              Meet Penina
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
