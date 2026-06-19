import { LogoMark } from "./LogoMark";

const CALENDLY_URL = "https://calendly.com/gabriel-gysmortgage/30min";

function ArrowButton({ children, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/80 bg-white/10 px-6 py-3 text-base text-white transition hover:bg-white hover:text-gys-navy"
    >
      <span>{children}</span>
      <span aria-hidden="true">→</span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-gys-navy/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4 sm:px-10">
        <LogoMark light />
        <div className="flex items-center gap-3">
          <a
            href="/#programs"
            className="hidden text-sm uppercase tracking-[0.16em] text-white/75 transition hover:text-gys-gold sm:inline"
          >
            Programs
          </a>
          <ArrowButton href={CALENDLY_URL}>Book a Consultation</ArrowButton>
        </div>
      </div>
    </header>
  );
}
