// Follow-up sequence, workflows-as-code style.
// A conversation gets these while status = 'open' (i.e. no reply yet).
// Any inbound reply flips status to 'replied' and the sequence stops.
// Templates support {{business_name}} and {{booking_url}}.

export interface SequenceStep {
  /** Hours after the previous outbound message before this step sends */
  delayHours: number;
  body: string;
}

export const FOLLOWUP_SEQUENCE: SequenceStep[] = [
  {
    delayHours: 1,
    body: "Just checking back in from {{business_name}} — still happy to help if you need us. You can also grab a time that works for you here: {{booking_url}}",
  },
  {
    delayHours: 24,
    body: "Hi again from {{business_name}}! Wanted to make sure you got taken care of. If you still need a hand, just reply here or book a time: {{booking_url}}",
  },
  {
    delayHours: 72,
    body: "Last note from {{business_name}} — we'll leave you be after this! If anything comes up down the road, this number reaches us directly.",
  },
];
