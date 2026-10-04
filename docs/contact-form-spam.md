# Form Spam Protection: What's Happening and What We Did

## The problem

The "Contact us" form on gysmortgage.com has been receiving a steady stream of junk submissions. Each one arrives at gabriel@gysmortgage.com as "New GYS Mortgage contact request from …".

Example (Oct 1, 2026):

| Field       | Value                                        |
|-------------|----------------------------------------------|
| Name        | Vpfqr Nbcgvn                                 |
| Email       | b.rendanm.cc.o.n.n.e.ll.fg6.0.2@gmail.com    |
| Phone       | +15275276215                                 |
| SMS Consent | Yes                                          |
| Message     | fJMAXtJvJtCespdrlnXfCrNx                     |

These are automated bots, not people.

## Why bots do this

These submissions are almost certainly not aimed at GYS specifically. Bots crawl the web for any open form and spray it.

The usual motives are:

- **Email/subscription bombing.**
  - Gmail ignores dots, so `b.rendanm.cc.o.n.n.e.ll…@gmail.com` is really a single real person's inbox.
  - Attackers submit that person's address to thousands of forms at once. The flood of confirmation emails hides a real alert, such as a bank transfer or password reset, while they commit fraud.
  - Our form is one of thousands being used.
- **SMS pumping.**
  - Forms that auto-text the submitter can be abused to send messages to attacker-controlled premium numbers. The site owner pays the carrier fees.
- **Probing.**
  - Bots test whether a form accepts arbitrary input, whether it auto-replies, and whether it can be used to relay spam or phishing.

Our form does **not** auto-reply to the submitter by email or SMS, so it's a poor target for bombing or pumping. The bots don't check that before spraying it, though.

The real cost to us is noise in the team inbox, and the risk of a real lead getting buried.

## Which forms are protected

All three public forms on gysmortgage.com:

| Form              | Endpoint                | What a bot submission would cost us                                           |
|-------------------|-------------------------|-------------------------------------------------------------------------------|
| Contact us        | `/api/contact`          | An email to the team inbox                                                    |
| Quick Deal Review | `/api/quick-review`     | OpenAI calls, a Pipedrive deal, and an email to whatever partner address was typed in |
| File Submission   | `/api/full-submission`  | OpenAI calls, a Pipedrive deal, and emails to the partner and borrower addresses typed in |

The Quick Review and File Submission forms email addresses typed into them. A bot could use them to send GYS-branded emails to strangers, which is the email-bombing pattern described above and would hurt our sending reputation. That's why every form is protected, not just Contact us.

## What we did

The shared code lives in two places:

- `server/lib/spam-guard.js` (server checks)
- `src/components/BotGuard.jsx` (honeypot field and Turnstile widget, used by all three forms)

### 1. Honeypot field (all forms)

Each form has a hidden `website` field that people never see. Bots fill in every field they find, so any submission with that field filled is dropped.

### 2. Timing check (all forms)

Each form records when it was loaded. A submission is dropped if:

- it arrives less than 3 seconds after load (bots submit instantly), or
- it has no start time at all (a bot posting directly to the API without loading the page).

### 3. Junk-content scoring (Contact us only)

Contact submissions are scored on three signals. A score of 2 or more is dropped.

| Signal                                                             | Points |
|--------------------------------------------------------------------|--------|
| Message is one random mixed-case string (e.g. `fJMAXtJvJtCe…`)     | 2      |
| A name word of 4+ letters with no vowels (e.g. `Vpfqr`)            | 1      |
| Gmail address with 3 or more dots in the username                  | 1      |

Real names like "Schwartz" or "Lynn" and normal emails like `michael.schwartz@gmail.com` pass. This is covered in `tests/contact.test.js`.

The deal forms don't use this scoring, because their fields (addresses, company names) don't fit these patterns.

### 4. Cloudflare Turnstile (all forms)

Turnstile is Cloudflare's free "are you human" check. It shows a small box above each form's submit button, and usually passes on its own without a click. The submit button won't send until it has passed.

- It only runs after the free checks above pass, so blocked bots never cost a Cloudflare call.
- It times out after 5 seconds and fails open if Cloudflare is down, so real submissions aren't lost.

### How blocked submissions are handled

Bots get a normal-looking response, so they learn nothing about what tripped the filter:

- **Contact us:** "success". No email is sent.
- **Quick Deal Review:** "requires manual review". No OpenAI call, Pipedrive deal or email.
- **File Submission:** "success". No OpenAI call, Pipedrive deal or email.

The guard fields (`website`, `startedAt`, `turnstileToken`) are stripped before anything reaches OpenAI, Pipedrive or an email.

Each block is logged in Vercel with the reason (`honeypot`, `too_fast`, `missing_start_time`, `turnstile_failed`, `random_message`, and so on) and the IP:

- `Blocked spam contact submission`
- `Blocked spam quick review`
- `Blocked spam full submission`

## Setup

### Turnstile keys (done Oct 4, 2026)

1. In Cloudflare, go to **Turnstile**, then **Add widget**. Hostnames: `gysmortgage.com` and `www.gysmortgage.com`. Mode: **Managed**.
2. In Vercel, go to **Settings**, then **Environment Variables**:
   - `TURNSTILE_SECRET_KEY` = the secret key, type **Secret**
   - `VITE_TURNSTILE_SITE_KEY` = the site key, type **Config**. It's public by design.
3. Redeploy. The site key is built into the page at build time.

The widget won't run on Vercel preview URLs, because they aren't in the hostname list. Test on the live site.

### Rate limit the endpoints (optional)

In Vercel, go to **Firewall**, then **Rules**, and add a rate limit on `/api/contact`, `/api/quick-review` and `/api/full-submission`, for example 5 requests per IP per 10 minutes.

## Checking that it works

- **Vercel logs:** filter for `Blocked spam` to see what is being caught and why.
- **A real user says they submitted but nothing happened:** search the logs around that time for their IP or email, and check the block reason. Adjust the rules in `server/lib/spam-guard.js` if needed.
