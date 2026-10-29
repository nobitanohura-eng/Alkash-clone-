/**
 * File: bot/scraper.js
 * AlcashX Cloud Pro v7.0 — High-Reach SFW/Tease Image & Pre-Blurred Card Scraper
 * Fetches clean glamour/selfie images from Reddit & Imgur and prepares both:
 *  1. Clean Teaser Images (For 100% Unblurred Organic X Reach)
 *  2. Pre-Blurred Censor Images (via wsrv.nl optical blur so X AI never flags nudity!)
 */

import fs from 'fs';
import path from 'path';

// 100% Safe-For-Algorithm Subreddits (High lust/curiosity, ZERO hardcore nudity = Massive X Reach!)
const HIGH_REACH_IMAGE_SUBS = [
  'SFWNextDoorGirls',
  'tightdresses',
  'girlsinyogapants',
  'bikinis',
  'RealGirls',
  'selfie',
  'AmIHot',
  'Faces'
];

// Curated High-Converting Imgur / CDN Glamour Teaser Fallback Pool
const CURATED_GLAMOUR_IMAGES = [
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=900&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=900&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=900&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=900&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=900&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=900&q=80'
];

// Converts any raw image URL into a custom Pre-Blurred Teaser Image URL (100% Safe from X AI!)
function makePreBlurredUrl(rawImgUrl, blurLevel = 12) {
  return `https://wsrv.nl/?url=${encodeURIComponent(rawImgUrl)}&w=900&h=500&fit=cover&blur=${blurLevel}&output=jpg`;
}

async function fetchRedditGlamourImages() {
  const images = [];
  const pickedSubs = [...HIGH_REACH_IMAGE_SUBS].sort(() => 0.5 - Math.random()).slice(0, 4);

  for (const sub of pickedSubs) {
    const rawTarget = `https://old.reddit.com/r/${sub}/hot.json?limit=40&raw_json=1`;
    const endpoints = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(rawTarget)}`,
      `https://corsproxy.io/?${encodeURIComponent(rawTarget)}`
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' }
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
            // If the post came from an 18+ subreddit (over_18), auto-apply our custom Safe Pre-Blur!
            if (item.over_18) {
              images.push(makePreBlurredUrl(cleanUrl, 14));
            } else {
              // Mix 50% crystal-clear SFW glamour + 50% teasing pre-blurred mystery cards!
              if (Math.random() < 0.45) {
                images.push(makePreBlurredUrl(cleanUrl, 10));
              } else {
                images.push(cleanUrl);
              }
            }
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
      crossAccountBookmark: false,
      maxAccountsPerRun: 2
    }
  };

  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch (_) {}
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  const usedSet = new Set(config.usedMedia);

  // Purge old .mp4 videos so queue only holds high-reach Images & Pre-Blurred Cards
  config.mediaQueue = config.mediaQueue.filter((u) => {
    if (!u || typeof u !== 'string') return false;
    if (u.endsWith('.mp4') || u.includes('redgifs.com') || u.includes('aacdn.net')) return false;
    return !usedSet.has(u);
  });

  const queueSet = new Set(config.mediaQueue);
  let addedCount = 0;

  const redditImgs = await fetchRedditGlamourImages();
  console.log(`📡 Fetched ${redditImgs.length} High-Reach SFW & Pre-Blurred Images from Reddit`);

  const allCandidates = [...redditImgs, ...CURATED_GLAMOUR_IMAGES].sort(() => 0.5 - Math.random());

  for (const imgUrl of allCandidates) {
    if (!usedSet.has(imgUrl) && !queueSet.has(imgUrl)) {
      config.mediaQueue.push(imgUrl);
      queueSet.add(imgUrl);
      addedCount++;
    }
  }

  config.mediaQueue = config.mediaQueue.slice(0, 350);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(
    `✅ Scraper v7.0 Complete! Added ${addedCount} Clean/Pre-Blurred Images | Total Queue: ${config.mediaQueue.length}`
  );
  process.exit(0);
}

scrapeAll();

