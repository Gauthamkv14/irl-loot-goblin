// server/progression.js
// Server-authoritative logic for XP curve, levels, daily quests, scavenger hunts, and achievements.

/**
 * Deterministic XP Curve Calculation
 * Level 1: 0 - 99 XP
 * Level 2: 100 - 249 XP
 * Level 3: 250 - 449 XP
 * Level N: Base formula: Level = floor((1 + sqrt(1 + 8 * XP / 50)) / 2) capped sensibly,
 * or clean quadratic threshold: XP required for level L = 50 * (L - 1)^1.5 + 50 * (L - 1).
 */
export function getLevelFromXP(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  while (getXPForLevel(level + 1) <= safeXp) {
    level++;
  }
  return level;
}

// Explicit threshold table for predictable, clean RPG progression:
// Level 1: 0 XP
// Level 2: 100 XP
// Level 3: 250 XP
// Level 4: 450 XP
// Level 5: 700 XP
// Level 6: 1000 XP
// Level 7: 1400 XP
// Level 8: 1900 XP
// Level 9: 2500 XP
// Level 10: 3200 XP
const LEVEL_THRESHOLDS = [
  0,     // Level 1
  100,   // Level 2
  250,   // Level 3
  450,   // Level 4
  700,   // Level 5
  1000,  // Level 6
  1400,  // Level 7
  1900,  // Level 8
  2500,  // Level 9
  3200   // Level 10
];

export function getXPForLevel(level) {
  if (level <= 1) return 0;
  if (level <= LEVEL_THRESHOLDS.length) {
    return LEVEL_THRESHOLDS[level - 1];
  }
  // Formula for levels beyond 10
  const excess = level - 10;
  return 3200 + excess * 1000;
}

export function getProgressionDetails(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const currentLevel = getLevelFromXP(safeXp);
  const currentLevelXp = getXPForLevel(currentLevel);
  const nextLevelXp = getXPForLevel(currentLevel + 1);
  const xpInCurrentLevel = safeXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((xpInCurrentLevel / xpNeededForNextLevel) * 100)));

  return {
    xp: safeXp,
    level: currentLevel,
    currentLevelXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progressPercent
  };
}

/**
 * Server-defined UTC date string (YYYY-MM-DD) for deterministic daily resets
 */
export function getDailyQuestDate(dateObj = new Date()) {
  return dateObj.toISOString().slice(0, 10);
}

/**
 * Catalog of Daily Quests
 */
export const DAILY_QUEST_POOL = [
  {
    id: 'daily_appraise_1',
    title: 'Keen Eye',
    description: 'Appraise and hoard at least 1 outdoor relic today.',
    target: 1,
    xpReward: 35,
    coinReward: 20,
    check: (item, currentCount) => 1
  },
  {
    id: 'daily_uncommon_plus',
    title: 'Fortune of the Forest',
    description: 'Find a relic of Uncommon rarity or higher.',
    target: 1,
    xpReward: 50,
    coinReward: 35,
    check: (item) => (['Uncommon', 'Rare', 'Epic', 'Legendary'].includes(item.rarity) ? 1 : 0)
  },
  {
    id: 'daily_three_relics',
    title: 'Dedicated Forager',
    description: 'Hoard 3 relics in your treasury today.',
    target: 3,
    xpReward: 75,
    coinReward: 50,
    check: (item, currentCount) => 1
  },
  {
    id: 'daily_rare_find',
    title: 'Glitter in the Dirt',
    description: 'Discover and hoard a Rare, Epic, or Legendary relic.',
    target: 1,
    xpReward: 80,
    coinReward: 60,
    check: (item) => (['Rare', 'Epic', 'Legendary'].includes(item.rarity) ? 1 : 0)
  },
  {
    id: 'daily_observe_organic',
    title: 'Botanist Whisperer',
    description: 'Appraise any plant, leaf, wood, or nature-born artifact.',
    target: 1,
    xpReward: 40,
    coinReward: 25,
    check: (item) => {
      const text = `${item.name} ${item.observed_object} ${item.item_type}`.toLowerCase();
      return /leaf|plant|tree|bark|wood|flower|seed|acorn|moss|fern|grass/.test(text) ? 1 : 0;
    }
  }
];

/**
 * Deterministically select 3 active daily quests for a given YYYY-MM-DD date string
 */
export function getDailyQuestsForDate(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  const selected = [];
  const poolCopy = [...DAILY_QUEST_POOL];

  for (let i = 0; i < 3; i++) {
    const idx = (positiveHash + i * 3) % poolCopy.length;
    selected.push(poolCopy[idx]);
    poolCopy.splice(idx, 1);
  }

  return selected;
}

/**
 * Curated Themed Scavenger Hunts
 */
