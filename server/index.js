import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import { appraisePhoto } from './appraise.js';
import { fallbackItem, LootCardSchema } from './schema.js';
import { rollLoot } from './loot.js';
import { verifyLootSignature, getSigningSecret } from './auth.js';
import { createClient } from '@supabase/supabase-js';
import {
  getLevelFromXP,
  getProgressionDetails,
  getDailyQuestDate,
  getDailyQuestsForDate,
  SCAVENGER_HUNTS,
  ACHIEVEMENTS
} from './progression.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// In production, validate that LOOT_SIGNING_SECRET is configured before accepting traffic
if (process.env.NODE_ENV === 'production') {
  getSigningSecret();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting: 10 requests per minute per IP to protect quota
const appraiseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many appraisal requests. Please wait a moment before showing more loot to the goblin.'
  }
});

// Multer memory storage configuration (4MB limit, JPEG/PNG/WebP only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024 // 4 MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Invalid file type. Only JPEG, PNG, and WebP images are accepted.');
      err.code = 'INVALID_MIME_TYPE';
      cb(err, false);
    }
  }
});

// Provider configuration accessor
function getProviderConfig() {
  const baseUrl = process.env.PROVIDER_BASE_URL?.trim();
  const apiKey = process.env.PROVIDER_API_KEY?.trim();
  const modelId = process.env.MODEL_ID?.trim();

  if (!baseUrl || !apiKey || !modelId) {
    return null;
  }
  return { baseUrl, apiKey, modelId };
}

// 1. Health check endpoint (for Render warming, uptime, and status check)
app.get('/api/health', (req, res) => {
  const hasConfig = Boolean(getProviderConfig());
  res.json({
    ok: true,
    status: 'healthy',
    providerConfigured: hasConfig,
    timestamp: new Date().toISOString()
  });
});

// Magic byte validation helper
function validateImageMagicBytes(buffer, mimetype) {
  if (!buffer || buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    );
  }
  // WebP: RIFF .... WEBP
  if (mimetype === 'image/webp') {
    const isRiff = buffer.toString('ascii', 0, 4) === 'RIFF';
    const isWebp = buffer.toString('ascii', 8, 12) === 'WEBP';
    return isRiff && isWebp;
  }

  return false;
}

// 2. Appraisal endpoint
app.post('/api/appraise', appraiseLimiter, (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'Image too large. Maximum allowed file size is 4 MB.'
        });
      }
      if (err.code === 'INVALID_MIME_TYPE') {
        return res.status(400).json({
          error: err.message
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          error: 'Unexpected field. Please upload the photo under field name "image".'
        });
      }
      return res.status(400).json({
        error: `Upload error: ${err.message}`
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No image provided. Please upload an image file under field name "image".'
    });
  }

  // Deep inspection: verify file header magic bytes match declared mimetype
  if (!validateImageMagicBytes(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({
      error: 'Corrupted or spoofed image file. Header bytes do not match declared image format.'
    });
  }

  const huntPrompt = req.body?.hunt ? String(req.body.hunt).slice(0, 300) : null;
  const config = getProviderConfig();

  // If provider credentials are missing, seamlessly return deterministic fallback
  if (!config) {
    const fallback = fallbackItem(rollLoot());
    return res.json(fallback);
  }

  // Convert uploaded buffer to base64 data URL
  const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

  try {
    const item = await appraisePhoto(dataUrl, huntPrompt, config);
    return res.json(item);
  } catch (err) {
    // If an unhandled failure occurred in appraisePhoto, return a safe fallback item
    const fallback = fallbackItem(rollLoot());
    return res.json(fallback);
  }
});

