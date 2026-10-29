/**
 * File: bot/run.js
 * AlcashX Cloud Pro — Zero-Ban Autonomous Bot + Native Thread Cloaked Link + Viral Traffic Hijacker
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// Safe High-Converting Teaser Pool (Auto-plays on X without getting blurred by Adult Content filter!)
const TEASER_VIDEO_POOL = [
  'https://assets.mixkit.co/videos/preview/mixkit-sensual-woman-posing-for-the-camera-42995-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-young-woman-looking-at-the-camera-in-a-room-41643-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-with-long-hair-posing-indoors-42993-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-light-dancing-40033-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-posing-in-neon-light-42994-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-posing-in-neon-light-39878-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-in-a-club-with-neon-lights-40030-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-portrait-of-a-fashion-woman-with-silver-makeup-39875-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-girl-posing-in-a-studio-with-colored-lights-39876-large.mp4',
  'https://assets.mixkit.co/videos/preview/mixkit-woman-in-a-bikini-walking-on-the-beach-41236-large.mp4'
];

function spin(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const opts = group.split('|');
    return opts[Math.floor(Math.random() * opts.length)];
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
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(600);

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
      await sleep(2500);
    } catch (_) {}
  }
}

async function downloadMedia(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let url = rawUrl.trim();
    if (url === 'xYz987A') return null;

    if (!url.startsWith('http')) {
      url = `https://i.imgur.com/${url.replace(/\.(jpg|png|gif|mp4)$/i, '')}.jpg`;
    }

    const referer = url.includes('redgifs.com')
      ? 'https://www.redgifs.com/'
      : 'https://www.reddit.com/';

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*',
      Referer: referer
    };

    console.log(`🌐 Downloading media: ${url}`);
    const res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 8000 || buffer.byteLength > 45 * 1024 * 1024) return null;

    let ext = '.jpg';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (contentType.includes('video') || cleanUrl.endsWith('.mp4')) ext = '.mp4';
    else if (contentType.includes('gif') || cleanUrl.endsWith('.gif')) ext = '.gif';
    else if (contentType.includes('png') || cleanUrl.endsWith('.png')) ext = '.png';

    const tempPath = path.resolve(
      process.cwd(),
      `temp_${Date.now()}_${Math.floor(Math.random() * 9999)}${ext}`
    );
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  } catch (_) {
    return null;
  }
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
    console.log('⚠️ No active accounts found.');
    process.exit(0);
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.images)) config.images = [];
  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  // Remove fake dummy usernames like @simp_account_01
  config.harvestedUsers = config.harvestedUsers.filter(
    (u) => !u.includes('simp_account') && !u.includes('active_user') && !u.includes('user1')
  );

  const usedSet = new Set(config.usedMedia);
  config.mediaQueue = config.mediaQueue.filter((u) => !usedSet.has(u));

  if (config.mediaQueue.length < 3) {
    for (const v of TEASER_VIDEO_POOL) {
      if (!usedSet.has(v) && !config.mediaQueue.includes(v)) {
        config.mediaQueue.push(v);
      }
    }
    if (config.mediaQueue.length === 0) {
      config.mediaQueue.push(...TEASER_VIDEO_POOL.sort(() => 0.5 - Math.random()));
    }
  }

  const defaultCaptions = [
    '{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {again ✌️🐆|tonight 😈|🙊|👀}',
    "{Wait for the end|Don't pause at 0:02|Did I show too much?|Deleting this in 10 mins} {😳|🤫|💦|🔥}",
    "{can't sleep, who's still up? 🌙|am I your type? be honest 👀|would you say hi back? <3}"
  ];
  const defaultReplies = [
    '{Full uncensored video|Watch what happened next|The rest of this clip is too spicy for X} {👇|😈|💦} {{LINK}}',
    "{Couldn't post the full 2 min video here}, watch the uncut version free on my VIP page 👉 {{LINK}} 🔥"
  ];
  const defaultTargets = ['#nsfwtwt', '#thirsttrap', '#GFMode', 'who is up'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  // Rotate accounts by oldest lastRunAt first (Anti-Ban IP Safety)
  const sortedAccounts = [...activeAccounts].sort((a, b) => {
    const timeA = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const timeB = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    return timeA - timeB;
  });

  const maxPerRun = Math.min(
    sortedAccounts.length,
    Math.max(1, parseInt(config.settings?.maxAccountsPerRun || 2, 10))
  );
  const accountsToRun = sortedAccounts.slice(0, maxPerRun);

  console.log(
    `🚀 Autonomous Bot Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
  );

  for (const acc of accountsToRun) {
    console.log(`\n👤 Processing Account: ${acc.username}`);
    const masterAcc = config.accounts.find((x) => x.username === acc.username);
    if (masterAcc) masterAcc.lastRunAt = new Date().toISOString();

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    });

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
    let mediaItem = null;

    try {
      // 1. Pick Unique Unused Video/Image for THIS Account
      let tries = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && tries < 10) {
        tries++;
        const candidate = config.mediaQueue.shift();
        if (usedSet.has(candidate)) continue;

        localMediaPath = await downloadMedia(candidate);
        if (localMediaPath) {
          mediaItem = candidate;
          usedSet.add(candidate);
          config.usedMedia.push(candidate);
        }
      }

      if (!localMediaPath) {
        mediaItem = pickRandom(TEASER_VIDEO_POOL);
        localMediaPath = await downloadMedia(mediaItem);
      }

      // Build Unique Cloaked Fanpage Link
      const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(
        mediaItem || 'vip'
      )}&id=${uniqueCode}`;

      let replyTemplate = spin(pickRandom(repliesPool));
      const fullReplyText = replyTemplate.includes('{{LINK}}')
        ? replyTemplate.replace('{{LINK}}', cloakedLink)
        : `${replyTemplate} ${cloakedLink}`;

      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#nsfwtwt', '#thirsttrap']);
      const realMentions = pickMultipleRandom(config.harvestedUsers, 1).join(' ');

      const caption = spin(pickRandom(captionsPool));
      const fullMainTweet = [caption, oneHashtag].filter(Boolean).join('\n\n') + ' ';
      const threadReplyTweet = realMentions
        ? `${fullReplyText}\n\n👀 ${realMentions} `
        : `${fullReplyText} `;

      // 2. Open Compose Page & Verify Session
      await page.goto('https://x.com/compose/post', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await randomSleep(5, 7);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/account/access')) {
        console.log(`❌ Account ${acc.username} cookie expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      await editor0.waitFor({ state: 'visible', timeout: 25000 });
      await editor0.click({ force: true });
      await editor0.fill(fullMainTweet);
      await randomSleep(2, 3);

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
        await fileInput.setInputFiles(localMediaPath);
        await randomSleep(10, 15);
      }

      // 3. NATIVE THREAD BUILDER: Click "+" (addButton) inside Compose Modal to attach Cloaked Link as 1st Comment!
      let attachedAsThread = false;
      const addThreadBtn = page.locator('[data-testid="addButton"]').first();
      if (await addThreadBtn.isVisible().catch(() => false)) {
        try {
          console.log('➕ Clicking "+" Add Thread button to attach Cloaked Link comment...');
          await addThreadBtn.click({ force: true });
          await randomSleep(2, 3);

          const editor1 = page.locator('[data-testid="tweetTextarea_1"]').first();
          if (await editor1.isVisible().catch(() => false)) {
            await editor1.click({ force: true });
            await editor1.fill(threadReplyTweet);
            await randomSleep(2, 4);
            attachedAsThread = true;
            console.log('🔗 Cloaked Fanpage Link attached in Thread Comment #1!');
          }
        } catch (threadErr) {
          console.log('⚠️ Thread button fallback:', threadErr.message);
        }
      }

      // If "+" thread button wasn't available, include the Cloaked Link right in the post so it's 100% never missed!
      if (!attachedAsThread) {
        console.log('⚡ Attaching Cloaked Link directly to post...');
        await editor0.click({ force: true });
        await editor0.fill(`${caption}\n\n👇🔞 ${cloakedLink}\n${oneHashtag} `);
        await randomSleep(2, 3);
      }

      // Publish Post (or Thread: Video + Comment Link together!)
      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Published Video + Cloaked Link (${cloakedLink}) on ${acc.username}!`);
      if (masterAcc) masterAcc.lastStatus = '✅ Active & Posting Link';
      await randomSleep(8, 11);

      // 4. VIRAL COMMENT HIJACKER + REAL @USER HARVESTER (Brings Fast Clicks & Views!)
      const searchQueries = [
        '"who is up" min_faves:10',
        '"rate me" min_faves:10',
        '#thirsttrap min_faves:5',
        '#nsfwtwt min_faves:10'
      ];
      const liveQuery = pickRandom(searchQueries);
      console.log(`🔍 Searching high-traffic posts for Outreach & Harvesting: ${liveQuery}`);

      await page.goto(`https://x.com/search?q=${encodeURIComponent(liveQuery)}&f=live`, {
        waitUntil: 'domcontentloaded',
        timeout: 40000
      });
      await randomSleep(5, 7);

      // A) Harvest real active @users
      const cleanHandle = acc.username.replace('@', '').trim();
      const scrapedHandles = await page
        .evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('article a[href^="/"]'));
          const out = [];
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            if (/^\/[a-zA-Z0-9_]{3,15}$/.test(href)) {
              out.push('@' + href.slice(1));
            }
          }
          return [...new Set(out)];
        })
        .catch(() => []);

      const ownHandleLower = `@${cleanHandle.toLowerCase()}`;
      for (const h of scrapedHandles) {
        if (h.toLowerCase() !== ownHandleLower && !config.harvestedUsers.includes(h)) {
          config.harvestedUsers.push(h);
        }
      }
      config.harvestedUsers = config.harvestedUsers.slice(-150);

      // B) Like & Drop a Teasing Profile-Bait Reply on 1 Viral Post (Safe Zero-Ban Traffic Hijack!)
      const viralTweet = page.locator('article[data-testid="tweet"]').first();
      if (await viralTweet.isVisible().catch(() => false)) {
        const likeBtn = viralTweet.locator('[data-testid="like"]').first();
        if (await likeBtn.isVisible().catch(() => false)) {
          await likeBtn.click({ force: true }).catch(() => {});
          await randomSleep(2, 3);
        }

        const replyBtn = viralTweet.locator('[data-testid="reply"]').first();
        if (await replyBtn.isVisible().catch(() => false)) {
          await replyBtn.click({ force: true }).catch(() => {});
          await randomSleep(3, 4);

          const modalInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await modalInput.isVisible().catch(() => false)) {
            const baitComment = spin(
              '{omg wait till you see what I just posted on my profile 😳🔥|i just uploaded something way crazier on my page before deleting 🙊💦|can someone rate my latest video on my profile? 👀😈} '
            );
            await modalInput.click({ force: true });
            await modalInput.fill(baitComment);
            await randomSleep(2, 4);
            await publishTweetSafely(page, '[data-testid="tweetButton"]');
            console.log('🚀 Hijacked 1 Viral Post with Profile Bait Comment!');
            await randomSleep(4, 6);
          }
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
    await randomSleep(6, 12);
  }

  console.log('\n🎉 Run Completed & Saved to data/config.json!');
}

runBot();