export const SCAVENGER_HUNTS = [
  {
    id: 'hunt_natures_palette',
    title: "Nature's Palette",
    description: 'Find outdoor artifacts exhibiting distinct natural pigments and organic textures.',
    rewardXp: 120,
    rewardCoins: 80,
    objectives: [
      {
        id: 'obj_emerald_foliage',
        label: 'Verdant Greenery',
        hint: 'A fresh green leaf, patch of moss, or living clover.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.lore}`.toLowerCase();
          return /green|emerald|chlorophyll|foliage|moss|clover|leaf/.test(t);
        }
      },
      {
        id: 'obj_earth_bark',
        label: 'Ancient Bark or Timber',
        hint: 'Fallen branch, rough tree bark, or weathered driftwood.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.item_type}`.toLowerCase();
          return /bark|wood|timber|branch|twig|log|driftwood/.test(t);
        }
      },
      {
        id: 'obj_stone_earth',
        label: 'Weathered Earthstone',
        hint: 'A river rock, smooth pebble, or jagged mineral stone.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.item_type}`.toLowerCase();
          return /stone|rock|pebble|mineral|boulder|flint|gravel/.test(t);
        }
      }
    ]
  },
  {
    id: 'hunt_tiny_details',
    title: 'Tiny Details',
    description: 'Train your eyes to look for miniature marvels hiding right beneath your boots.',
    rewardXp: 150,
    rewardCoins: 100,
    objectives: [
      {
        id: 'obj_seed_or_acorn',
        label: 'Seed of the Future',
        hint: 'A seed pod, pinecone, acorn, or burr.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name}`.toLowerCase();
          return /seed|acorn|pinecone|cone|pod|nut|burr/.test(t);
        }
      },
      {
        id: 'obj_feather_or_folia',
        label: 'Intricate Vein or Quill',
        hint: 'A fallen bird feather or leaf skeleton with visible vascular veins.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.lore}`.toLowerCase();
          return /feather|quill|vein|skeleton|skeletonized|delicate/.test(t);
        }
      },
      {
        id: 'obj_uncommon_mineral',
        label: 'Sparkling Specimen',
        hint: 'Any find appraised at Uncommon or higher rarity.',
        matches: (item) => ['Uncommon', 'Rare', 'Epic', 'Legendary'].includes(item.rarity)
      }
    ]
  },
  {
    id: 'hunt_urban_explorer',
    title: 'Everyday Engineering',
    description: 'Find evidence of human craft interacting with the outdoor elements.',
    rewardXp: 130,
    rewardCoins: 90,
    objectives: [
      {
        id: 'obj_metal_oxidation',
        label: 'Aged Metal or Patina',
        hint: 'A rusty washer, copper patina, old iron fastener, or metallic curio.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.item_type}`.toLowerCase();
          return /metal|iron|rust|bolt|nail|copper|coin|washer|screw|steel/.test(t);
        }
      },
      {
        id: 'obj_pavement_crack',
        label: 'Sprout in the Concrete',
        hint: 'A resilient weed or blade of grass growing through mortar or asphalt.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.lore}`.toLowerCase();
          return /crack|concrete|asphalt|pavement|brick|weed|sprout|sidewalk/.test(t);
        }
      },
      {
        id: 'obj_glass_or_ceramic',
        label: 'Sea Glass or Ceramic Fragment',
        hint: 'Tumbled beach glass, pottery shard, or brick fragment.',
        matches: (item) => {
          const t = `${item.observed_object} ${item.name} ${item.item_type}`.toLowerCase();
          return /glass|shard|ceramic|pottery|porcelain|tile|brick/.test(t);
        }
      }
    ]
  }
];

/**
 * Goblin Achievement Definitions
 */
export const ACHIEVEMENTS = [
  {
    id: 'ach_first_hoard',
    title: 'First Hoard',
    description: 'Hoard your first authentic relic in your treasury.',
    icon: '🎒',
    xpReward: 50,
    check: (stats) => stats.totalHoarded >= 1
  },
  {
    id: 'ach_five_relics',
    title: 'Budding Goblin',
    description: 'Hoard 5 distinct relics in your treasury.',
    icon: '🪙',
    xpReward: 100,
    check: (stats) => stats.totalHoarded >= 5
  },
  {
    id: 'ach_fifteen_relics',
    title: 'Veteran Hoarder',
    description: 'Gather 15 relics in your personal treasury.',
    icon: '👑',
    xpReward: 250,
    check: (stats) => stats.totalHoarded >= 15
  },
  {
    id: 'ach_rare_discovery',
    title: 'Gem of the Wilds',
    description: 'Discover and hoard a Rare relic.',
    icon: '💎',
    xpReward: 100,
    check: (stats) => stats.rarityCounts?.Rare >= 1 || stats.rarityCounts?.Epic >= 1 || stats.rarityCounts?.Legendary >= 1
  },
  {
    id: 'ach_epic_discovery',
    title: 'Arcane Wonder',
    description: 'Discover and hoard an Epic relic.',
    icon: '🔮',
    xpReward: 200,
    check: (stats) => stats.rarityCounts?.Epic >= 1 || stats.rarityCounts?.Legendary >= 1
  },
  {
    id: 'ach_legendary_discovery',
    title: 'The Stuff of Legends',
    description: 'Discover and hoard a mythical Legendary relic.',
    icon: '✨',
    xpReward: 500,
    check: (stats) => (stats.rarityCounts?.Legendary || 0) >= 1
  },
  {
    id: 'ach_daily_quest_master',
    title: 'Disciplined Scout',
    description: 'Complete your first daily exploration quest.',
    icon: '📜',
    xpReward: 75,
    check: (stats) => (stats.dailyQuestsCompleted || 0) >= 1
  },
  {
    id: 'ach_hunt_completed',
    title: 'Master Scavenger',
    description: 'Complete all objectives for an entire themed scavenger hunt.',
    icon: '🧭',
    xpReward: 150,
    check: (stats) => (stats.huntsCompleted || 0) >= 1
  }
];
