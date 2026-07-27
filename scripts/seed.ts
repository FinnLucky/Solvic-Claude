// Seed the demo instance: "Gulf Coast Plumbing"
// Usage: npm run seed
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
// Set DEMO_TWILIO_NUMBER to the number you bought, e.g. +12395550100

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const twilioNumber = process.env.DEMO_TWILIO_NUMBER;
  if (!twilioNumber) {
    console.error("Set DEMO_TWILIO_NUMBER in .env.local (E.164, e.g. +12395550100)");
    process.exit(1);
  }

  const { data, error } = await supabase
    .from("clients")
    .upsert(
      {
        name: "Gulf Coast Plumbing",
        twilio_number: twilioNumber,
        booking_url: process.env.DEMO_BOOKING_URL ?? "https://cal.com/your-handle/demo",
        missed_call_message:
          "Sorry we missed your call! This is {{business_name}} — reply here and we'll get right back to you, or grab a time that works: {{booking_url}}",
        followups_enabled: true,
      },
      { onConflict: "twilio_number" }
    )
    .select()
    .single();

  if (error) throw error;
  console.log("Demo client ready:");
  console.log(`  ${data.name} — ${data.twilio_number}`);
  console.log(`  booking: ${data.booking_url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
