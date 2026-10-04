# Contact Form Spam: What's Happening and What We Did

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

## What we did

All changes are in `api/contact.js`, `server/lib/spam-guard.js` and `src/stages/WebsiteView.jsx`.

### 1. Honeypot field (always on)

The form has a hidden `website` field that people never see. Bots fill in every field they find, so any submission with that field filled is dropped.

### 2. Timing check (always on)

The form records when it was loaded. A submission is dropped if:

- it arrives less than 3 seconds after load (bots submit instantly),
- it has no start time at all (a bot posting directly to `/api/contact` without loading the page), or
- the start time is more than 24 hours old.

### 3. Junk-content scoring (always on)

Submissions are scored on three signals. A score of 2 or more is dropped.

| Signal                                                             | Points |
|--------------------------------------------------------------------|--------|
| Message is one random mixed-case string (e.g. `fJMAXtJvJtCe…`)     | 2      |
| A name word of 4+ letters with no vowels (e.g. `Vpfqr`)            | 1      |
| Gmail address with 3 or more dots in the username                  | 1      |

Real names like "Schwartz" or "Lynn" and normal emails like `michael.schwartz@gmail.com` pass. This is covered in `tests/contact.test.js`.

### 4. Cloudflare Turnstile (off until keys are added)

Turnstile is Cloudflare's free, usually invisible "are you human" check. It's already coded, but only turns on once the keys are set (see setup below). It fails open if Cloudflare itself is down, so real leads aren't lost.

### How blocked submissions are handled

The bot still gets a normal "success" response, so it learns nothing about what tripped the filter. No email is sent.

Each block is logged in Vercel as `Blocked spam contact submission`, with the reason (`honeypot`, `too_fast`, `random_message`, and so on), the email and the IP.

## Setup still needed

### Turn on Turnstile (recommended, about 5 minutes)

1. Go to the Cloudflare dashboard, then **Turnstile**, then **Add widget**. A free account works, and the domain does not need to be on Cloudflare.
2. Enter `gysmortgage.com` as the hostname and choose **Managed** mode.
3. In Vercel, open the project, then **Settings**, then **Environment Variables**, and add:
   - `VITE_TURNSTILE_SITE_KEY` = the site key
   - `TURNSTILE_SECRET_KEY` = the secret key
4. Redeploy.

### Rate limit the endpoint (optional)

In Vercel, open the project, then **Firewall**, then **Rules**, and add a rate limit on path `/api/contact`, for example 3 requests per IP per 10 minutes.

## Checking that it works

- Vercel logs: filter for `Blocked spam contact submission` to see what is being caught and why.
- If a real lead ever reports that the form "went through" but nobody got it, search the logs for their email and check the block reason. Adjust the threshold in `server/lib/spam-guard.js` if needed.
