import { db } from "@/lib/supabase";
import {
  sendSms,
  isValidTwilioRequest,
  parseTwilioForm,
  renderTemplate,
} from "@/lib/twilio";

export const dynamic = "force-dynamic";

// Twilio status callback on the client's number:
// Phone Number → Voice → "Call status changes" → POST {PUBLIC_BASE_URL}/api/twilio/voice
const MISSED_STATUSES = new Set(["no-answer", "busy", "failed"]);

export async function POST(req: Request) {
  const url = `${process.env.PUBLIC_BASE_URL}/api/twilio/voice`;
  const params = await parseTwilioForm(req);

  if (!isValidTwilioRequest(req.headers.get("x-twilio-signature"), url, params)) {
    return new Response("Invalid signature", { status: 403 });
  }

  const { CallStatus, From, To, CallSid } = params;
  const supabase = db();

  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("twilio_number", To)
    .single();

  if (!client) return new Response("Unknown number", { status: 200 });

  const missed = MISSED_STATUSES.has(CallStatus);

  const { data: contact } = await supabase
    .from("contacts")
    .upsert(
      { client_id: client.id, phone: From, source: "missed_call" },
      { onConflict: "client_id,phone", ignoreDuplicates: false }
    )
    .select()
    .single();

  await supabase.from("call_events").insert({
    client_id: client.id,
    contact_id: contact?.id ?? null,
    from_phone: From,
    call_sid: CallSid,
    call_status: CallStatus,
    texted_back: false,
  });

  if (!missed || !contact || contact.opted_out) {
    return new Response("OK", { status: 200 });
  }

  let { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("contact_id", contact.id)
    .eq("status", "open")
    .maybeSingle();

  if (!conversation) {
    const { data: created } = await supabase
      .from("conversations")
      .insert({ client_id: client.id, contact_id: contact.id })
      .select()
      .single();
    conversation = created;
  }

  // Dedupe: skip if we sent anything outbound in the last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation!.id)
    .eq("direction", "outbound")
    .gte("sent_at", tenMinAgo);

  if ((count ?? 0) > 0) return new Response("Already texted", { status: 200 });

  const body = renderTemplate(client.missed_call_message, {
    business_name: client.name,
    booking_url: client.booking_url,
  });

  const msg = await sendSms({ from: To, to: From, body });

  await supabase.from("messages").insert({
    conversation_id: conversation!.id,
    direction: "outbound",
    kind: "missed_call",
    body,
    twilio_sid: msg.sid,
  });

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversation!.id);

  await supabase
    .from("call_events")
    .update({ texted_back: true })
    .eq("call_sid", CallSid);

  return new Response("Texted back", { status: 200 });
}
