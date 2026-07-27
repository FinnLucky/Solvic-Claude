import { db } from "@/lib/supabase";
import { sendSms, renderTemplate } from "@/lib/twilio";
import { FOLLOWUP_SEQUENCE } from "@/lib/sequences";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron hits this every 15 min (see vercel.json).
// Sends the next sequence step to any open conversation whose last outbound
// message is older than the step's delay. Replies flip status to 'replied',
// which removes the conversation from this query entirely.

export async function GET(req: Request) {
  // Vercel sets Authorization: Bearer {CRON_SECRET} on cron invocations
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = db();
  const now = Date.now();
  let sent = 0;

  const { data: conversations } = await supabase
    .from("conversations")
    .select("*, clients(*), contacts(*)")
    .eq("status", "open")
    .lt("followup_step", FOLLOWUP_SEQUENCE.length)
    .not("last_message_at", "is", null)
    .limit(200);

  for (const convo of conversations ?? []) {
    const client = convo.clients;
    const contact = convo.contacts;
    if (!client?.followups_enabled || contact?.opted_out) continue;

    const step = FOLLOWUP_SEQUENCE[convo.followup_step];
    const due =
      new Date(convo.last_message_at).getTime() + step.delayHours * 3600_000;
    if (now < due) continue;

    const body = renderTemplate(step.body, {
      business_name: client.name,
      booking_url: client.booking_url,
    });

    try {
      const msg = await sendSms({
        from: client.twilio_number,
        to: contact.phone,
        body,
      });

      await supabase.from("messages").insert({
        conversation_id: convo.id,
        direction: "outbound",
        kind: "followup",
        body,
        twilio_sid: msg.sid,
      });

      await supabase
        .from("conversations")
        .update({
          followup_step: convo.followup_step + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq("id", convo.id);

      sent++;
    } catch (err) {
      console.error(`Follow-up failed for conversation ${convo.id}:`, err);
    }
  }

  return Response.json({ sent });
}
