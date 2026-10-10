import assert from 'node:assert';
import { rollLoot, rollRarity, distributeStats, RARITIES, STAT_NAMES } from './loot.js';
import { ModelOutputSchema, LootCardSchema, fallbackItem } from './schema.js';
import { cleanJsonString, containsSafetyViolation } from './appraise.js';

console.log('--- Running Phase 2 Unit & Integrity Tests ---');

// Test 1: Loot Generator Rarity and Stat Distribution
console.log('1. Testing Loot generation & budget rules...');
const rarityCounts = {};
for (let i = 0; i < 500; i++) {
  const roll = rollLoot();
  rarityCounts[roll.rarity] = (rarityCounts[roll.rarity] || 0) + 1;

  assert(RARITIES[roll.rarity], `Invalid rarity: ${roll.rarity}`);
  const config = RARITIES[roll.rarity];

  // Verify coin range
  assert(
    roll.goblin_value >= config.coinsMin && roll.goblin_value <= config.coinsMax,
    `Coins out of range for ${roll.rarity}: got ${roll.goblin_value}`
  );

  // Verify stat budget sum
  const statKeys = Object.keys(roll.stats);
  assert(statKeys.length >= 2 && statKeys.length <= 3, `Expected 2-3 stats, got ${statKeys.length}`);
  const totalStats = Object.values(roll.stats).reduce((a, b) => a + b, 0);
  assert(
    totalStats >= config.budgetMin && totalStats <= config.budgetMax,
    `Stat budget sum out of range for ${roll.rarity}: got ${totalStats}`
  );

  // Verify valid stat names
  statKeys.forEach(s => assert(STAT_NAMES.includes(s), `Unknown stat: ${s}`));
}
console.log('✓ 500 loot rolls verified. Rarity distribution sample:', rarityCounts);

// Test 2: Schema validation
console.log('2. Testing Zod Schemas...');
const validModelData = {
  observed_object: "A crinkled brown autumn leaf with serrated lobes",
  confidence: "high",
  name: "Oak Sentinel's Sigil",
  item_type: "Ancient Talisman",
  ability_name: "Deciduous Ward",
  ability_description: "Absorbs harsh gusts of autumn wind.",
  lore: "Fallen from the great elder tree during the Great Breeze of '42.",
  appraisal: "An exquisite specimen of natural decay!"
};
const parsedModel = ModelOutputSchema.safeParse(validModelData);
assert(parsedModel.success, 'Valid model data failed schema validation');

const invalidModelData = {
  observed_object: "ok", // too short min(3)
  confidence: "unknown" // invalid enum
};
const parsedInvalid = ModelOutputSchema.safeParse(invalidModelData);
assert(!parsedInvalid.success, 'Invalid model data should have failed schema validation');
console.log('✓ ModelOutputSchema validation passed.');

// Test 3: Fallback item generator
console.log('3. Testing fallback item generator...');
const mockRoll = {
  rarity: 'Epic',
  stats: { ATK: 10, WIT: 8 },
  goblin_value: 350
};
const fallback = fallbackItem(mockRoll);
assert.strictEqual(fallback.source, 'fallback');
assert.strictEqual(fallback.rarity, 'Epic');
assert.strictEqual(fallback.goblin_value, 350);
assert.deepStrictEqual(fallback.stats, { ATK: 10, WIT: 8 });
const validFallback = LootCardSchema.safeParse(fallback);
assert(validFallback.success, 'Fallback item failed LootCardSchema');
console.log('✓ Fallback item structure and schema verified.');

// Test 4: Code fence and JSON cleaning
console.log('4. Testing cleanJsonString helper...');
const fenced = '```json\n{"name": "Twig", "observed_object": "A branch"}\n```';
assert.strictEqual(cleanJsonString(fenced), '{"name": "Twig", "observed_object": "A branch"}');

const wrappedWithChatter = 'Here is your appraisal:\n```json\n{"name": "Rock"}\n```\nHope you like it!';
assert.strictEqual(cleanJsonString(wrappedWithChatter), '{"name": "Rock"}');
console.log('✓ cleanJsonString successfully extracts JSON.');

// Test 5: Safety check helper
console.log('5. Testing containsSafetyViolation...');
assert(containsSafetyViolation('You should eat this strange mushroom!'));
assert(containsSafetyViolation('Go ahead and touch this plant in the wild.'));
assert(!containsSafetyViolation('Admire the shimmering dew on this stone from afar.'));
console.log('✓ containsSafetyViolation accurately flags hazards.');

console.log('\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!');
