import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment variables
const envPath = path.resolve(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ Error: server/.env file not found.');
  process.exit(1);
}

dotenv.config({ path: envPath });

// 2. Validate configuration presence without printing secret values
const baseUrl = process.env.PROVIDER_BASE_URL?.trim();
const apiKey = process.env.PROVIDER_API_KEY?.trim();
const modelId = process.env.MODEL_ID?.trim();

const missing = [];
if (!baseUrl) missing.push('PROVIDER_BASE_URL');
if (!apiKey) missing.push('PROVIDER_API_KEY');
if (!modelId) missing.push('MODEL_ID');

if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('✓ Configuration loaded:');
console.log(`  - PROVIDER_BASE_URL: ${baseUrl}`);
console.log(`  - MODEL_ID: ${modelId}`);
console.log(`  - PROVIDER_API_KEY: [Configured, length: ${apiKey.length} characters]`);

// 3. Locate test image (from command line argument or default fixtures directory)
const imageArg = process.argv[2];
let imagePath = null;

if (imageArg) {
  imagePath = path.resolve(process.cwd(), imageArg);
} else {
  const defaultDir = path.resolve(__dirname, 'test-images');
  if (fs.existsSync(defaultDir)) {
    const files = fs.readdirSync(defaultDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    if (files.length > 0) {
      imagePath = path.join(defaultDir, files[0]);
    }
  }
}

if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('\n⚠️ No test image found!');
  console.error('Please provide an image file by either:');
  console.error('  1. Passing a path argument: node test-call.js <path-to-image>');
  console.error('  2. Placing test images in "server/test-images/" (e.g. server/test-images/twig.jpg)');
  console.error('Supported formats: .jpg, .jpeg, .png, .webp');
  process.exit(2);
}

// 4. Read image and encode to base64 data URL
const ext = path.extname(imagePath).toLowerCase();
const mimeMap = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};
const mimeType = mimeMap[ext];

if (!mimeType) {
  console.error(`❌ Unsupported image format: ${ext}. Supported formats: .jpg, .jpeg, .png, .webp`);
  process.exit(1);
}

const imageBuffer = fs.readFileSync(imagePath);
const base64Data = imageBuffer.toString('base64');
const dataUrl = `data:${mimeType};base64,${base64Data}`;

console.log(`✓ Image loaded successfully: ${path.basename(imagePath)}`);
console.log(`  - Format: ${mimeType}`);
console.log(`  - Size: ${(imageBuffer.length / 1024).toFixed(1)} KB`);

// 5. Construct OpenAI-compatible multimodal chat completion payload
const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
const promptText = 'Describe the visible physical object in this photo, its material, color, and notable physical features in 2-3 concise sentences.';

const payload = {
  model: modelId,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: promptText
        },
        {
          type: 'image_url',
          image_url: {
            url: dataUrl
          }
        }
      ]
    }
  ],
  reasoning: { effort: 'none' },
  temperature: 0.2,
  max_tokens: 350
};

console.log(`\n⏳ Sending multimodal request to: ${endpoint}`);
console.log(`  - Target Model: ${modelId}`);
const startTime = Date.now();

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/irl-loot-goblin',
      'X-Title': 'IRL Loot Goblin Smoke Test'
    },
    body: JSON.stringify(payload),
    signal: controller.signal
  });

  clearTimeout(timeoutId);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`\n❌ Provider returned HTTP error status ${response.status} (${response.statusText}) in ${elapsed}s:`);
    try {
      const parsed = JSON.parse(errorBody);
      console.error(JSON.stringify(parsed, null, 2));
    } catch {
      console.error(errorBody);
    }
    process.exit(1);
  }

  const result = await response.json();
  const choice = result.choices?.[0];
  const content = choice?.message?.content || choice?.message?.reasoning;

  console.log(`\n🎉 Success! Response received in ${elapsed}s:`);
  console.log('--------------------------------------------------');
  console.log(content?.trim() || '[Empty content received]');
  console.log('--------------------------------------------------');

  if (result.usage) {
    console.log(`Tokens used: Prompt=${result.usage.prompt_tokens}, Completion=${result.usage.completion_tokens}, Total=${result.usage.total_tokens}`);
  }
} catch (err) {
  clearTimeout(timeoutId);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  if (err.name === 'AbortError') {
    console.error(`\n❌ Request timed out after ${elapsed}s.`);
  } else {
    console.error(`\n❌ Network / Request Error in ${elapsed}s:`, err.message);
  }
  process.exit(1);
}
