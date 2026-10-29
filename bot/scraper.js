/**
 * File: bot/scraper.js
 * AlcashX Cloud Pro v9.0 — Real Model HD Poster Harvester & Google SafeSearch Blur Engine
 * Upgrades:
 *  1. ZERO Unsplash Stock Photos! 100% Real Amateur/Glamour Model Frames via RedGifs V2 API + Reddit JSON
 *  2. Google SafeSearch-Style Optical Blur (blur=6, contrast boost) so curves/pose are visible & high-CTR
 *  3. Preserves Custom Uploaded Vault Images (config.images) & never conflicts with admin.js
 */

import fs from 'fs';
import path from 'path';

const BANNED_WORDS = [
  'jerkmate', 'chaturbate', 'stripchat', 'bonga', 'cam4', 'ad', 'promo',
  'hentai', 'anime', '3d', 'sfm', 'cartoon', 'animated', 'rule34', 'furry',
  'gay', 'trans', 'shemale', 'femboy', 'cuck', 'male', 'guy', 'man'
];

const REDGIFS_NICHE_QUERIES = [
  'tiktok tease',
  'mirror selfie girl',
  'bikini try on haul',
  'shirt lift tease',
  'bedroom girlfriend tease',
  'tight dress curves',
  'lingerie mirror',
  'desi saree tease'
];

const REDDIT_MODEL_SUBS = [
  'RealGirls',
  'tightdresses',
  'bikinis',
  'SFWNextDoorGirls',
  'girlsinyogapants',
  'lingerie'
];

/**
 * Wraps any real model image URL into a Google SafeSearch-style Censored Teaser Card
 * blur=6 keeps the model's silhouette, skin tone & pose clearly recognizable while censoring details!
 */
function toSafeSearchBlurUrl(rawImgUrl, blurLevel = 6) {
  if (!rawImgUrl || typeof rawImgUrl !== 'string') return '';
  const clean = rawImgUrl.trim();
  if (clean.includes('wsrv.nl')) return clean;
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=960&h=540&fit=cover&a=attention&blur=${blurLevel}&con=12&bri=-5&output=jpg`;
}

/**
 * Converts RedGifs MP4 or Poster URL into a valid JPG Poster URL
 */
function extractRedgifsPoster(gifObj) {
  const poster = gifObj?.urls?.poster || gifObj?.urls?.thumbnail || gifObj?.urls?.vthumbnail;
  if (poster && poster.startsWith('http')) return poster;
  const mp4 = gifObj?.urls?.sd || gifObj?.urls?.hd || '';
  if (mp4.includes('redgifs.com') && mp4.split('?')[0].endsWith('.mp4')) {
    return mp4.replace('-mobile.mp4', '-poster.jpg').replace('.mp4', '-poster.jpg');
  }
  return null;
}

/**
 * Source 1: Official RedGifs V2 API (100% Reliable on GitHub Actions & Vercel — Real Amateur Models)
 */
async function fetchRedGifsModelPosters() {
  const results = [];
  try {
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' }
    });
    if (!authRes.ok) return results;
    const { token } = await authRes.json();
    if (!token) return results;

    const pickedQueries = [...REDGIFS_NICHE_QUERIES].sort(() => 0.5 - Math.random()).slice(0, 3);

    for (const q of pickedQueries) {
      const page = Math.floor(Math.random() * 3) + 1;
      const searchUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(q)}&order=trending&type=g&count=30&page=${page}`;
      const res = await fetch(searchUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0'
        }
      });
      if (!res.ok) continue;

      const data = await res.json();
      for (const g of data?.gifs || []) {
        const tags = (g?.tags || []).map((t) => String(t).toLowerCase());
        const desc = String(g?.description || '').toLowerCase();
        if (BANNED_WORDS.some((b) => tags.some((t) => t.includes(b)) || desc.includes(b))) continue;

        const posterUrl = extractRedgifsPoster(g);
        if (posterUrl) {
          // 80% SafeSearch Blurred Teaser Cards (blur=6), 20% Light Tease Blur (blur=4)
          const blurStrength = Math.random() < 0.8 ? 6 : 4;
          results.push(toSafeSearchBlurUrl(posterUrl, blurStrength));
        }
      }
    }
  } catch (err) {
    console.log('⚠️ RedGifs Poster fetch warning:', err.message);
  }
  return results;
}

/**
 * Source 2: Reddit Model Subreddits (Multi-Fallback Fetcher)
 */
