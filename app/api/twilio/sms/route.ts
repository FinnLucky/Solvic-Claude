import { db } from "@/lib/supabase";
import { isValidTwilioRequest, parseTwilioForm } from "@/lib/twilio";

export const dynamic = "force-dynamic";

// Phone Number → Messaging → "A message comes in" → POST {PUBLIC_BASE_URL}/api/twilio/sms
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);

export async function POST(req: Request) {
  const url = `${process.env.PUBLIC_BASE_URL}/api/twilio/sms`;
  const params = await parseTwilioForm(req);

  if (!isValidTwilioRequest(req.headers.get("x-twilio-signature"), url, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const { From, To, SmsSid } = params;
  const body = params.Body ?? "";
  const supabase = db();

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("twilio_number", To)
    .single();

  if (!client) return emptyTwiml();

  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      { client_id: client.id, phone: From, source: "inbound_sms" },
      { onConflict: "client_id,phone", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (!contact) return emptyTwiml();

  // Honor opt-outs: Twilio blocks further sends anyway; mirror it in our data
  if (STOP_WORDS.has(body.trim().toLowerCase())) {
    await supabase.from("contacts").update({ opted_out: true }).eq("id", contact.id);
    await supabase
      .from("conversations")
      .update({ status: "closed" })
      .eq("contact_id", contact.id)
      .in("status", ["open", "replied"]);
    return emptyTwiml();
  }

  let { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .in("status", ["open", "replied"])
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ client_id: client.id, contact_id: contact.id })
      .select()
      .single();
    conversation = created;
  }

  await supabase.from("messages").insert({
    conversation_id: conversation!.id,
    direction: "inbound",
    kind: "inbound",
    body,
    twilio_sid: SmsSid,
  });

  // A reply stops the follow-up sequence (cron only touches status='open')
  await supabase
    .from("conversations")
    .update({ status: "replied", last_message_at: new Date().toISOString() })
    .eq("id", conversation!.id);

  return emptyTwiml();
}

function emptyTwiml() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { "Content-Type": "text/xml" } }
  );
}
