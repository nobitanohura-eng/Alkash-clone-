import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const TARGET_URL = 'https://getredgifs.com/trending';

// 1. Fast HTML Fetch + Regex Extractor from https://getredgifs.com/trending
async function scrapeGetRedgifsFast() {
  const urls = new Set();
  try {
    console.log(`🌐 Fetching ${TARGET_URL} ...`);
    const res = await fetch(TARGET_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (res.ok) {
      const html = await res.text();

      // Match direct MP4 / WebM / GIF / Poster URLs inside HTML or JSON hydration data
      const mediaMatches =
        html.match(/https?:\/\/[^\s"'<>\\]+\.(?:mp4|gif|jpg|jpeg|png)/gi) || [];

      for (const rawUrl of mediaMatches) {
        const clean = rawUrl.replace(/\\u002F/g, '/').replace(/\\/g, '');
        // Filter out tiny icons, logos, or site assets
        if (
          !clean.includes('favicon') &&
          !clean.includes('logo') &&
          !clean.includes('avatar') &&
          (clean.includes('redgifs') ||
            clean.includes('thumbs') ||
            clean.includes('media') ||
            clean.includes('cdn') ||
            clean.endsWith('.mp4'))
        ) {
          urls.add(clean);
        }
      }
    }
  } catch (err) {
    console.log('⚠️ Fast fetch on getredgifs.com failed:', err.message);
  }
  return [...urls];
}

// 2. Playwright Headless Browser Scraper for https://getredgifs.com/trending (Handles JS-rendered videos)
async function scrapeGetRedgifsBrowser() {
  const urls = new Set();
  let browser = null;
  try {
    console.log(`🎭 Launching Headless Browser to extract videos from ${TARGET_URL} ...`);
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // Intercept network requests to catch any direct .mp4 or API video streams automatically
    page.on('response', async (response) => {
      const reqUrl = response.url();
      if (/\.mp4(\?|$)/i.test(reqUrl) && !reqUrl.includes('logo')) {
        urls.add(reqUrl.split('?')[0]);
      }
    });

    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);

    // Scroll down to trigger lazy-loaded trending videos
    await page.evaluate(() => window.scrollBy(0, 2500));
    await page.waitForTimeout(3000);

    // Extract all <video src>, <source src>, data-src, and high-res poster/gif links
    const domUrls = await page.evaluate(() => {
      const collected = [];
      document.querySelectorAll('video, source, a, img').forEach((el) => {
        const candidates = [
          el.src,
          el.getAttribute('data-src'),
          el.getAttribute('data-video'),
          el.getAttribute('data-mp4'),
          el.getAttribute('poster'),
          el.href
        ];
        for (const c of candidates) {
          if (c && /^https?:\/\/.+\.(mp4|gif|jpg|jpeg|png)(\?.*)?$/i.test(c)) {
            collected.push(c.split('?')[0]);
          }
        }
      });
      return collected;
    });

    for (const u of domUrls) {
      if (!u.includes('logo') && !u.includes('favicon') && !u.includes('icon')) {
        urls.add(u);
      }
    }
  } catch (err) {
    console.log('⚠️ Browser scraper warning:', err.message);
  } finally {
    if (browser) await browser.close();
  }

  // Prioritize .mp4 videos first, then images/gifs
  const all = [...urls];
  const mp4s = all.filter((u) => u.endsWith('.mp4'));
  const others = all.filter((u) => !u.endsWith('.mp4'));
  return [...mp4s, ...others];
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
    settings: {
      autoSelfReply: true,
      crossAccountLike: true,
      crossAccountRetweet: true,
      crossAccountBookmark: true,
      maxAccountsPerRun: 5
    }
  };

  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
    } catch (_) {}
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  let addedCount = 0;

  // Step 1: Fast HTML Scrape from getredgifs.com/trending
  let scrapedUrls = await scrapeGetRedgifsFast();
  console.log(`📡 Fast HTML Scrape (getredgifs.com/trending): found ${scrapedUrls.length} items`);

  // Step 2: If fast HTML found fewer than 5 MP4s (due to JS rendering), use Playwright Browser Scraper
  const mp4Count = scrapedUrls.filter((u) => u.endsWith('.mp4')).length;
  if (mp4Count < 5) {
    const browserUrls = await scrapeGetRedgifsBrowser();
    console.log(
      `📡 Browser DOM Scrape (getredgifs.com/trending): found ${browserUrls.length} items`
    );
    scrapedUrls = [...new Set([...browserUrls, ...scrapedUrls])];
  }

  for (const u of scrapedUrls) {
    if (!config.usedMedia.includes(u) && !config.mediaQueue.includes(u)) {
      config.mediaQueue.push(u);
      addedCount++;
    }
  }

  // Step 3: Also include any manual URLs from Admin Panel (config.images)
  if (Array.isArray(config.images) && config.images.length > 0) {
    for (const raw of config.images) {
      if (!raw || raw === 'xYz987A') continue;
      const url = raw.startsWith('http')
        ? raw
        : `https://i.imgur.com/${raw.replace(/\.(jpg|png|gif|jpeg|mp4)$/i, '')}.jpg`;
      if (!config.mediaQueue.includes(url) && !config.usedMedia.includes(url)) {
        config.mediaQueue.push(url);
        addedCount++;
      }
    }
  }

  config.mediaQueue = config.mediaQueue.slice(0, 400);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(
    `✅ Scraper Complete! Newly Added: ${addedCount} | Total in Queue: ${config.mediaQueue.length}`
  );
  process.exit(0);
}

scrapeAll();
