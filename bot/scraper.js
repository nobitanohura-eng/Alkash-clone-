import fs from 'fs';

// Top Reddit sources for thirst-traps, micro-videos & explicit teasers
const SUBREDDITS = ['TikTokThots', 'SFWNextDoorGirls', 'RealGirls', 'gonewild', 'booty'];

async function scrapeReddit() {
  const configPath = './data/config.json';
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  
  if (!config.mediaQueue) config.mediaQueue = [];
  if (!config.usedMedia) config.usedMedia = [];

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=25`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const item = post.data;
        let mediaUrl = null;

        // Fetch Direct MP4 Video or JPG/PNG Image
        if (item.is_video && item.media?.reddit_video?.fallback_url) {
          mediaUrl = item.media.reddit_video.fallback_url.split('?')[0];
        } else if (item.url && (item.url.endsWith('.jpg') || item.url.endsWith('.png') || item.url.endsWith('.gif'))) {
          mediaUrl = item.url;
        }

        // Save if unique
        if (mediaUrl && !config.usedMedia.includes(mediaUrl) && !config.mediaQueue.includes(mediaUrl)) {
          config.mediaQueue.push(mediaUrl);
        }
      }
    } catch (err) {
      console.log(`Error scraping ${sub}:`, err.message);
    }
  }

  // Keep queue clean (max 500 items)
  config.mediaQueue = config.mediaQueue.slice(0, 500);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Scraper finished! Total items in queue: ${config.mediaQueue.length}`);
}

scrapeReddit();