// 3. Server-authoritative Inventory Save Endpoint
// Authenticates user via Supabase JWT, validates tamper-proof loot signature, and saves to database
app.post('/api/inventory/save', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized. An authentication token is required to hoard relics in your treasury.'
    });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: 'Database service is currently unconfigured on the server.'
    });
  }

  // 1. Verify access token with Supabase Auth
  let userId = null;
  let supabaseServer = null;
  try {
    supabaseServer = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'Invalid or expired authentication session. Please sign in again.'
      });
    }
    userId = user.id;
  } catch (err) {
    return res.status(401).json({
      error: 'Failed to verify authentication token.'
    });
  }

  // 2. Validate loot item schema
  const { item, thumbnail } = req.body || {};
  const schemaValidation = LootCardSchema.safeParse(item);
  if (!schemaValidation.success) {
    return res.status(400).json({
      error: 'Malformed loot item structure.',
      details: schemaValidation.error.format()
    });
  }

  // 3. Cryptographic Tamper-Proof Check:
  // Verify that the complete canonical loot record (stats, coins, rarity, name, lore, ability, observation)
  // matches the authentic, server-issued signature and has not been altered in any way by the client.
  const isSignatureValid = verifyLootSignature(item);

  if (!isSignatureValid) {
    return res.status(403).json({
      error: 'Tampering detected! Loot record does not match certified server appraisal.'
    });
  }

  // 4. Save to database using verified userId and authenticated client
  try {
    // Instantiate client scoped with user's access token to enforce Row Level Security
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    const todayDate = getDailyQuestDate();
    const activeDailyQuests = getDailyQuestsForDate(todayDate);

    // Compute eligible daily quest IDs based on verified item properties
    const eligibleQuestIds = activeDailyQuests
      .filter(q => q.check(item) > 0)
      .map(q => q.id);

    // Compute eligible scavenger hunt objectives based on verified item properties
    const eligibleHuntObjectives = [];
    for (const hunt of SCAVENGER_HUNTS) {
      for (const obj of hunt.objectives) {
        if (obj.matches(item)) {
          eligibleHuntObjectives.push({ hunt_id: hunt.id, objective_id: obj.id });
        }
      }
    }

    // Evaluate potential achievements from current user treasury stats
    const statsClient = (process.env.SUPABASE_SERVICE_ROLE_KEY && supabaseServer) ? supabaseServer : userClient;
    const { data: allLoot } = await statsClient
      .from('loot_items')
      .select('rarity')
      .eq('user_id', userId);

    const totalHoarded = (allLoot?.length || 0) + 1;
    const rarityCounts = {};
    (allLoot || []).forEach(l => {
      rarityCounts[l.rarity] = (rarityCounts[l.rarity] || 0) + 1;
    });
    rarityCounts[item.rarity] = (rarityCounts[item.rarity] || 0) + 1;

    const { count: dailyQuestsDoneCount } = await userClient
      .from('daily_quest_progress')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true);

    const statsForAchievements = {
      totalHoarded,
      rarityCounts,
      dailyQuestsCompleted: dailyQuestsDoneCount || 0
    };

    const eligibleAchievements = ACHIEVEMENTS
      .filter(ach => ach.check(statsForAchievements))
      .map(ach => ach.id);

    // 5. ATOMIC EXECUTION: Call goblin_internal.hoard_relic_atomic RPC function
    // Strict Authorization: Requires server-only SUPABASE_SERVICE_ROLE_KEY to execute.
    // Never silently fall back to anon key (which lacks execution privilege).
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return res.status(503).json({
        error: 'Database progression service configuration is incomplete on the server.'
      });
    }

    const serverInternalClient = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'goblin_internal' }
    });

    const { data: rpcResult, error: rpcError } = await serverInternalClient.rpc('hoard_relic_atomic', {
      p_user_id: userId,
      p_item: item,
      p_thumbnail: thumbnail ? String(thumbnail).slice(0, 100000) : null,
      p_today_date: todayDate,
      p_eligible_quest_ids: eligibleQuestIds,
      p_eligible_hunt_objectives: eligibleHuntObjectives,
      p_eligible_achievements: eligibleAchievements
    });

    if (rpcError) {
      return res.status(500).json({
        error: `Database save error: ${rpcError.message}`
      });
    }

    return res.status(200).json(rpcResult);
  } catch (err) {
    return res.status(500).json({
      error: `Failed to save relic to database: ${err.message}`
    });
  }
});

// 3b. Server-authoritative Inventory Retrieval Endpoint
// Authenticates user via Supabase JWT, retrieves user-isolated treasury relics
app.get('/api/inventory', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized. An authentication token is required to view your treasury.'
    });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseKey = serviceRoleKey || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({
      error: 'Database service is currently unconfigured on the server.'
    });
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: 'Invalid or expired authentication session. Please sign in again.'
      });
    }

    // Query inventory items isolated strictly to the authenticated user
    const dbClient = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey)
      : createClient(supabaseUrl, supabaseKey, {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        });

    const { data: items, error: fetchError } = await dbClient
      .from('loot_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching inventory:', fetchError);
      return res.status(500).json({
        error: 'Failed to retrieve inventory from treasury.'
      });
    }

    return res.json({
      ok: true,
      items: items || []
    });
  } catch (err) {
    console.error('Unexpected error fetching inventory:', err);
    return res.status(500).json({
      error: 'Failed to retrieve inventory from treasury.'
    });
  }
});

