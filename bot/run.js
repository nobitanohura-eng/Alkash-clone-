/**
 * AlcashX Cloud Pro — Fully Autonomous Self-Healing Twitter/X Bot (bot/run.js)
 * Features:
 *  - Auto-Refilling Adult Media Engine (Never runs out of videos/images)
 *  - Smart Account Rotation (Picks the account that waited the longest)
 *  - Anti-Ban Single-Account-Per-IP Mode (Default maxAccountsPerRun = 1)
 *  - Desktop Compose Modal + Direct URL Fallback (Zero Timeout Errors)
 *  - Native Video Upload + Auto-Self-Reply Money Link + Active @User Harvester
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// Built-in Evergreen High-Converting Backup MP4s & Images (If all APIs are blocked)
const EVERGREEN_MEDIA_POOL = [
  'https://assets.mixkit.co/videos/preview/mixkit-sensual-woman-posing-for-the-camera-42995-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-young-woman-looking-at-the-camera-in-a-room-41643-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-with-long-hair-posing-indoors-42993-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-40033-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-posing-in-neon-light-42994-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-posing-in-neon-light-39878-large.mp4',
  'https://i.ibb.co/BH7qych6/media-1793206956474-d4ed18e8.webp',
  'https://i.ibb.co/DHTmNvdT/media-1793206955998-ba56aac0.jpg'
];

function spin(text) {
  if (!text) return '';
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickMultipleRandom(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (minSec, maxSec) =>
  sleep((Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000);

// ============================================================================
// SELF-HEALING MEDIA REFILLER (Runs automatically if mediaQueue gets low)
// ============================================================================
async function ensureMediaQueueFilled(config) {
  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  if (config.mediaQueue.length >= 5) {
    return; // Queue has plenty of items
  }

  console.log('⚡ Media Queue is low (< 5). Triggering built-in Auto-Refill Engine...');

  // 1. Try RedGifs Trending Adult Clips API
  try {
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (authRes.ok) {
      const { token } = await authRes.json();
      if (token) {
        const tags = ['amateur', 'tiktok', 'bhabhi', 'desi', 'twerk', 'tease', 'curves'];
        const q = pickRandom(tags);
        const sRes = await fetch(
          `https://api.redgifs.com/v2/gifs/search?search_text=${q}&order=trending&count=25`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
          }
        );
        if (sRes.ok) {
          const sData = await sRes.json();
          for (const g of sData?.gifs || []) {
            const mediaUrl = g?.urls?.sd || g?.urls?.hd || g?.urls?.poster;
            if (mediaUrl && !config.usedMedia.includes(mediaUrl) && !config.mediaQueue.includes(mediaUrl)) {
              config.mediaQueue.push(mediaUrl);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ RedGifs auto-refill skipped:', e.message);
  }

  // 2. Try Unblockable Adult JSON API if still low
  if (config.mediaQueue.length < 5) {
    try {
      const r34Res = await fetch(
        'https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&limit=30&json=1&tags=video+animated',
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }
      );
      if (r34Res.ok) {
        const items = await r34Res.json();
        if (Array.isArray(items)) {
          for (const it of items) {
            if (
              it?.file_url &&
              /\.(mp4|jpg|jpeg|png|gif)$/i.test(it.file_url) &&
              !config.usedMedia.includes(it.file_url) &&
              !config.mediaQueue.includes(it.file_url)
            ) {
              config.mediaQueue.push(it.file_url);
            }
          }
        }
      }
    } catch (_) {}
  }

  // 3. Merge User's Custom Fallback Images/Videos from Admin Panel
  if (Array.isArray(config.images)) {
    for (const raw of config.images) {
      if (!raw || raw === 'xYz987A') continue;
      const fullUrl = raw.startsWith('http')
        ? raw
        : `https://i.imgur.com/${raw.replace(/\.(jpg|png|gif|jpeg|mp4)$/i, '')}.jpg`;
      if (!config.mediaQueue.includes(fullUrl)) {
        config.mediaQueue.push(fullUrl);
      }
    }
  }

  // 4. Ultimate Guarantee: Refill from Evergreen Pool if still empty
  if (config.mediaQueue.length === 0) {
    for (const url of EVERGREEN_MEDIA_POOL) {
      config.mediaQueue.push(url);
    }
  }

  console.log(`✅ Auto-Refill Complete! Queue size: ${config.mediaQueue.length}`);
}

// ============================================================================
// DOWNLOAD MEDIA LOCALLY FOR NATIVE TWITTER UPLOAD
// ============================================================================
async function downloadMedia(url) {
  try {
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.endsWith('.mp4')
      ? '.mp4'
      : cleanUrl.endsWith('.gif')
      ? '.gif'
      : '.jpg';
    const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}${ext}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Referer: 'https://www.reddit.com/'
      }
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    // Skip files smaller than 5KB (broken links) or larger than 45MB (Twitter upload timeout risk)
    if (buffer.byteLength < 5000 || buffer.byteLength > 45 * 1024 * 1024) return null;
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    return tempPath;
  } catch (e) {
    console.log('⚠️ Media download skipped:', e.message);
    return null;
  }
}

// ============================================================================
// ROBUST COMPOSE BOX OPENER (Handles Home Inline, Sidebar Modal & Direct URL)
// ============================================================================
async function openComposeEditor(page) {
  // Attempt 1: Check if inline compose box on /home is already visible
  const inlineEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
  if (await inlineEditor.isVisible().catch(() => false)) {
    await inlineEditor.click();
    return inlineEditor;
  }

  // Attempt 2: Click Desktop Left-Sidebar "Post" Button to open Modal
  const sidePostBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
  if (await sidePostBtn.isVisible().catch(() => false)) {
    console.log('🔘 Clicking Sidebar Post Button...');
    await sidePostBtn.click();
    await randomSleep(2, 4);
    if (await inlineEditor.isVisible().catch(() => false)) {
      await inlineEditor.click();
      return inlineEditor;
    }
  }

  // Attempt 3: Direct navigation to /compose/post fallback
  console.log('🔄 Navigating directly to https://x.com/compose/post...');
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await randomSleep(4, 6);
  await inlineEditor.waitFor({ state: 'visible', timeout: 20000 });
  await inlineEditor.click();
  return inlineEditor;
}

// ============================================================================
// MAIN AUTONOMOUS BOT RUNNER
// ============================================================================
async function runBot() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const configPath = path.join(dataDir, 'config.json');

  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(configPath)) {
    console.log('⚠️ data/config.json not found! Creating default config...');
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
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
            crossAccountLike: false,
            crossAccountRetweet: false,
            crossAccountBookmark: false,
            maxAccountsPerRun: 1
          }
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  // 1. Ensure Media Queue is always stocked automatically
  await ensureMediaQueueFilled(config);

  const activeAccounts = (config.accounts || []).filter(
    (a) => a.status === 'active' && a.auth_token && a.ct0
  );

  if (activeAccounts.length === 0) {
    console.log('⚠️ No active Twitter accounts found in data/config.json.');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    process.exit(0);
  }

  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  // Default High-Converting Spintax Pools (Works out-of-the-box even if Admin boxes are empty)
  const defaultCaptions = [
    '{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {again ✌️🐆|tonight 😈|🙊|👀}',
    "{Wait for the end|Don't pause at 0:02|Did I show too much?|Deleting this in 10 mins} {😳|🤫|💦|🔥}",
    "{can't sleep, who's still up? 🌙|am I your type? be honest 👀|would you say hi back? <3}",
    '{My camera roll is dangerous|Too risky for X?|Should I post part 2?} {🙊|😈|🔥|👇}'
  ];
  const defaultReplies = [
    '{Full uncensored video|Watch what happened next|The rest of this clip is too spicy for X} {👇|😈|💦} {{LINK}}',
    "{X deleted the full 2 min video|Couldn't post the uncut version here}, watch it free on my VIP page 👉 {{LINK}} 🔥"
  ];
  const defaultTargets = ['#nsfwtwt', '#thirsttrap', '#desimms', 'caught me being cute', 'who is up'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  // 2. SMART ROTATION: Sort accounts by oldest `lastRunAt` first so every account gets fair turns
  const sortedAccounts = [...activeAccounts].sort((a, b) => {
    const timeA = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const timeB = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    return timeA - timeB;
  });

  // Safe Default: Run 1 account per GitHub IP session unless user explicitly increased it
  const maxAccounts = Math.min(
    sortedAccounts.length,
    Math.max(1, parseInt(config.settings?.maxAccountsPerRun || 1, 10))
  );
  const accountsToRun = sortedAccounts.slice(0, maxAccounts);

  console.log(
    `🚀 Autonomous Bot Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
  );

  const postedTweetUrls = [];

  for (const acc of accountsToRun) {
    console.log(`\n👤 Processing Account: ${acc.username}`);

    // Mark timestamp on the original config.accounts object for rotation tracking
    const masterAcc = config.accounts.find((x) => x.username === acc.username);
    if (masterAcc) {
      masterAcc.lastRunAt = new Date().toISOString();
    }

    const launchArgs = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    };
    if (acc.proxy && acc.proxy.trim() !== '') {
      launchArgs.proxy = { server: acc.proxy.trim() };
    }

    const browser = await chromium.launch(launchArgs);
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    });

    // Mask Playwright automation fingerprint
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    await context.addCookies([
      {
        name: 'auth_token',
        value: acc.auth_token.trim(),
        domain: '.x.com',
        path: '/',
        httpOnly: true,
        secure: true
      },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true },
      {
        name: 'auth_token',
        value: acc.auth_token.trim(),
        domain: '.twitter.com',
        path: '/',
        httpOnly: true,
        secure: true
      },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.twitter.com', path: '/', secure: true }
    ]);

    const page = await context.newPage();
    let localMediaPath = null;

    try {
      // STEP A: Open X Home & Verify Session Health
      console.log('🌐 Checking X session...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 8);

      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/i/flow/login') ||
        currentUrl.includes('/account/access')
      ) {
        console.log(
          `❌ Account ${acc.username} session expired or locked (Redirected to: ${currentUrl}).`
        );
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        continue;
      }

      // STEP B: Pick & Download Media from Auto-Refilling Queue
      let mediaItem = null;
      let attempts = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && attempts < 6) {
        attempts++;
        const candidate = config.mediaQueue.shift();
        localMediaPath = await downloadMedia(candidate);
        if (localMediaPath) {
          mediaItem = candidate;
          config.usedMedia.push(mediaItem);
        }
      }

      // Fallback to guaranteed high-speed CDN image if all video downloads timed out
      if (!mediaItem) {
        mediaItem = pickRandom(EVERGREEN_MEDIA_POOL);
        localMediaPath = await downloadMedia(mediaItem);
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(
        mediaItem
      )}&t=${Date.now().toString().slice(-4)}`;

      const hashtagsOnly = targetsPool.filter((t) => t.startsWith('#'));
      const selectedTags = pickMultipleRandom(
        hashtagsOnly.length ? hashtagsOnly : ['#nsfwtwt', '#thirsttrap'],
        2
      ).join(' ');
      const caption = spin(pickRandom(captionsPool));
      const fullMainTweet = [caption, selectedTags].filter(Boolean).join('\n\n');

      // STEP C: Open Compose Editor & Upload Native Video/Image
      const editor = await openComposeEditor(page);

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(localMediaPath);
        console.log('⏳ Waiting for X media processing...');
        await randomSleep(10, 16);
        await editor.click();
        await editor.fill(fullMainTweet);
      } else {
        await editor.click();
        await editor.fill(`${fullMainTweet}\n\n${cloakedLink}`);
      }

      await randomSleep(3, 5);
      const postBtn = page
        .locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]')
        .first();
      await postBtn.click();
      console.log(`✅ Main Post Published by ${acc.username}!`);
      if (masterAcc) masterAcc.lastStatus = '✅ Active & Posting';
      await randomSleep(8, 12);

      // STEP D: Open Profile & Post Auto-Self-Reply with Money Link + Active @User Mentions
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await randomSleep(5, 8);

      const latestTweetHref = await page
        .locator(`article[data-testid="tweet"] a[href*="/status/"]`)
        .first()
        .getAttribute('href')
        .catch(() => null);

      if (latestTweetHref) {
        const fullTweetUrl = `https://x.com${latestTweetHref}`;
        postedTweetUrls.push({ url: fullTweetUrl, author: acc.username });

        if (config.settings?.autoSelfReply !== false) {
          console.log(`🔗 Opening latest post for Self-Reply: ${fullTweetUrl}`);
          await page.goto(fullTweetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await randomSleep(4, 7);

          let replyMsg = spin(pickRandom(repliesPool));
          replyMsg = replyMsg.includes('{{LINK}}')
            ? replyMsg.replace('{{LINK}}', cloakedLink)
            : `${replyMsg} ${cloakedLink}`;

          // Tag 1-2 active harvested users in the reply comment so they get notified directly on the Money Link!
          const replyMentions = pickMultipleRandom(config.harvestedUsers, 2).join(' ');
          if (replyMentions) {
            replyMsg = `${replyMsg}\n\n👀 ${replyMentions}`;
          }

          const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyBox.isVisible().catch(() => false)) {
            await replyBox.click();
            await replyBox.fill(replyMsg);
            await randomSleep(3, 5);
            await page
              .locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]')
              .first()
              .click();
            console.log(`💬 Self-Reply + Money Link + Mentions posted!`);
            await randomSleep(5, 8);
          }
        }
      }

      // STEP E: Harvest Fresh Active @Users & Like 1 Live Post (Organic Activity)
      const searchKeywords = targetsPool.filter((t) => !t.startsWith('@'));
      const searchQuery = pickRandom(searchKeywords) || '#nsfwtwt';
      console.log(`🔍 Harvesting active @users from live search: "${searchQuery}"`);

      await page.goto(
        `https://x.com/search?q=${encodeURIComponent(searchQuery)}&f=live`,
        { waitUntil: 'domcontentloaded', timeout: 40000 }
      );
      await randomSleep(5, 7);

      const userLinks = await page
        .locator('article[data-testid="tweet"] a[href^="/"]')
        .evaluateAll((els) =>
          els
            .map((el) => el.getAttribute('href'))
            .filter((h) => h && /^\/[a-zA-Z0-9_]{3,15}$/.test(h))
        )
        .catch(() => []);

      const ownHandleLower = `@${cleanHandle.toLowerCase()}`;
      const systemRoutes = ['/home', '/explore', '/notifications', '/messages', '/settings', '/search'];
      let newHarvestCount = 0;

      for (const link of userLinks) {
        if (systemRoutes.includes(link.toLowerCase())) continue;
        const handle = `@${link.replace('/', '')}`;
        if (
          handle.toLowerCase() !== ownHandleLower &&
          !config.harvestedUsers.includes(handle)
        ) {
          config.harvestedUsers.push(handle);
          newHarvestCount++;
        }
      }
      config.harvestedUsers = config.harvestedUsers.slice(-150);
      console.log(
        `🎯 Harvested ${newHarvestCount} new @users (Total Pool: ${config.harvestedUsers.length})`
      );

      // Like 1st active post to attract profile visits
      const firstLiveTweet = page.locator('article[data-testid="tweet"]').first();
      if (await firstLiveTweet.isVisible().catch(() => false)) {
        const likeBtn = firstLiveTweet.locator('[data-testid="like"]').first();
        if (await likeBtn.isVisible().catch(() => false)) {
          await likeBtn.click().catch(() => {});
          console.log('❤️ Liked 1 active post in feed');
          await randomSleep(2, 4);
        }
      }
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
    } finally {
      if (localMediaPath && fs.existsSync(localMediaPath)) {
        try {
          fs.unlinkSync(localMediaPath);
        } catch (_) {}
      }
      await browser.close();
    }

    // Save progress after each account
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(6, 12);
  }

  console.log('\n🎉 Autonomous Bot Run Completed & Saved to data/config.json!');
}

runBot();
