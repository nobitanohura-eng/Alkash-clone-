/**
 * AlcashX Cloud Pro — Autonomous Twitter/X Bot (bot/run.js)
 * Fixed:
 *  - Zero Click Interception Timeout (3-Layer Publish: Ctrl+Enter + DOM Click + Force Click)
 *  - Scrapes & Downloads from https://getredgifs.com/trending
 *  - Native Video/Image Upload + Auto-Self-Reply Money Link + Active @User Tagging & Outreach
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

function spin(text) {
  if (!text) return '';
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * choices.length)];
}

function pickMultipleRandom(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (minSec, maxSec) =>
  sleep((Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000);

// ============================================================================
// BULLETPROOF TWEET / REPLY PUBLISHER (Fixes "subtree intercepts pointer events")
// ============================================================================
async function publishTweetSafely(page, buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]') {
  // Wait until Twitter finishes processing uploaded media (aria-disabled becomes false)
  for (let i = 0; i < 15; i++) {
    const isDisabled = await page
      .locator(buttonSelector)
      .first()
      .getAttribute('aria-disabled')
      .catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(1000);
  }

  // Method 1: Keyboard Shortcut (Control+Enter bypasses all CSS overlays!)
  try {
    await page.keyboard.press('Control+Enter');
    await sleep(2500);
  } catch (_) {}

  // Check if button is still visible; if so, use Method 2: Direct JS DOM Click
  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(2500);
    } catch (_) {}
  }

  // Method 3: Playwright Force Click fallback
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 8000 });
    } catch (_) {}
  }
}

// ============================================================================
// DOWNLOAD MEDIA FROM getredgifs.com OR QUEUE FOR NATIVE TWITTER UPLOAD
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
        Referer: 'https://getredgifs.com/'
      }
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 5000 || buffer.byteLength > 45 * 1024 * 1024) return null;
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    return tempPath;
  } catch (e) {
    console.log('⚠️ Media download skipped:', e.message);
    return null;
  }
}

// ============================================================================
// ROBUST COMPOSE BOX OPENER (Prefers /home Inline Editor to avoid Modal Overlays)
// ============================================================================
async function openComposeEditor(page) {
  // Attempt 1: Inline editor on https://x.com/home (No modal overlay issues!)
  const inlineEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
  if (await inlineEditor.isVisible().catch(() => false)) {
    await inlineEditor.click({ force: true });
    return inlineEditor;
  }

  // Attempt 2: Direct navigation to /compose/post
  console.log('🔄 Navigating directly to https://x.com/compose/post...');
  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await randomSleep(4, 6);
  await inlineEditor.waitFor({ state: 'visible', timeout: 20000 });
  await inlineEditor.click({ force: true });
  return inlineEditor;
}

// ============================================================================
// MAIN AUTONOMOUS BOT RUNNER
// ============================================================================
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

  // Smart Rotation: Oldest lastRunAt runs first
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

  const postedTweetUrls = [];

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
      // STEP A: Open X Home & Dismiss Any Blocking Popups/Banners
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

      // Dismiss any cookie banner or notification sheet that could block clicks
      await page.evaluate(() => {
        const layers = document.querySelectorAll('[data-testid="BottomBar"], [role="dialog"] [aria-label="Close"]');
        layers.forEach((el) => el.click?.());
      }).catch(() => {});

      // STEP B: Pick & Download Media from getredgifs.com Queue
      let mediaItem = null;
      let attempts = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && attempts < 8) {
        attempts++;
        const candidate = config.mediaQueue.shift();
        localMediaPath = await downloadMedia(candidate);
        if (localMediaPath) {
          mediaItem = candidate;
          config.usedMedia.push(mediaItem);
        }
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(
        mediaItem || 'https://getredgifs.com/trending'
      )}&t=${Date.now().toString().slice(-4)}`;

      // Combine hashtags + 1 active harvested user for main post
      const allTagPool = [...targetsPool.filter((t) => t.startsWith('#')), ...config.harvestedUsers];
      const selectedTags = pickMultipleRandom(
        allTagPool.length ? allTagPool : ['#nsfwtwt', '#thirsttrap'],
        2
      ).join(' ');
      const caption = spin(pickRandom(captionsPool));
      const fullMainTweet = [caption, selectedTags].filter(Boolean).join('\n\n');

      // STEP C: Compose & Upload Media + Bulletproof Publish
      const editor = await openComposeEditor(page);

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(localMediaPath);
        console.log('⏳ Waiting for X media processing...');
        await randomSleep(10, 15);
        await editor.click({ force: true });
        await editor.fill(fullMainTweet);
      } else {
        await editor.click({ force: true });
        await editor.fill(`${fullMainTweet}\n\n${cloakedLink}`);
      }

      await randomSleep(3, 5);
      await publishTweetSafely(page);
      console.log(`✅ Main Post Published by ${acc.username}!`);
      if (masterAcc) masterAcc.lastStatus = '✅ Active & Posting';
      await randomSleep(8, 11);

      // STEP D: Open Profile & Post Auto-Self-Reply with Money Link + Active @Users
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

          const replyMentions = pickMultipleRandom(config.harvestedUsers, 2).join(' ');
          if (replyMentions) {
            replyMsg = `${replyMsg}\n\n👀 ${replyMentions}`;
          }

          const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyBox.isVisible().catch(() => false)) {
            await replyBox.click({ force: true });
            await replyBox.fill(replyMsg);
            await randomSleep(3, 5);
            await publishTweetSafely(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
            console.log(`💬 Self-Reply + Money Link + Mentions posted!`);
            await randomSleep(5, 8);
          }
        }
      }

      // STEP E: Harvest Active @Users + Like & Bait-Reply on Live Posts
      const searchKeywords = targetsPool.filter((t) => !t.startsWith('@'));
      const searchQuery = pickRandom(searchKeywords) || '#nsfwtwt';
      console.log(`🔍 Harvesting active @users & doing Outreach on: "${searchQuery}"`);

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

      // Like & Reply on top 2 active posts
      const liveTweets = page.locator('article[data-testid="tweet"]');
      const liveCount = await liveTweets.count().catch(() => 0);
      for (let i = 0; i < Math.min(liveCount, 2); i++) {
        try {
          const tTweet = liveTweets.nth(i);
          const likeBtn = tTweet.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true });
            console.log(`❤️ Liked active post (#${i + 1})`);
            await randomSleep(2, 4);
          }

          const replyIcon = tTweet.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click({ force: true });
            await randomSleep(2, 4);
            const baitReply = spin(
              '{omg wait till you see my latest post 😳🔥|i just posted something way crazier on my profile 🙊💦|check my latest clip before i delete it 👀😈}'
            );
            const modalInput = page.locator('[data-testid="tweetTextarea_0"]').first();
            if (await modalInput.isVisible().catch(() => false)) {
              await modalInput.click({ force: true });
              await modalInput.fill(baitReply);
              await randomSleep(2, 4);
              await publishTweetSafely(page, '[data-testid="tweetButton"]');
              console.log(`🗣️ Replied bait on active post (#${i + 1})`);
              await randomSleep(4, 6);
            }
          }
        } catch (_) {}
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
    await randomSleep(6, 12);
  }

  // =========================================================================
  // PHASE 2: CROSS-ACCOUNT POD (LIKE + RETWEET + BOOKMARK)
  // =========================================================================
  if (
    postedTweetUrls.length > 0 &&
    activeAccounts.length > 1 &&
    (config.settings?.crossAccountLike ||
      config.settings?.crossAccountRetweet ||
      config.settings?.crossAccountBookmark)
  ) {
    console.log(`\n🔥 Starting Cross-Account Engagement Pod...`);
    for (const acc of activeAccounts.slice(0, 5)) {
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: 'auth_token',
          value: acc.auth_token.trim(),
          domain: '.x.com',
          path: '/',
          httpOnly: true,
          secure: true
        },
        { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true }
      ]);
      const page = await context.newPage();

      try {
        for (const item of postedTweetUrls) {
          if (item.author === acc.username) continue;
          await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await randomSleep(4, 6);

          if (config.settings?.crossAccountLike) {
            const likeBtn = page.locator('[data-testid="like"]').first();
            if (await likeBtn.isVisible().catch(() => false)) await likeBtn.click({ force: true });
            await randomSleep(1, 3);
          }
          if (config.settings?.crossAccountRetweet) {
            const rtBtn = page.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click({ force: true });
              await sleep(1000);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) await confirmRt.click({ force: true });
              await randomSleep(1, 3);
            }
          }
          if (config.settings?.crossAccountBookmark) {
            const bmBtn = page.locator('[data-testid="bookmark"]').first();
            if (await bmBtn.isVisible().catch(() => false)) await bmBtn.click({ force: true });
            await randomSleep(1, 3);
          }
          console.log(`⚡ Pod Boost by ${acc.username} -> ${item.url}`);
        }
      } catch (_) {
      } finally {
        await browser.close();
      }
    }
  }

  console.log('\n🎉 Autonomous Bot Run Completed & Saved to data/config.json!');
}

runBot();
