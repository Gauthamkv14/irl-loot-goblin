import { z } from 'zod';
import { callProvider, cleanJsonString } from './appraise.js';

export const EligibilitySchema = z.object({
  eligible: z.boolean(),
  subject: z.string().trim().default('unidentified object'),
  reason: z.string().trim().default('')
});

export const ELIGIBILITY_PROMPT = `You are a strict outdoor natural discovery classifier for an outdoor exploration game.
Inspect this photo and determine whether the primary subject is an authentic, naturally occurring outdoor find (such as wild leaves, living outdoor plants, wild fungi, rocks, stones, soil, tree bark, twigs, shells).

REJECT (eligible: false) if:
1. The subject is a manufactured, electronic, or synthetic item (e.g. computer mouse, keyboard, monitor, cables, plastic objects, tools, furniture, vehicles, toys), even if placed on grass or in an outdoor setting.
2. The image depicts a digital screen, monitor, television, phone screen, photograph of a photo, or digital wallpaper/render.
3. The subject is an indoor household item, potted indoor plant, or indoor setting.
4. The subject is ambiguous, blurry, or cannot be definitively confirmed as a wild outdoor natural find.

ACCEPT (eligible: true) ONLY if:
The subject is a genuine, naturally occurring outdoor natural object photographed in an outdoor or natural environment.

Respond strictly with a JSON object:
{
  "eligible": boolean,
  "subject": string,
  "reason": string
}`;

/**
 * Format a whimsical goblin rejection message based on classification details
 */
export function formatRejectionMessage(subject, reason) {
  const lower = `${subject} ${reason}`.toLowerCase();
  if (lower.includes('screen') || lower.includes('monitor') || lower.includes('display') || lower.includes('wallpaper')) {
    return "The goblin appraiser taps your glass: 'Are you trying to trick me with a glowing screen? Real goblins only hoard physical relics found under the open sky!'";
  }
  if (lower.includes('mouse') || lower.includes('keyboard') || lower.includes('hardware') || lower.includes('electronic') || lower.includes('device')) {
    return `The goblin appraiser sniffs suspiciously: '${subject}' smells like indoor machinery and wizard-wires! Go touch some grass and bring me real treasures from the wild earth.`;
  }
  if (lower.includes('indoor') || lower.includes('potted') || lower.includes('illustration') || lower.includes('furniture')) {
    return `The goblin appraiser squints in disappointment: '${subject}' looks like indoor furnishings or potted décor. Step outside into the wild to find genuine outdoor loot!`;
  }
  return `The goblin appraiser scoffs: '${subject}' is not a legitimate outdoor natural find. Only wild plants, leaves, stones, and earth treasures qualify as certified goblin loot!`;
}

/**
 * Verify whether an uploaded photo contains an authentic outdoor natural find.
 * Fails closed on any provider failure, timeout, or malformed output.
 * 
 * @param {string} dataUrl - base64 data URL of the image
 * @param {{ baseUrl: string, apiKey: string, modelId: string }} config
 * @param {number} [timeoutMs=25000]
 * @returns {Promise<{ eligible: boolean, subject: string, reason: string, userMessage?: string }>}
 */
export async function checkOutdoorEligibility(dataUrl, config, timeoutMs = 25000) {
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: ELIGIBILITY_PROMPT },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ];

  try {
    const rawOutput = await callProvider(messages, config, timeoutMs);
    const cleaned = cleanJsonString(rawOutput);
    const parsed = JSON.parse(cleaned);
    const validated = EligibilitySchema.safeParse(parsed);

    if (!validated.success) {
      console.warn('[Eligibility] Schema validation failed for classifier output:', validated.error.message);
      return {
        eligible: false,
        subject: 'unclear object',
        reason: 'Classifier response did not match validation schema.',
        userMessage: 'The goblin appraiser is squinting in confusion and cannot confirm this find. Please try another photo with clear natural lighting.'
      };
    }

    const { eligible, subject, reason } = validated.data;
    if (!eligible) {
      return {
        eligible: false,
        subject,
        reason,
        userMessage: formatRejectionMessage(subject, reason)
      };
    }

    return {
      eligible: true,
      subject,
      reason
    };
  } catch (err) {
    // FAIL-CLOSED: On timeout, network failure, or unparseable output, reject upload
    console.error(`[Eligibility] Classification error (failing closed): ${err.message}`);
    return {
      eligible: false,
      subject: 'unverified find',
      reason: `Eligibility verification failed: ${err.message}`,
      userMessage: 'The goblin appraiser could not verify this as a natural outdoor find. Please check your connection and try another photo taken outdoors.'
    };
  }
}
