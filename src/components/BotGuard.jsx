import { useEffect, useImperativeHandle, useRef, useState } from "react";

// Shared bot protection for every public form. See docs/contact-form-spam.md.
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

// Cloudflare Turnstile widget. Renders nothing unless VITE_TURNSTILE_SITE_KEY is set.
function TurnstileWidget({ onToken, ref, className = "" }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current !== null) window.turnstile?.reset(widgetIdRef.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return undefined;

    function render() {
      if (widgetIdRef.current !== null || !window.turnstile || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    }

    let script = document.querySelector("script[data-turnstile]");
    if (!window.turnstile && !script) {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.dataset.turnstile = "true";
      document.head.appendChild(script);
    }
    render();
    script?.addEventListener("load", render);

    return () => {
      script?.removeEventListener("load", render);
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={containerRef} className={className} />;
}

// Hidden field that people never see but bots fill in.
function Honeypot({ value, onChange }) {
  return (
    <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
      <label>
        Website
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

/**
 * Usage in a form:
 *   const guard = useBotGuard();
 *   {guard.honeypot}            inside the <form>
 *   {guard.widget}              above the submit button
 *   if (guard.missingToken) ... block submit
 *   body: JSON.stringify({ ...data, ...guard.fields() })
 *   guard.reset()               after a successful submit, if the form stays on screen
 */
export function useBotGuard({ widgetClassName = "mt-4" } = {}) {
  const [honeypotValue, setHoneypotValue] = useState("");
  const [token, setToken] = useState("");
  const startedAtRef = useRef(0);
  const widgetRef = useRef(null);

  // Record when the form first appears, so the server can reject instant bot submits.
  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  return {
    missingToken: Boolean(TURNSTILE_SITE_KEY) && !token,
    fields: () => ({
      website: honeypotValue,
      startedAt: startedAtRef.current,
      turnstileToken: token,
    }),
    reset() {
      startedAtRef.current = Date.now();
      setToken("");
      widgetRef.current?.reset();
    },
    honeypot: <Honeypot value={honeypotValue} onChange={setHoneypotValue} />,
    widget: <TurnstileWidget ref={widgetRef} onToken={setToken} className={widgetClassName} />,
  };
}

export const MISSING_TOKEN_MESSAGE = "Please complete the verification check above the button.";
