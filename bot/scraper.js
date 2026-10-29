/**
 * File: bot/scraper.js
 * AlcashX Cloud Pro v5.0 — "No-Blur" Leaked & Thirst-Trap Micro-Video Scraper
 * Specifically targets short (4s-16s) teasing/leaked-style clips that bypass X's AI blur filter!
 */

import fs from 'fs';
import path from 'path';

// High-Curiosity "No-Blur" Teaser & Leaked Keywords (Passes X Vision AI without getting blurred!)
const NO_BLUR_TRAP_NICHES = [
  'tiktok tease',
  'caught on camera',
  'trying on dress',
  'shirt lift tease',
  'mirror bounce',
  'girlfriend tease',
  'college dorm',
  'desi saree tease',
  'bhabhi tease',
  'pajama tease',
  'twerk shorts',
  'bikini try on'
];

// Subreddits famous for unblurred viral thirst-traps & micro-videos
const THIRST_TRAP_SUBREDDITS = [
  'TikTokThots',
  'SFWNextDoorGirls',
  'BustyPetite',
  'RealGirls',
  'IndianBabes',
  'DesiBoners',
  'girlsinyogapants',
  'tightdresses'
];

// Block hardcore/explicit keywords in tags so X's AI never auto-blurs the video!
const BLUR_TRIGGER_WORDS = [
  'jerkmate', 'chaturbate', 'stripchat', 'bonga', 'cam4', 'ad', 'promo',
  'hentai', 'anime', '3d', 'sfm', 'cartoon', 'animated', 'rule34', 'furry',
  'gay', 'trans', 'shemale', 'femboy', 'cuck', 'compilation',
  'blowjob', 'anal', 'cumshot', 'creampie', 'gangbang', 'penetration', 'hardcore', 'dildo', 'fucked'
];

function isUnblurredViralClip(gif) {
  if (!gif || !gif.urls) return false;
  // Micro-videos (4s to 16s) loop 5x faster on X and rarely contain hardcore mid-video nudity!
  if (gif.duration && (gif.duration < 3.5 || gif.duration > 18)) return false;

  const tags = (gif.tags || []).map((t) => String(t).toLowerCase());
  const desc = String(gif.description || '').toLowerCase();

  for (const bad of BLUR_TRIGGER_WORDS) {
    if (tags.some((t) => t.includes(bad)) || desc.includes(bad)) {
      return false;
    }
  }
  return true;
}

async function fetchUnblurredRedgifsMp4s() {
  const urls = [];
  try {
    console.log('🔑 Requesting Official RedGifs OAuth Token...');
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36'
      }
    });

    if (authRes.ok) {
      const { token } = await authRes.json();
      if (token) {
        const pickedNiches = [...NO_BLUR_TRAP_NICHES].sort(() => 0.5 - Math.random()).slice(0, 4);

        for (const query of pickedNiches) {
          const pageNum = Math.floor(Math.random() * 3) + 1;
          const searchUrl = `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(
            query
          )}&order=trending&type=g&count=40&page=${pageNum}`;

          const res = await fetch(searchUrl, {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0 Safari/537.36'
            }
          });

          if (res.ok) {
            const data = await res.json();
            for (const gif of data?.gifs || []) {
              if (!isUnblurredViralClip(gif)) continue;
              const mp4Url = gif?.urls?.sd || gif?.urls?.hd;
              if (mp4Url && mp4Url.split('?')[0].endsWith('.mp4')) {
                urls.push(mp4Url);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ RedGifs API warning:', e.message);
  }
  return urls;
}

async function fetchRedditThirstTrapMp4s() {
  const urls = [];
  const pickedSubs = [...THIRST_TRAP_SUBREDDITS].sort(() => 0.5 - Math.random()).slice(0, 4);

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
          if (!item) continue;
          const titleLower = String(item.title || '').toLowerCase();
          if (BLUR_TRIGGER_WORDS.some((b) => titleLower.includes(b))) continue;

          if (item.is_video && item.media?.reddit_video?.fallback_url) {
            urls.push(item.media.reddit_video.fallback_url.split('?')[0]);
          } else if (item.preview?.reddit_video_preview?.fallback_url) {
            urls.push(item.preview.reddit_video_preview.fallback_url.split('?')[0]);
          }
        }
        if (urls.length > 0) break;
      } catch (_) {}
    }
  }
  return urls;
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

  config.mediaQueue = config.mediaQueue.filter((u) => {
    if (!u || typeof u !== 'string') return false;
    const clean = u.toLowerCase().split('?')[0];
    if (u.includes('aacdn.net') || u.includes('rule34') || u.includes('mixkit.co')) return false;
    if (!clean.endsWith('.mp4')) return false;
    return !usedSet.has(u);
  });

  const queueSet = new Set(config.mediaQueue);
  let addedCount = 0;

  // Prioritize Reddit SFW/Tease Thirst-Traps first (0% Blur Rate!) + RedGifs Micro-Teasers
  const redditUrls = await fetchRedditThirstTrapMp4s();
  console.log(`📡 Reddit Unblurred Thirst-Trap MP4s: found ${redditUrls.length} videos`);

  const rgUrls = await fetchUnblurredRedgifsMp4s();
  console.log(`📡 RedGifs Micro-Teaser MP4s: found ${rgUrls.length} videos`);

  const allCandidates = [...redditUrls, ...rgUrls].sort(() => 0.5 - Math.random());

  for (const url of allCandidates) {
    if (!usedSet.has(url) && !queueSet.has(url)) {
      config.mediaQueue.push(url);
      queueSet.add(url);
      addedCount++;
    }
  }

  config.mediaQueue = config.mediaQueue.slice(0, 350);
  if (config.usedMedia.length > 2500) {
    config.usedMedia = config.usedMedia.slice(-2500);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(
    `✅ Scraper v5.0 Complete! Added ${addedCount} No-Blur Teaser MP4s | Queue: ${config.mediaQueue.length}`
  );
  process.exit(0);
}

scrapeAll();
