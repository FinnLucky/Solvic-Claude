# Solvic — Missed-Call Text Back

Complete, buildable v1: missed call → instant text back → follow-up sequence until they reply → recovery dashboard. Multi-tenant from day one.

**Verified:** `npm run build` and full typecheck pass clean.

## What's in the box

```
supabase/schema.sql               — run in Supabase SQL editor
app/api/twilio/voice/route.ts     — missed-call detection + instant text back
app/api/twilio/sms/route.ts       — inbound replies, STOP/opt-out handling
app/api/cron/followups/route.ts   — sequence runner (Vercel Cron, every 15 min)
app/page.tsx                      — recovery dashboard (the sales number)
lib/sequences.ts                  — the follow-up sequence, workflows-as-code
lib/twilio.ts / lib/supabase.ts   — clients + signature validation
scripts/seed.ts                   — seeds "Gulf Coast Plumbing" demo client
scripts/simulate.ts               — fake Twilio webhooks locally, valid signatures
vercel.json                       — cron schedule
```

## Launch checklist (~30 min)

**1. Supabase** — new project → SQL editor → paste `supabase/schema.sql` → run. Grab the URL and service role key from Settings → API.

**2. Twilio** — buy a local number (~$1.15/mo). On that number:
- Voice → *A call comes in* → TwiML Bin that forwards to the business's real line:
  ```xml
  <Response><Dial timeout="20">+1XXXXXXXXXX</Dial></Response>
  ```
- Voice → *Call status changes* → POST `{PUBLIC_BASE_URL}/api/twilio/voice`
- Messaging → *A message comes in* → POST `{PUBLIC_BASE_URL}/api/twilio/sms`

Heads up: US numbers need A2P 10DLC registration before SMS delivers reliably — start that in the Twilio console early, it can take a few days.

**3. Cal.com** — create a "demo consult" event type, copy the link.

**4. Deploy** — push to GitHub, import to Vercel, set env vars:
```
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN
PUBLIC_BASE_URL=https://<your-app>.vercel.app
CRON_SECRET=<random string>
DEMO_TWILIO_NUMBER=+1...
DEMO_BOOKING_URL=https://cal.com/...
```
The cron in `vercel.json` registers automatically on deploy.

**5. Seed** — `npm run seed` (locally, with the same vars in `.env.local`).

**6. Test with a real phone** — call the Twilio number, let it ring out. Text arrives in ~5s. Reply. Check the dashboard at your Vercel URL: 1 missed, 1 texted back, 1 recovered.

## Local dev without a phone

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Twilio + PUBLIC_BASE_URL=http://localhost:3000
npm run dev
npm run simulate:call        # fakes a no-answer call, fires the text-back logic
npm run simulate:reply       # fakes the caller replying
```

The simulator signs requests with your real auth token so signature validation passes. `simulate:call` triggers a real Twilio send — set `SIM_FROM` to your own cell to receive it, or use Twilio test credentials.

## How the pieces interlock

- **Reply = kill switch.** Inbound SMS flips `conversations.status` to `replied`; the cron only queries `status = 'open'`, so sequences stop instantly.
- **STOP is honored.** Opt-out words close all conversations and flag the contact; both the voice route and cron check `opted_out`.
- **10-min dedupe** stops repeat callers getting spammed.
- **`call_events` is the sales table.** Missed vs texted-back vs recovered over 30 days is the dashboard — screenshot it into every proposal.

## Editing the sequence

`lib/sequences.ts` — plain array of `{ delayHours, body }`. Templates support `{{business_name}}` and `{{booking_url}}`. Redeploy to change it.

## Next builds on this exact schema

- **Database revival**: bulk-insert `contacts` with `source='import'`, open conversations, let the sequence run
- **Owner notifications**: on inbound reply, forward to the business owner's cell
- **AI receptionist**: swap the TwiML Bin for a Vapi/Retell agent; same tables log everything
