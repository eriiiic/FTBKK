/** Placeholder in the code of conduct text, replaced by the contact email from settings. */
export const CONTACT_EMAIL_TOKEN = '{contactEmail}';

/**
 * Default code of conduct, used until it is edited in /admin/settings. The same text is seeded by
 * migrations/0011_code_of_conduct.sql and scripts/import.ts.
 */
export const DEFAULT_CODE_OF_CONDUCT = `La French Tech Bangkok brings together founders, employees, investors, students and friends of French tech in Thailand. This code of conduct applies to everyone who takes part: attendees, speakers, sponsors, hosts, volunteers and organisers.

It covers our events, our online groups (WhatsApp, LinkedIn and any other channel we run) and this website.

## Our commitment

We want a welcoming, harassment-free community for everyone, whatever their gender, gender identity, sexual orientation, origin, nationality, language, age, religion, disability, appearance, body size, experience or company.

## Expected behaviour

- Be kind and respectful, in person and online.
- Welcome newcomers and include people in the conversation.
- Respect people's boundaries, time and privacy.
- Respect the venue, our hosts and the speakers.
- If someone asks you to stop, stop.

## Unacceptable behaviour

- Harassment, intimidation or insults, in any form.
- Discrimination, or offensive comments about any of the characteristics above.
- Unwanted physical contact, attention or messages.
- Taking or sharing photos or videos of someone who asked not to be photographed.
- Aggressive selling, spam or unsolicited mass messages, at events or in our groups.
- Disrupting talks or the event.

## Consequences

If someone behaves in an unacceptable way, the organisers may ask them to stop, remove them from the event, or remove them from the community and its groups, without a refund. We decide case by case, based on what is fair and safe for the community.

## How to report

If you experience or witness unacceptable behaviour, talk to an organiser at the event, or write to us at ${CONTACT_EMAIL_TOKEN}. Reports are handled confidentially, and we will never share your name without your agreement.

Thank you for helping make La French Tech Bangkok a great community.`;

/**
 * The code of conduct Markdown with the contact email filled in (Markdown turns the bare address
 * into a mailto link). An emptied text falls back to the default.
 */
export function fillCodeOfConduct(md: string, contactEmail: string): string {
  const text = md.trim() ? md : DEFAULT_CODE_OF_CONDUCT;
  return text.split(CONTACT_EMAIL_TOKEN).join(contactEmail);
}
