/**
 * AlcashX Cloud Pro — Autonomous Anti-Suspension Twitter/X Bot (bot/run.js)
 * Upgraded:
 *  - Deep Webpage + RedGifs/Imgur Video & Image Scraper inside downloadMedia()
 *  - Uses both config.mediaQueue AND config.images (Fallback MP4 URLs)
 *  - Validates Content-Type so HTML pages are never saved as corrupted .jpg/.mp4
 *  - Native Video/Photo Upload on Main Tweet + Cloaked Link strictly in Self-Reply
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

function spin(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const optionsList = group.split('|');
    return optionsList[Math.floor(Math.random() * optionsList.length)];
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

async function publishTweetSafely(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  for (let i = 0; i < 20; i++) {
    const isDisabled = await page
      .locator(buttonSelector)
      .first()
      .getAttribute('aria-disabled')
      .catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(1000);
  }

  try {
    await page.keyboard.press('Control+Enter');
    await sleep(3000);
  } catch (_) {}

  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(3000);
    } catch (_) {}
  }

  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 8000 });
    } catch (_) {}
  }
}

// Smart Media Scraper + Downloader (Handles Direct MP4/JPG, Imgur IDs, RedGifs & Webpages)
async function downloadMedia(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let url = rawUrl.trim();

    // Convert bare Imgur ID or Imgur gallery URL to direct link
    if (!url.startsWith('http')) {
      url = `https://i.imgur.com/${url}.mp4`;
    } else if (url.includes('imgur.com/') && !url.includes('i.imgur.com')) {
      const id = url.split('/').pop().split('?')[0].split('.')[0];
      url = `https://i.imgur.com/${id}.jpg`;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*'
    };

    console.log(`🌐 Fetching media candidate: ${url}`);
    let res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;

    let contentType = (res.headers.get('content-type') || '').toLowerCase();

    // If URL is a webpage (HTML), scrape the actual .mp4 / og:video / og:image inside it
    if (contentType.includes('text/html')) {
      const html = await res.text();
      const mp4Match = html.match(/https:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?/i);
      const ogVideo = html.match(
        /<meta[^>]+property=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/i
      );
      const ogImage = html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      );
      const extractedUrl = mp4Match?.[0] || ogVideo?.[1] || ogImage?.[1];

      if (!extractedUrl) {
        console.log('⚠️ Webpage returned HTML with no extractable video/image.');
        return null;
      }

      console.log(`🎯 Extracted direct media from page: ${extractedUrl}`);
      url = extractedUrl;
      res = await fetch(url, { headers, redirect: 'follow' });
      if (!res.ok) return null;
      contentType = (res.headers.get('content-type') || '').toLowerCase();
    }

    // Reject if still HTML or text
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      console.log(`⚠️ Rejected non-media content-type: ${contentType}`);
      return null;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    // Reject tiny broken files (< 10KB) or huge files (> 48MB)
    if (buffer.byteLength < 10000 || buffer.byteLength > 48 * 1024 * 1024) {
      console.log(`⚠️ Invalid media size (${buffer.byteLength} bytes), skipping.`);
      return null;
    }

    let ext = '.jpg';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (contentType.includes('video') || cleanUrl.endsWith('.mp4')) {
      ext = '.mp4';
    } else if (contentType.includes('gif') || cleanUrl.endsWith('.gif')) {
      ext = '.gif';
    } else if (contentType.includes('png') || cleanUrl.endsWith('.png')) {
      ext = '.png';
    }

    const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}${ext}`);
    fs.writeFileSync(tempPath, buffer);
    console.log(
      `✅ Downloaded valid ${ext.toUpperCase()} (${(buffer.byteLength / 1024).toFixed(1)} KB)`
    );
    return tempPath;
  } catch (e) {
    console.log('⚠️ Media download skipped:', e.message);
    return null;
  }
}

async function openComposeEditor(page) {
  const inlineEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
  if (await inlineEditor.isVisible().catch(() => false)) {
    await inlineEditor.click({ force: true });
    return inlineEditor;
  }

  console.log('🔄 Navigating to https://x.com/compose/post...');
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await randomSleep(4, 6);
  await inlineEditor.waitFor({ state: 'visible', timeout: 20000 });
  await inlineEditor.click({ force: true });
  return inlineEditor;
}

async function runBot() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const configPath = path.join(dataDir, 'config.json');

  if (!fs.existsSync(configPath)) {
    console.log('⚠️ data/config.json not found!');
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const activeAccounts = (config.accounts || []).filter(
    (a) => a.status === 'active' && a.auth_token && a.ct0
  );

  if (activeAccounts.length === 0) {
    console.log('⚠️ No active Twitter accounts found in data/config.json.');
    process.exit(0);
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.images)) config.images = [];
  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

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
  const defaultTargets = ['#nsfwtwt', '#thirsttrap', 'caught me being cute', 'who is up'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  // Built-in Working Direct MP4 Fallbacks if Queue URLs fail
  const guaranteedFallbacks = [
    'https://assets.mixkit.co/videos/preview/mixkit-sensual-woman-posing-for-the-camera-42995-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-young-woman-looking-at-the-camera-in-a-room-41643-large.mp4'
  ];

  const sortedAccounts = [...activeAccounts].sort((a, b) => {
    const timeA = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const timeB = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    return timeA - timeB;
  });

  const maxAccounts = Math.min(
    sortedAccounts.length,
    Math.max(1, parseInt(config.settings?.maxAccountsPerRun || 1, 10))
  );
  const accountsToRun = sortedAccounts.slice(0, maxAccounts);

  console.log(
    `🚀 Autonomous Bot Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
  );

  for (const acc of accountsToRun) {
    console.log(`\n👤 Processing Account: ${acc.username}`);

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
      console.log('🌐 Checking X session...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 8);

      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/i/flow/login') ||
        currentUrl.includes('/account/access')
      ) {
        console.log(`❌ Account ${acc.username} session expired or locked.`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        continue;
      }

      // Dismiss overlays
      await page
        .evaluate(() => {
          document
            .querySelectorAll('[data-testid="BottomBar"], [role="dialog"] [aria-label="Close"]')
            .forEach((el) => el.click?.());
        })
        .catch(() => {});

      // STEP 1: Try downloading from Scraped Media Queue (config.mediaQueue)
      let mediaItem = null;
      let attempts = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && attempts < 10) {
        attempts++;
        const candidate = config.mediaQueue.shift();
        localMediaPath = await downloadMedia(candidate);
        if (localMediaPath) {
          mediaItem = candidate;
          config.usedMedia.push(mediaItem);
        }
      }

      // STEP 2: If Queue failed/empty, use Fallback Image IDs / Direct MP4 URLs (config.images)
      if (!localMediaPath) {
        console.log('🔄 Trying Fallback Image IDs / Direct MP4 URLs pool...');
        const fallbackPool = config.images.length > 0 ? config.images : guaranteedFallbacks;
        const shuffledFallbacks = [...fallbackPool, ...guaranteedFallbacks].sort(
          () => 0.5 - Math.random()
        );
        for (const candidate of shuffledFallbacks) {
          localMediaPath = await downloadMedia(candidate);
          if (localMediaPath) {
            mediaItem = candidate;
            config.usedMedia.push(mediaItem);
            break;
          }
        }
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(
        mediaItem || 'vip'
      )}&t=${Date.now().toString().slice(-4)}`;

      // Anti-Ban Tagging: Only 1 hashtag + 1 harvested user max in main post
      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#nsfwtwt', '#thirsttrap']);
      const oneUser = pickRandom(config.harvestedUsers);
      const selectedTags = [oneHashtag, oneUser].filter(Boolean).join(' ');

      const caption = spin(pickRandom(captionsPool));
      // NEVER put the raw cloaked link in the main post so broken link cards never appear!
      const fullMainTweet = [caption, selectedTags].filter(Boolean).join('\n\n');

      // Compose & Upload Native Media
      const editor = await openComposeEditor(page);
      await editor.fill(fullMainTweet);
      await randomSleep(2, 3);

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media to X: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
        await fileInput.setInputFiles(localMediaPath);
        console.log('⏳ Waiting for X video/image processing...');
        await randomSleep(12, 18);
      }

      await publishTweetSafely(page);
      console.log(`✅ Main Media Post Published by ${acc.username}!`);
      if (masterAcc) masterAcc.lastStatus = '✅ Active & Posting Media';
      await randomSleep(8, 12);

      // Post Auto-Self-Reply with Money Link
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

      if (latestTweetHref && config.settings?.autoSelfReply !== false) {
        const fullTweetUrl = `https://x.com${latestTweetHref}`;
        console.log(`🔗 Opening latest post for Self-Reply: ${fullTweetUrl}`);
        await page.goto(fullTweetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomSleep(4, 7);

        let replyMsg = spin(pickRandom(repliesPool));
        replyMsg = replyMsg.includes('{{LINK}}')
          ? replyMsg.replace('{{LINK}}', cloakedLink)
          : `${replyMsg} ${cloakedLink}`;

        const replyMentions = pickMultipleRandom(config.harvestedUsers, 1).join(' ');
        if (replyMentions) {
          replyMsg = `${replyMsg}\n\n👀 ${replyMentions}`;
        }

        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        if (await replyBox.isVisible().catch(() => false)) {
          await replyBox.click({ force: true });
          await replyBox.fill(replyMsg);
          await randomSleep(3, 5);
          await publishTweetSafely(
            page,
            '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]'
          );
          console.log(`💬 Self-Reply + Money Link posted!`);
          await randomSleep(5, 8);
        }
      }

      // Harvest Active @Users & Like 1 Post
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
      const systemRoutes = [
        '/home',
        '/explore',
        '/notifications',
        '/messages',
        '/settings',
        '/search'
      ];
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

      const firstLiveTweet = page.locator('article[data-testid="tweet"]').first();
      if (await firstLiveTweet.isVisible().catch(() => false)) {
        const likeBtn = firstLiveTweet.locator('[data-testid="like"]').first();
        if (await likeBtn.isVisible().catch(() => false)) {
          await likeBtn.click({ force: true }).catch(() => {});
          console.log('❤️ Liked 1 active post for organic engagement');
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

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(5, 10);
  }

  console.log('\n🎉 Autonomous Bot Run Completed & Saved to data/config.json!');
}

runBot();
