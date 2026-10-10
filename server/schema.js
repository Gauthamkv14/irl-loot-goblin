import { z } from 'zod';
import { signLoot } from './auth.js';

/**
 * Schema validating the AI model's creative narrative output.
 * The server supplies rarity, stats, and goblin_value.
 */
export const ModelOutputSchema = z.object({
  observed_object: z.string().trim().min(3).max(300),
  confidence: z.enum(['low', 'medium', 'high']),
  name: z.string().trim().min(2).max(60),
  item_type: z.string().trim().min(2).max(40),
  ability_name: z.string().trim().min(2).max(60),
  ability_description: z.string().trim().min(5).max(280),
  lore: z.string().trim().min(5).max(350),
  appraisal: z.string().trim().min(5).max(280)
});

/**
 * Complete Item Schema returned to the client
 */
export const LootCardSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  source: z.enum(['model', 'fallback']),
  observed_object: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  name: z.string(),
  item_type: z.string(),
  rarity: z.enum(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']),
  stats: z.record(z.string(), z.number()),
  goblin_value: z.number().int().nonnegative(),
  ability_name: z.string(),
  ability_description: z.string(),
  lore: z.string(),
  appraisal: z.string(),
  disclaimer: z.string(),
  signature: z.string().optional()
});

/**
 * Generate a safe, labelled fallback item when model appraisal fails or is unavailable.
 * @param {{ rarity: string, stats: Record<string, number>, goblin_value: number }} roll
 * @returns {z.infer<typeof LootCardSchema>}
 */
export function fallbackItem(roll) {
  const fallbackRoll = roll || {
    rarity: 'Common',
    stats: { LUCK: 1, WIT: 2 },
    goblin_value: 5
  };

  const item = {
    id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    source: 'fallback',
    observed_object: 'An unidentified terrestrial relic obscured by mystical garden mist.',
    confidence: 'low',
    name: 'Mysterious Curious Thing',
    item_type: 'Enigmatic Curio',
    rarity: fallbackRoll.rarity,
    stats: fallbackRoll.stats,
    goblin_value: fallbackRoll.goblin_value,
    ability_name: 'Puzzling Aura',
    ability_description: 'Emits a faint glow of mystery. Confuses nearby raccoons and appraisers alike.',
    lore: 'Recovered from the undergrowth during an appraisal blackout. The goblin appraiser was busy chasing a shiny beetle, leaving behind only this crude tag.',
    appraisal: 'Look, I was distracted by a remarkably spherical pebble! But rest assured, this object is undeniably tangible.',
    disclaimer: 'Certified Goblin Appraisal. Fictional RPG item; observe in nature, do not collect or disturb.'
  };

  item.signature = signLoot(item);
  return item;
}
