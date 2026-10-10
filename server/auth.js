import crypto from 'node:crypto';

/**
 * Secret used to sign HMAC tokens for server-authoritative loot verification.
 * 
 * Production Rule:
 * In production (NODE_ENV === 'production'), LOOT_SIGNING_SECRET is strictly mandatory.
 * The server throws a fatal error on startup if it is missing or insecure.
 * 
 * Local Development:
 * In development or test mode, a stable development secret is used with a warning.
 */
export function getSigningSecret() {
  const secret = process.env.LOOT_SIGNING_SECRET?.trim() || process.env.SUPABASE_JWT_SECRET?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < 32) {
      throw new Error(
        'FATAL: LOOT_SIGNING_SECRET (min 32 characters) must be configured in environment variables for production.'
      );
    }
    return secret;
  }

  // Development / Test fallback
  return secret || 'dev-secret-irl-loot-goblin-32chars-local-dev-only';
}

/**
/**
 * Canonicalizes all trusted narrative and game-mechanic fields into a deterministic string.
 * Excludes only the signature itself and presentation-only client metadata (like user-uploaded thumbnails).
 * 
 * @param {object} item
 * @returns {string}
 */
export function canonicalizeLootPayload(item) {
  const normalizedStats = Object.keys(item.stats || {})
    .sort()
    .map(k => `${k}:${item.stats[k]}`)
    .join(',');

  return [
    item.id || '',
    item.createdAt || '',
    item.source || '',
    item.observed_object || '',
    item.confidence || '',
    item.name || '',
    item.item_type || '',
    item.rarity || '',
    item.goblin_value ?? 0,
    normalizedStats,
    item.ability_name || '',
    item.ability_description || '',
    item.lore || '',
    item.appraisal || '',
    item.disclaimer || ''
  ].join('|');
}

/**
 * Creates a tamper-proof HMAC signature for the complete trusted loot item
 * @param {object} item
 * @returns {string} Hex signature
 */
export function signLoot(item) {
  const secret = getSigningSecret();
  const payload = canonicalizeLootPayload(item);
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verifies that the loot's complete narrative and numerical parameters have not been tampered with
 * @param {object} item
 * @returns {boolean}
 */
export function verifyLootSignature(item) {
  if (!item || !item.signature || typeof item.signature !== 'string') return false;
  try {
    const expected = signLoot(item);
    const sigBuf = Buffer.from(item.signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}
