import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

function client() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return _client;
}

export async function sendSms(opts: { from: string; to: string; body: string }) {
  return client().messages.create(opts);
}

/**
 * Validate a webhook request came from Twilio. `url` must exactly match the
 * public URL Twilio called. Set SKIP_TWILIO_VALIDATION=1 only for local sims.
 */
export function isValidTwilioRequest(
  signature: string | null,
  url: string,
  params: Record<string, string>
): boolean {
  if (process.env.SKIP_TWILIO_VALIDATION === "1") return true;
  if (!signature) return false;
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params
  );
}

/** Parse application/x-www-form-urlencoded body from a Request */
export async function parseTwilioForm(
  req: Request
): Promise<Record<string, string>> {
  const text = await req.text();
  return Object.fromEntries(new URLSearchParams(text).entries());
}

/** Render a client's message template */
export function renderTemplate(
  template: string,
  vars: { business_name: string; booking_url?: string | null }
): string {
  return template
    .replaceAll("{{business_name}}", vars.business_name)
    .replaceAll("{{booking_url}}", vars.booking_url ?? "");
}
