# GYS Smart Form

Two-stage React form for GYS Mortgage, hosted on Vercel and embedded in the Wix site via iframe.

## Stages

1. **Screener** — Property type, estimated value, and loan amount screened via OpenAI
2. **Full submission** — Remaining fields submitted to Wix `/_functions/submitDeal` → Pipedrive

## Local development

```bash
cd gys-smart-form
npm install
cp .env.example .env.local
# Add your VITE_OPENAI_API_KEY to .env.local
npm run dev
```

## Deploy to Vercel

1. Push this folder to a GitHub repo (or deploy from monorepo with root directory `gys-smart-form`)
2. Connect the repo to Vercel
3. Set environment variables:
   - `VITE_OPENAI_API_KEY` — OpenAI API key for screening
   - `VITE_WIX_SUBMIT_URL` — optional, defaults to `https://www.gysmortgage.com/_functions/submitDeal`
4. Deploy and note the production URL (e.g. `https://gys-smart-form.vercel.app`)

## Wix integration

1. Publish the Wix site with the new [`src/backend/http-functions.js`](../src/backend/http-functions.js)
2. Update `ALLOWED_ORIGIN` in that file to your exact Vercel URL (replace `"*"`)
3. Replace the native Wix form with an **Embed Site** iframe pointing at the Vercel URL
4. Set iframe height to ~2400px to fit the full Stage 2 form without scrolling

## Qualification criteria

Edit [`src/constants/qualificationCriteria.js`](src/constants/qualificationCriteria.js) to adjust min/max values, LTV ratio, or rejected property types.

## Automated testing

Run the backend test suite:

```bash
npm test
```

For watch mode during development:

```bash
npm run test:watch
```

### What the tests cover

The tests verify **orchestration logic** — that the right process runs for each AI outcome — without calling OpenAI, Pipedrive, or Resend live.

| AI result | Quick review (`/api/quick-review`) | Full submission (`/api/full-submission`) |
|-----------|----------------------------------|------------------------------------------|
| `PASS` | Returns success, no email | Submits to Pipedrive, no email |
| `MANUAL_REVIEW` | Sends review email to RP; creates Pipedrive deal in Manual Review stage (182) | Sends review email to RP; submits to Pipedrive (Potential Lead stage) |

Both review flows never return `DECLINE` from the AI — uncertain or edge-case deals route to `MANUAL_REVIEW`.

Additional coverage:

- Email formatters produce correct property and AI review blocks
- Pipedrive submission orchestrates person lookup, deal creation, Calendly UID, participant, and note

### What the tests do not cover

- Live OpenAI decision quality (non-deterministic; prompts and models change)
- Real Pipedrive or Resend API behavior
- Frontend UI and iframe integration

Use the manual E2E checklist below for those.

## E2E test checklist (live site)

- [ ] Stage 1 loads in iframe
- [ ] Qualifying deal advances to Stage 2 with screener fields pre-filled
- [ ] Non-qualifying deal shows rejection message
- [ ] "Try Different Numbers" resets to Stage 1
- [ ] Stage 2 submit creates deal in Pipedrive
- [ ] Mobile layout renders cleanly