async function fetchRedditModelImages() {
  const images = [];
  const pickedSubs = [...REDDIT_MODEL_SUBS].sort(() => 0.5 - Math.random()).slice(0, 3);

  for (const sub of pickedSubs) {
    const rawTarget = `https://www.reddit.com/r/${sub}/hot.json?limit=35&raw_json=1`;
    const endpoints = [
      rawTarget,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(rawTarget)}`,
      `https://corsproxy.io/?${encodeURIComponent(rawTarget)}`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: {
            'User-Agent': 'web:alcashx.bot.v9:v9.0 (by /u/alcashx_curator)',
            Accept: 'application/json'
          }
        });
        if (!res.ok) continue;
        const txt = await res.text();
        if (!txt.trim().startsWith('{')) continue;

        const json = JSON.parse(txt);
        const posts = json?.data?.children || [];
        for (const p of posts) {
          const item = p?.data;
          if (!item || !item.url) continue;
          const cleanUrl = item.url.split('?')[0];
          if (/\.(jpg|jpeg|png)$/i.test(cleanUrl) && !cleanUrl.includes('avatar')) {
            const blurAmt = item.over_18 ? 7 : 5;
            images.push(toSafeSearchBlurUrl(cleanUrl, blurAmt));
          }
        }
        if (images.length > 0) break;
      } catch (_) {}
    }
  }
  return images;
}

async function scrapeAll() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const configPath = path.join(dataDir, 'config.json');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  let config = {
    accounts: [],
    images: [],
    captions: [],
    replies: [],
    targets: [],
    mediaQueue: [],
    usedMedia: [],
    harvestedUsers: [],
    activityLog: [],
    settings: {
      autoSelfReply: true,
      crossAccountLike: true,
      crossAccountRetweet: true,
      crossAccountBookmark: true,
      maxAccountsPerRun: 2
    }
  };

  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch (_) {}
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.images)) config.images = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  const usedSet = new Set(config.usedMedia);

  // Strip old Unsplash stock images, Mixkit, Rule34, and already-used items
  const isJunkOrStock = (u) => {
    if (!u || typeof u !== 'string') return true;
    return (
      u.includes('images.unsplash.com') ||
      u.includes('mixkit.co') ||
      u.includes('aacdn.net') ||
      u.includes('rule34')
    );
  };

  config.images = config.images.filter((u) => !isJunkOrStock(u));

  // Normalize any existing raw RedGifs .mp4 in queue into SafeSearch Blurred Poster Cards
  config.mediaQueue = config.mediaQueue
    .filter((u) => !isJunkOrStock(u) && !usedSet.has(u))
    .map((u) => {
      if (u.includes('redgifs.com') && u.split('?')[0].endsWith('.mp4')) {
        const poster = u.replace('-mobile.mp4', '-poster.jpg').replace('.mp4', '-poster.jpg');
        return toSafeSearchBlurUrl(poster, 6);
      }
      return u;
    });

  const queueSet = new Set(config.mediaQueue);
  let addedCount = 0;

  // 1. First priority: User's Custom Uploaded / Vault Images (config.images)
  for (const customImg of config.images) {
    if (customImg && !usedSet.has(customImg) && !queueSet.has(customImg)) {
      config.mediaQueue.unshift(customImg); // Put custom images at the very front of the queue!
      queueSet.add(customImg);
      addedCount++;
    }
  }

  // 2. Fetch fresh RedGifs HD Model Posters + Reddit Model Images
  const [redgifsCards, redditCards] = await Promise.all([
    fetchRedGifsModelPosters(),
    fetchRedditModelImages()
  ]);

  console.log(
    `📡 Harvested ${redgifsCards.length} RedGifs HD Model Cards + ${redditCards.length} Reddit Glamour Cards`
  );

  const freshPool = [...redgifsCards, ...redditCards].sort(() => 0.5 - Math.random());

  for (const cardUrl of freshPool) {
    if (cardUrl && !usedSet.has(cardUrl) && !queueSet.has(cardUrl)) {
      config.mediaQueue.push(cardUrl);
      queueSet.add(cardUrl);
      addedCount++;
    }
  }

  config.mediaQueue = config.mediaQueue.slice(0, 400);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(
    `✅ Scraper v9.0 Complete! Added ${addedCount} SafeSearch Blurred Model Cards | Total Queue: ${config.mediaQueue.length}`
  );
  process.exit(0);
}

scrapeAll();