// 4. Progression & Quests State Endpoint (Read-only, verified token)
app.get('/api/progression/state', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Database service unconfigured.' });
  }

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication session.' });
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const todayDate = getDailyQuestDate();
    const activeDailyQuests = getDailyQuestsForDate(todayDate);

    // Fetch user progression
    const { data: progData } = await userClient
      .from('user_progression')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const xp = progData?.xp || 0;
    const progDetails = getProgressionDetails(xp);

    // Fetch user daily quest progress for today
    const { data: qData } = await userClient
      .from('daily_quest_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('quest_date', todayDate);

    const qProgressMap = new Map((qData || []).map(q => [q.quest_id, q]));
    const dailyQuestsWithProgress = activeDailyQuests.map(q => {
      const p = qProgressMap.get(q.id);
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        target: q.target,
        xpReward: q.xpReward,
        coinReward: q.coinReward,
        progress: p?.progress || 0,
        completed: Boolean(p?.completed)
      };
    });

    // Fetch scavenger hunt progress
    const { data: huntData } = await userClient
      .from('hunt_progress')
      .select('*')
      .eq('user_id', user.id);

    const completedObjSet = new Set((huntData || []).map(h => `${h.hunt_id}:${h.objective_id}`));
    const huntsWithProgress = SCAVENGER_HUNTS.map(h => {
      const objectives = h.objectives.map(o => ({
        id: o.id,
        label: o.label,
        hint: o.hint,
        completed: completedObjSet.has(`${h.id}:${o.id}`)
      }));
      const completedCount = objectives.filter(o => o.completed).length;
      return {
        id: h.id,
        title: h.title,
        description: h.description,
        rewardXp: h.rewardXp,
        rewardCoins: h.rewardCoins,
        objectives,
        completedCount,
        totalObjectives: objectives.length,
        isCompleted: completedCount === objectives.length
      };
    });

    // Fetch user unlocked achievements
    const { data: achData } = await userClient
      .from('user_achievements')
      .select('*')
      .eq('user_id', user.id);

    const unlockedAchMap = new Map((achData || []).map(a => [a.achievement_id, a.unlocked_at]));
    const achievementsWithStatus = ACHIEVEMENTS.map(a => ({
      id: a.id,
      title: a.title,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      unlocked: unlockedAchMap.has(a.id),
      unlockedAt: unlockedAchMap.get(a.id) || null
    }));

    return res.json({
      ok: true,
      todayDate,
      progression: {
        ...progDetails,
        coins: progData?.goblin_coins || 0
      },
      dailyQuests: dailyQuestsWithProgress,
      hunts: huntsWithProgress,
      achievements: achievementsWithStatus
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to fetch progression state: ${err.message}` });
  }
});

// ==========================================
// PHASE 7: LEADERBOARDS & TRADING ENDPOINTS
// ==========================================

// 5. Update Profile Public Opt-in & Title
app.post('/api/profile/privacy', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(503).json({ error: 'Database service unconfigured.' });

  try {
    const supabaseServer = createClient(supabaseUrl, supabaseKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid authentication session.' });

    const { is_public, display_name, public_title } = req.body || {};
    const sanitizedTitle = public_title ? String(public_title).trim().slice(0, 30) : 'Apprentice Forager';
    const sanitizedName = display_name ? String(display_name).trim().slice(0, 24) : null;

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const updatePayload = {
      is_public: Boolean(is_public),
      public_title: sanitizedTitle
    };
    if (sanitizedName) updatePayload.display_name = sanitizedName;

    const { error: updateError } = await userClient
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (updateError) throw updateError;

    return res.json({ ok: true, is_public: Boolean(is_public), display_name: sanitizedName, public_title: sanitizedTitle });
  } catch (err) {
    return res.status(500).json({ error: `Failed to update profile settings: ${err.message}` });
  }
});

// 6. Public Leaderboards (Paginated rankings respecting privacy)
app.get('/api/leaderboards', async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(503).json({
      error: 'Database service configuration incomplete on server (SUPABASE_SERVICE_ROLE_KEY required).'
    });
  }

  const category = req.query.category || 'xp'; // 'xp' | 'hoard' | 'achievements'
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = 15;
  const offset = (page - 1) * pageSize;

  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    let query = client.from('public_leaderboard_view').select('*', { count: 'exact' });

    if (category === 'hoard') {
      query = query.order('total_hoarded', { ascending: false }).order('xp', { ascending: false });
    } else if (category === 'achievements') {
      query = query.order('achievements_unlocked', { ascending: false }).order('xp', { ascending: false });
    } else {
      // Default: XP & level
      query = query.order('xp', { ascending: false }).order('level', { ascending: false }).order('last_progress_at', { ascending: true });
    }

    const { data, count, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    return res.json({
      ok: true,
      category,
      page,
      pageSize,
      totalCount: count || 0,
      leaderboard: data || []
    });
  } catch (err) {
    console.error(`[Leaderboard API Error] Failed to query public_leaderboard_view: ${err.message}`);
    return res.status(500).json({ error: `Failed to load leaderboard: ${err.message}` });
  }
});

// 7. Trading Outpost: List Open Offers (Server-authoritative read of public open offers)
app.get('/api/trades/offers', async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  // Use server service role key to reliably read open offers without exposing credentials to client
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Database service unconfigured.' });

  try {
    const client = createClient(supabaseUrl, serviceRoleKey);
    // Explicitly filter to status = 'open' and project only safe, necessary presentation fields
    const { data, error } = await client
      .from('trade_offers')
      .select('id, sender_id, sender_item_id, sender_item_name, sender_item_rarity, sender_item_thumbnail, wanted_description, status, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    return res.json({ ok: true, offers: data || [] });
  } catch (err) {
    console.error(`[Trading API Error] Failed to query trade_offers: ${err.message}`);
    return res.status(500).json({ error: `Failed to fetch trade offers: ${err.message}` });
  }
});

// 8. Trading Outpost: Create Trade Offer
app.post('/api/trades/offers', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Trading service unconfigured.' });

  try {
    const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid authentication session.' });

    const { item_id, wanted_description } = req.body || {};
    if (!item_id || !wanted_description) {
      return res.status(400).json({ error: 'Item ID and wanted description required.' });
    }

    // Verify user actually owns this item
    const { data: userItem, error: itemErr } = await supabaseServer
      .from('loot_items')
      .select('*')
      .eq('user_id', user.id)
      .eq('item_id', item_id)
      .maybeSingle();

    if (itemErr || !userItem) {
      return res.status(403).json({ error: 'You do not possess this relic in your treasury.' });
    }

    // Verify item is not already listed in an active open offer
    const { data: existingOffer } = await supabaseServer
      .from('trade_offers')
      .select('id')
      .eq('sender_id', user.id)
      .eq('sender_item_id', item_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingOffer) {
      return res.status(400).json({ error: 'This relic is already listed in an active trade offer!' });
    }

    // Insert trade offer via service client
    const { data: newOffer, error: insertOfferErr } = await supabaseServer
      .from('trade_offers')
      .insert({
        sender_id: user.id,
        sender_item_id: userItem.item_id,
        sender_item_name: userItem.name,
        sender_item_rarity: userItem.rarity,
        sender_item_thumbnail: userItem.thumbnail,
        wanted_description: String(wanted_description).trim().slice(0, 100),
        status: 'open'
      })
      .select()
      .single();

    if (insertOfferErr) throw insertOfferErr;

    return res.status(201).json({ ok: true, offer: newOffer });
  } catch (err) {
    return res.status(500).json({ error: `Failed to create trade offer: ${err.message}` });
  }
});

// 9. Trading Outpost: Execute Trade (Accept)
app.post('/api/trades/execute', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Trading service unconfigured.' });

  try {
    const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid authentication session.' });

    const { offer_id, caller_item_id } = req.body || {};
    if (!offer_id || !caller_item_id) {
      return res.status(400).json({ error: 'Offer ID and caller item ID required.' });
    }

    // Execute atomic trade in goblin_internal schema
    const internalClient = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'goblin_internal' }
    });

    const { data: result, error: rpcErr } = await internalClient.rpc('execute_trade_atomic', {
      p_offer_id: offer_id,
      p_caller_id: user.id,
      p_caller_item_id: caller_item_id
    });

    if (rpcErr) {
      return res.status(400).json({ error: rpcErr.message });
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Trade execution failed: ${err.message}` });
  }
});

// 10. Trading Outpost: Cancel Trade Offer
app.post('/api/trades/cancel', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return res.status(503).json({ error: 'Trading service unconfigured.' });

  try {
    const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid authentication session.' });

    const { offer_id } = req.body || {};
    if (!offer_id) return res.status(400).json({ error: 'Offer ID required.' });

    const internalClient = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: 'goblin_internal' }
    });

    const { data: result, error: rpcErr } = await internalClient.rpc('cancel_trade_atomic', {
      p_offer_id: offer_id,
      p_caller_id: user.id
    });

    if (rpcErr) return res.status(400).json({ error: rpcErr.message });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: `Failed to cancel offer: ${err.message}` });
  }
});

// Static files for production (serving client/dist)
const clientDistPath = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // In Express 5, catch-all wildcard syntax is /{0,} or app.use fallback
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    }
    next();
  });
}

// Global error handler
app.use((err, req, res, next) => {
  res.status(500).json({
    error: 'Internal server error'
  });
});

// Start listening if executed directly
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Loot Goblin API running on port ${PORT}`);
  });
}

export default app;
