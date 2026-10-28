import fs from 'fs';
import path from 'path';

const SUBREDDITS = ['TikTokThots', 'gonewild', 'RealGirls', 'nsfw_gifs', 'booty', 'curves', 'BreedingMaterial'];

// 1. Fetch Reddit via Public JSON Proxy (Bypasses GitHub IP 403 Block)
async function fetchRedditViaProxy(sub) {
  const urls = [];
  const targetUrl = `https://old.reddit.com/r/${sub}/hot.json?limit=35&raw_json=1`;
  const endpoints = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    targetUrl
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        }
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith('{')) continue;

      const data = JSON.parse(text);
      const posts = data?.data?.children || [];
      for (const p of posts) {
        const item = p.data;
        if (!item) continue;
        // Direct Reddit MP4
        if (item.is_video && item.media?.reddit_video?.fallback_url) {
          urls.push(item.media.reddit_video.fallback_url.split('?')[0]);
        } else if (item.preview?.reddit_video_preview?.fallback_url) {
          urls.push(item.preview.reddit_video_preview.fallback_url.split('?')[0]);
        } else if (item.url && /\.(jpg|jpeg|png|gif|mp4)$/i.test(item.url.split('?')[0])) {
          urls.push(item.url.split('?')[0]);
        }
      }
      if (urls.length > 0) break;
    } catch (_) {}
  }
  return urls;
}

// 2. Fetch Explicit Adult Videos/GIFs from RedGifs API
async function fetchRedgifsAdultClips() {
  const urls = [];
  try {
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (authRes.ok) {
      const { token } = await authRes.json();
      if (token) {
        const queries = ['amateur', 'tiktok', 'bhabhi', 'desi', 'twerk', 'tease'];
        const q = queries[Math.floor(Math.random() * queries.length)];
        const searchRes = await fetch(`https://api.redgifs.com/v2/gifs/search?search_text=${q}&order=trending&count=30`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        if (searchRes.ok) {
          const sData = await searchRes.json();
          for (const g of (sData?.gifs || [])) {
            if (g?.urls?.sd) urls.push(g.urls.sd);
            else if (g?.urls?.hd) urls.push(g.urls.hd);
            else if (g?.urls?.poster) urls.push(g.urls.poster);
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ RedGifs direct fetch skipped:', e.message);
  }
  return urls;
}

// 3. Unblockable Adult Booru API (Never blocks GitHub Actions IPs - Returns Direct MP4/JPG/GIF)
async function fetchUnblockableAdultMedia() {
  const urls = [];
  try {
    const apiEndpoints = [
      'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&limit=40&json=1&tags=video+animated',
      'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&limit=40&json=1&tags=female+solo'
    ];
    for (const ep of apiEndpoints) {
      const res = await fetch(ep, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (!res.ok) continue;
      const items = await res.json();
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item?.file_url && /\.(mp4|jpg|jpeg|png|gif)$/i.test(item.file_url)) {
            urls.push(item.file_url);
          }
        }
      }
    }
  } catch (_) {}
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
    settings: { autoSelfReply: true, crossAccountLike: true, crossAccountRetweet: true, crossAccountBookmark: true, maxAccountsPerRun: 5 }
  };

  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch (_) {}
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  let addedCount = 0;

  // Source A: RedGifs Explicit MP4s
  const rgUrls = await fetchRedgifsAdultClips();
  console.log(`📡 RedGifs Adult API: fetched ${rgUrls.length} items`);
  for (const u of rgUrls) {
    if (!config.usedMedia.includes(u) && !config.mediaQueue.includes(u)) {
      config.mediaQueue.push(u);
      addedCount++;
    }
  }

  // Source B: Reddit NSFW Subreddits via Proxy
  for (const sub of SUBREDDITS) {
    const rUrls = await fetchRedditViaProxy(sub);
    console.log(`📡 r/${sub} (Proxy): fetched ${rUrls.length} items`);
    for (const u of rUrls) {
      if (!config.usedMedia.includes(u) && !config.mediaQueue.includes(u)) {
        config.mediaQueue.push(u);
        addedCount++;
      }
    }
    if (addedCount >= 40) break;
  }

  // Source C: Unblockable Adult JSON API (If Reddit & RedGifs both blocked)
  if (config.mediaQueue.length < 10) {
    const booruUrls = await fetchUnblockableAdultMedia();
    console.log(`📡 Unblockable Adult Booru API: fetched ${booruUrls.length} items`);
    for (const u of booruUrls) {
      if (!config.usedMedia.includes(u) && !config.mediaQueue.includes(u)) {
        config.mediaQueue.push(u);
        addedCount++;
      }
    }
  }

  // Source D: User's Custom Fallback Images/Videos
  if (Array.isArray(config.images) && config.images.length > 0) {
    for (const raw of config.images) {
      const url = raw.startsWith('http') ? raw : `https://i.imgur.com/${raw.replace(/\.(jpg|png|gif|jpeg|mp4)$/i, '')}.jpg`;
      if (!config.mediaQueue.includes(url) && !config.usedMedia.includes(url)) {
        config.mediaQueue.push(url);
        addedCount++;
      }
    }
  }

  config.mediaQueue = config.mediaQueue.slice(0, 400);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`✅ Scraper Complete! Newly Added: ${addedCount} | Total in Queue: ${config.mediaQueue.length}`);
  process.exit(0);
}

scrapeAll();
