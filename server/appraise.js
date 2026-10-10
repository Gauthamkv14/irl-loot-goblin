import { SYSTEM_PROMPT, FEW_SHOT_EXAMPLES, buildUserPrompt } from './prompt.js';
import { ModelOutputSchema, fallbackItem } from './schema.js';
import { rollLoot } from './loot.js';

/**
 * Strips markdown code fences (e.g. ```json ... ```) from model response string
 */
export function cleanJsonString(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();

  // Strip leading ```json or ```
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
  // Strip trailing ```
  cleaned = cleaned.replace(/\s*```$/, '');

  // If the model enclosed JSON in additional chatter, attempt extracting the first outermost { ... }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return cleaned.trim();
}

/**
 * Checks if the text violates safety rules regarding touching/eating outdoor objects
 */
export function containsSafetyViolation(text) {
  if (!text || typeof text !== 'string') return false;
  const lower = text.toLowerCase();
  const dangerousPatterns = [
    /\b(eat|taste|ingest|consume|bite)\b/i,
    /\b(touch|grab|pluck|pick up|collect)\s+(this|the)\s+(mushroom|fungus|plant|berry|insect|spider|snake|creature)\b/i,
    /\bput\s+(it|this)\s+in\s+your\s+mouth\b/i
  ];
  return dangerousPatterns.some((pattern) => pattern.test(lower));
}

/**
 * Call the OpenAI-compatible provider with the image and prompt
 */
async function callProvider(messages, config, timeoutMs = 45000) {
  const { baseUrl, apiKey, modelId } = config;
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const payload = {
    model: modelId,
    messages,
    temperature: 0.85,
    max_tokens: 600,
    reasoning: { effort: 'none' } // prevent token starvation on thinking models
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/irl-loot-goblin',
        'X-Title': 'IRL Loot Goblin Appraiser'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      const err = new Error(`Provider HTTP ${response.status}: ${errText}`);
      err.status = response.status;
      throw err;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const rawContent = choice?.message?.content || choice?.message?.reasoning || '';
    return rawContent;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Perform appraisal pipeline:
 * 1. Roll server-authoritative loot
 * 2. Send image and prompt to provider
 * 3. Clean fences, parse JSON, validate with Zod
 * 4. On failure, attempt exactly ONE repair retry
 * 5. On second failure or provider error, return fallback item
 * 
 * @param {string} dataUrl - base64 data URL of the image
 * @param {string|null} huntPrompt - optional scavenger hunt prompt
 * @param {{ baseUrl: string, apiKey: string, modelId: string }} config
 * @returns {Promise<import('./schema.js').LootCardSchema>}
 */
export async function appraisePhoto(dataUrl, huntPrompt = null, config) {
  const roll = rollLoot();

  const userPrompt = buildUserPrompt(roll, huntPrompt);

  const initialMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...FEW_SHOT_EXAMPLES,
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ];

  let rawOutput = '';
  let parsedJson = null;
  let validationError = null;

  try {
    // Attempt 1: Initial call
    rawOutput = await callProvider(initialMessages, config);
    const cleaned = cleanJsonString(rawOutput);
    const parsed = JSON.parse(cleaned);
    const validated = ModelOutputSchema.safeParse(parsed);

    if (validated.success) {
      parsedJson = validated.data;
    } else {
      validationError = validated.error.message;
    }
  } catch (err) {
    validationError = err.message;
  }

  // Attempt 2: One controlled repair retry if validation or parsing failed
  if (!parsedJson) {
    try {
      const repairMessages = [
        ...initialMessages,
        { role: 'assistant', content: rawOutput || '{"error": "invalid format"}' },
        {
          role: 'user',
          content: `Your previous response was not valid JSON conforming to the schema (Error: ${validationError || 'Unparseable JSON'}). Please return ONLY a valid JSON object matching the required schema with all fields populated.`
        }
      ];

      const repairOutput = await callProvider(repairMessages, config, 35000);
      const cleanedRepair = cleanJsonString(repairOutput);
      const repairParsed = JSON.parse(cleanedRepair);
      const repairValidated = ModelOutputSchema.safeParse(repairParsed);

      if (repairValidated.success) {
        parsedJson = repairValidated.data;
      }
    } catch (retryErr) {
      // Repair retry failed, proceed to fallback
    }
  }

  // If both attempts failed or safety violation detected, return labelled fallback
  if (!parsedJson || containsSafetyViolation(`${parsedJson.lore} ${parsedJson.ability_description}`)) {
    return fallbackItem(roll);
  }

  // Merge server-rolled stats with model narrative
  return {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    source: 'model',
    observed_object: parsedJson.observed_object,
    confidence: parsedJson.confidence,
    name: parsedJson.name,
    item_type: parsedJson.item_type,
    rarity: roll.rarity,
    stats: roll.stats,
    goblin_value: roll.goblin_value,
    ability_name: parsedJson.ability_name,
    ability_description: parsedJson.ability_description,
    lore: parsedJson.lore,
    appraisal: parsedJson.appraisal,
    disclaimer: 'Certified Goblin Appraisal. Fictional RPG item; observe in nature, do not collect or disturb.'
  };
}
