/**
 * server/loot.js — Server-authoritative loot tables and stat generation
 * 
 * Rules:
 * - Rarity weights: Common (45), Uncommon (28), Rare (16), Epic (8), Legendary (3)
 * - Stat budgets and Goblin Coin ranges derive strictly from rarity
 * - Stat pool: ATK, DEF, CHA, LUCK, WIT, STINK (split randomly across 2-3 stats)
 */

export const RARITIES = {
  Common: {
    weight: 45,
    budgetMin: 3,
    budgetMax: 6,
    coinsMin: 1,
    coinsMax: 10
  },
  Uncommon: {
    weight: 28,
    budgetMin: 6,
    budgetMax: 10,
    coinsMin: 10,
    coinsMax: 40
  },
  Rare: {
    weight: 16,
    budgetMin: 10,
    budgetMax: 15,
    coinsMin: 40,
    coinsMax: 150
  },
  Epic: {
    weight: 8,
    budgetMin: 15,
    budgetMax: 22,
    coinsMin: 150,
    coinsMax: 600
  },
  Legendary: {
    weight: 3,
    budgetMin: 22,
    budgetMax: 30,
    coinsMin: 600,
    coinsMax: 2000
  }
};

export const STAT_NAMES = ['ATK', 'DEF', 'CHA', 'LUCK', 'WIT', 'STINK'];

/**
 * Random integer between min and max inclusive
 */
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Select a rarity according to defined weights
 */
export function rollRarity() {
  const totalWeight = Object.values(RARITIES).reduce((acc, r) => acc + r.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const [rarity, config] of Object.entries(RARITIES)) {
    if (roll < config.weight) {
      return rarity;
    }
    roll -= config.weight;
  }
  return 'Common';
}

/**
 * Distribute a numeric budget across 2 or 3 randomly selected stats
 */
export function distributeStats(budget) {
  // Choose 2 or 3 distinct stats
  const statCount = Math.random() < 0.5 ? 2 : 3;
  const shuffled = [...STAT_NAMES].sort(() => Math.random() - 0.5);
  const chosenStats = shuffled.slice(0, statCount);

  const stats = {};
  let remaining = budget;

  for (let i = 0; i < chosenStats.length; i++) {
    const isLast = i === chosenStats.length - 1;
    const stat = chosenStats[i];
    if (isLast) {
      stats[stat] = remaining;
    } else {
      // Allocate at least 1, leaving at least 1 for each remaining stat
      const slotsLeft = chosenStats.length - 1 - i;
      const maxAlloc = remaining - slotsLeft;
      const alloc = randomInt(1, Math.max(1, Math.floor(maxAlloc * 0.75)));
      stats[stat] = alloc;
      remaining -= alloc;
    }
  }

  return stats;
}

/**
 * Roll complete server-authoritative loot parameters
 * @returns {{ rarity: string, stats: Record<string, number>, goblin_value: number }}
 */
export function rollLoot() {
  const rarity = rollRarity();
  const config = RARITIES[rarity];

  const budget = randomInt(config.budgetMin, config.budgetMax);
  const goblin_value = randomInt(config.coinsMin, config.coinsMax);
  const stats = distributeStats(budget);

  return {
    rarity,
    stats,
    goblin_value
  };
}
