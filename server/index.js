import express from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';
import { appraisePhoto } from './appraise.js';
import { fallbackItem } from './schema.js';
import { rollLoot } from './loot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
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
