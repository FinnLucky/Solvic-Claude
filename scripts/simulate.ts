// Simulate Twilio webhooks against a running dev server — no phone needed.
//
//   npm run dev                # in one terminal
//   npm run simulate:call      # fake a missed call from +15005550006
//   npm run simulate:reply     # fake the caller texting back "yes please!"
//
// Computes a real Twilio signature with your TWILIO_AUTH_TOKEN so the
// routes' validation passes. Override the fake caller with SIM_FROM.
// NOTE: simulate:call will attempt a real SMS send via Twilio. Use a
// Twilio test credential pair or your own cell as SIM_FROM.

import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const mode = process.argv[2]; // "call" | "reply"
const base = process.env.SIM_BASE_URL ?? "http://localhost:3000";
const from = process.env.SIM_FROM ?? "+15005550006";
const to = process.env.DEMO_TWILIO_NUMBER ?? "+12395550100";

async function post(path: string, params: Record<string, string>) {
  const url = `${process.env.PUBLIC_BASE_URL}${path}`; // must match route's validation URL
  const signature = twilio.getExpectedTwilioSignature(
    process.env.TWILIO_AUTH_TOKEN!,
    url,
    params
  );

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });

  console.log(`${path} → ${res.status} ${await res.text()}`);
}

async function main() {
  if (mode === "call") {
    await post("/api/twilio/voice", {
      CallSid: `SIM${Date.now()}`,
      CallStatus: "no-answer",
      From: from,
      To: to,
      Direction: "inbound",
    });
  } else if (mode === "reply") {
    await post("/api/twilio/sms", {
      SmsSid: `SIMSMS${Date.now()}`,
      From: from,
      To: to,
      Body: "yes please!",
    });
  } else {
    console.log("Usage: tsx scripts/simulate.ts <call|reply>");
  }
}

main().catch(console.error);
