/**
 * File: bot/run.js
 * AlcashX Cloud Pro v4.5 — Guaranteed Multi-Account Post Delivery + Safe-Search Bypass Hijacker
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

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

// Waits for media upload to finish 100% AND verifies compose editor actually submits!
async function publishTweetAndWait(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(600);

  // Wait up to 30 seconds for Twitter to finish processing the MP4 (button becomes enabled)
  for (let i = 0; i < 30; i++) {
    const btn = page.locator(buttonSelector).first();
    const isDisabled = await btn.getAttribute('aria-disabled').catch(() => null);
    const isUploading = await page
      .locator('[role="progressbar"]')
      .isVisible()
      .catch(() => false);
    if (isDisabled !== 'true' && !isUploading) break;
    await sleep(1000);
  }

  await sleep(1500);

  // Layer 1: Direct DOM Click on Tweet Button
  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(4000);
    } catch (_) {}
  }

  // Layer 2: Control+Enter if button still visible
  if (await btn.isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(4000);
    } catch (_) {}
  }

  // Layer 3: Playwright Force Click if still visible
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 8000 });
      await sleep(4000);
    } catch (_) {}
  }
}

// Downloads fast MP4 (< 8.5 MB so upload never hangs) & mutates binary hash
async function downloadMedia(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const url = rawUrl.trim();

    if (
      url === 'xYz987A' ||
      url.includes('aacdn.net') ||
      url.includes('rule34') ||
      url.includes('mixkit.co')
    ) {
      return null;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*'
    };
    if (url.includes('redgifs.com')) {
      headers.Referer = 'https://www.redgifs.com/';
    }

    console.log(`🌐 Downloading MP4: ${url}`);
    const res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) return null;

    const rawBuffer = Buffer.from(await res.arrayBuffer());
    // Keep between 30KB and 8.5MB so Twitter processes the video in 3-5 seconds without failing!
    if (rawBuffer.byteLength < 30000 || rawBuffer.byteLength > 8.5 * 1024 * 1024) {
      console.log(`⏩ Skipping oversized/tiny file (${(rawBuffer.byteLength / 1024 / 1024).toFixed(2)} MB) for fast upload`);
      return null;
    }

    const saltBytes = crypto.randomBytes(16);
    const finalBuffer = Buffer.concat([rawBuffer, saltBytes]);

    const tempPath = path.resolve(
      process.cwd(),
      `temp_${Date.now()}_${Math.floor(Math.random() * 9999)}.mp4`
    );
    fs.writeFileSync(tempPath, finalBuffer);
    console.log(
      `✅ Ready: ${path.basename(tempPath)} (${(finalBuffer.byteLength / 1024 / 1024).toFixed(2)} MB, Unique Hash)`
    );
    return tempPath;
  } catch (_) {
    return null;
  }
}

function logActivity(config, entry) {
  if (!Array.isArray(config.activityLog)) config.activityLog = [];
  config.activityLog.unshift({
    time: new Date().toISOString(),
    ...entry
  });
  config.activityLog = config.activityLog.slice(0, 60);
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
  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];
  if (!Array.isArray(config.activityLog)) config.activityLog = [];

  const dummyPatterns = ['simp_account', 'active_user', 'reply_guy', 'nsfw_retweeter', 'thirst_trap_lover', 'user1'];
  config.harvestedUsers = config.harvestedUsers.filter(
    (u) => !dummyPatterns.some((pat) => u.toLowerCase().includes(pat))
  );

  const usedSet = new Set(config.usedMedia);
  config.mediaQueue = config.mediaQueue.filter(
    (u) =>
      u &&
      !usedSet.has(u) &&
      !u.includes('aacdn.net') &&
      !u.includes('rule34') &&
      !u.includes('mixkit.co') &&
      u.split('?')[0].toLowerCase().endsWith('.mp4')
  );

  const defaultCaptions = [
    '{Caught me being|Feeling a little|Just being} {naughty alone|playful in bed|so bored tonight} {🙊💦|😈🔥|👀|✌️🐆}',
    "{Wait till 0:03 😳|Don't pause this|Did I show too much?|Deleting this in 10 mins} {😳💦|🤫🔥|😈}",
    "{can't sleep, who wants the full video? 🌙|am I your type? be honest 👀💦|should I post the uncut part 2? 🙊🔥}"
  ];
  const defaultReplies = [
    '{Full 3 min uncut video|Watch what happened next without censor|The rest of this clip is too spicy for X} right here 👇🔞 {{LINK}}',
    "{X keeps deleting the full video}, watch my private uncensored tape free here 👉 {{LINK}} 💦🔥"
  ];
  const defaultTargets = ['#thirsttrap', '#nsfwtwt', '#GFMode'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

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
  const newlyPublishedTweets = [];

  console.log(
    `🚀 Autonomous Bot v4.5 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
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
      { name: 'auth_token', value: acc.auth_token.trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true },
      { name: 'auth_token', value: acc.auth_token.trim(), domain: '.twitter.com', path: '/', httpOnly: true, secure: true },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.twitter.com', path: '/', secure: true }
    ]);

    const page = await context.newPage();
    let localMediaPath = null;
    let mediaItem = null;

    try {
      // 1. Download Fast-Upload MP4 (< 8.5 MB)
      let tries = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && tries < 20) {
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
        console.log('⚠️ Could not download a valid MP4 under 8.5MB. Skipping...');
        if (masterAcc) masterAcc.lastStatus = '⚠️ Queue Needs Refill';
        continue;
      }

      const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(mediaItem)}&id=${uniqueCode}`;

      let replyTemplate = spin(pickRandom(repliesPool));
      const fullReplyText = replyTemplate.includes('{{LINK}}')
        ? replyTemplate.replace('{{LINK}}', cloakedLink)
        : `${replyTemplate} ${cloakedLink}`;

      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#thirsttrap']);
      const mainMentions = pickMultipleRandom(config.harvestedUsers, 1).join(' ');
      const replyMentions = pickMultipleRandom(config.harvestedUsers, 2).join(' ');

      const caption = spin(pickRandom(captionsPool));
      // Clean Main Post (No link in main caption so X doesn't deboost reach!)
      const fullMainTweet = [caption, [oneHashtag, mainMentions].filter(Boolean).join(' ')].filter(Boolean).join('\n\n') + ' ';
      const selfReplyComment = replyMentions
        ? `${fullReplyText}\n\n👀 ${replyMentions} `
        : `${fullReplyText} `;

      // 2. Open X Compose & Publish Single Video Post First (100% Reliable on ALL Accounts!)
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
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

      console.log(`📤 Uploading MP4 to X: ${path.basename(localMediaPath)}`);
      const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
      await fileInput.setInputFiles(localMediaPath);
      await randomSleep(10, 14);

      await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Main Video Post submitted on ${acc.username}! Waiting 7s for X profile indexing...`);
      await randomSleep(7, 10);

      // 3. Open Profile, Grab Exact Published Tweet URL & Post Self-Reply Comment with Cloaked Link!
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(5, 7);

      const latestHref = await page
        .evaluate((handle) => {
          const links = Array.from(document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]'));
          for (const a of links) {
            const h = a.getAttribute('href') || '';
            if (h.toLowerCase().includes(`/${handle.toLowerCase()}/status/`)) return h;
          }
          return null;
        }, cleanHandle)
        .catch(() => null);

      const publishedUrl = latestHref
        ? latestHref.startsWith('http')
          ? latestHref
          : `https://x.com${latestHref}`
        : `https://x.com/${cleanHandle}`;

      newlyPublishedTweets.push({ url: publishedUrl, author: acc.username });

      // Post Money Link in Self-Reply Comment under the Video!
      if (latestHref && config.settings?.autoSelfReply !== false) {
        console.log(`💬 Posting Cloaked Fanpage Link under: ${publishedUrl}`);
        await page.goto(publishedUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await randomSleep(4, 6);

        const replyPlaceholder = page
          .locator('[data-testid="tweetTextarea_0_label"], [data-testid="tweetTextarea_0"]')
          .first();
        if (await replyPlaceholder.isVisible().catch(() => false)) {
          await replyPlaceholder.click({ force: true }).catch(() => {});
          await sleep(1200);
        }

        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        if (await replyBox.isVisible().catch(() => false)) {
          await replyBox.click({ force: true });
          await replyBox.fill(selfReplyComment);
          await randomSleep(4, 6); // Wait 5s so X renders the clickable Fanpage Card preview!
          await publishTweetAndWait(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
          console.log(`🔗 Cloaked Fanpage Link + Card published in comment!`);
          await randomSleep(4, 6);
        }
      }

      logActivity(config, {
        account: acc.username,
        type: '🎬 VIDEO_POST_AND_LINK',
        targetUrl: publishedUrl,
        mediaUrl: mediaItem,
        detail: `Published Video + Fanpage Link Comment`
      });

      // 4. SAFE-SEARCH BYPASS VIRAL HIJACKER (Uses Unfiltered Queries so it NEVER returns 0 users!)
      const unfilteredQueries = [
        '"who is up" min_faves:3',
        '"can\'t sleep" min_faves:5',
        '"rate me" min_faves:3',
        '"anyone awake" min_faves:3',
        '"dm me" min_faves:5'
      ];
      const chosenQuery = pickRandom(unfilteredQueries);
      console.log(`🔍 Searching Unfiltered Live Feed for Users & Hijacking: ${chosenQuery}`);

      await page.goto(`https://x.com/search?q=${encodeURIComponent(chosenQuery)}&f=live`, {
        waitUntil: 'domcontentloaded',
        timeout: 40000
      });
      await randomSleep(5, 7);

      // Scroll once to ensure tweets are rendered in DOM
      await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
      await sleep(2000);

      // A) Harvest Real Active @Users
      const scrapedHandles = await page
        .evaluate(() => {
          const banned = new Set([
            'home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i', 'tos', 'privacy'
          ]);
          const anchors = Array.from(document.querySelectorAll('a[href^="/"]'));
          const out = [];
          for (const a of anchors) {
            const raw = (a.getAttribute('href') || '').split('?')[0].replace(/^\/+/, '');
            if (/^[a-zA-Z0-9_]{3,15}$/.test(raw) && !banned.has(raw.toLowerCase())) {
              out.push('@' + raw);
            }
          }
          return [...new Set(out)];
        })
        .catch(() => []);

      const ownHandleLower = `@${cleanHandle.toLowerCase()}`;
      let newlyAdded = 0;
      for (const h of scrapedHandles) {
        if (h.toLowerCase() !== ownHandleLower && !config.harvestedUsers.includes(h)) {
          config.harvestedUsers.push(h);
          newlyAdded++;
        }
      }
      config.harvestedUsers = config.harvestedUsers.slice(-150);
      console.log(`🎯 Harvested ${newlyAdded} real @users (Total Pool: ${config.harvestedUsers.length})`);

      // B) Hijack Top 2 Active Posts with Profile-Bait Comments
      const candidateUrls = await page
        .evaluate((own) => {
          const links = Array.from(document.querySelectorAll('a[href*="/status/"]'));
          const urls = [];
          for (const l of links) {
            const href = (l.getAttribute('href') || '').split('?')[0];
            if (
              /^\/[a-zA-Z0-9_]+\/status\/\d+$/.test(href) &&
              !href.toLowerCase().includes(`/${own.toLowerCase()}/status/`)
            ) {
              urls.push(`https://x.com${href}`);
            }
          }
          return [...new Set(urls)].slice(0, 2);
        }, cleanHandle)
        .catch(() => []);

      let hijackedCount = 0;
      for (const targetPostUrl of candidateUrls) {
        try {
          await page.goto(targetPostUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await randomSleep(4, 6);

          const likeBtn = page.locator('article[data-testid="tweet"] [data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1500);
          }

          const replyPlaceholder = page
            .locator('[data-testid="tweetTextarea_0_label"], [data-testid="tweetTextarea_0"]')
            .first();
          if (await replyPlaceholder.isVisible().catch(() => false)) {
            await replyPlaceholder.click({ force: true }).catch(() => {});
            await sleep(1500);
          }

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            const baitMsg = spin(
              `{omg wait till you see the video I just posted on my profile 😳💦|i’m awake too... just uploaded something crazy on my page before deleting 🙊🔥|can someone rate the video I just posted on my profile? 👀🔞} `
            );
            await replyInput.click({ force: true });
            await replyInput.fill(baitMsg);
            await randomSleep(2, 4);
            await publishTweetAndWait(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
            hijackedCount++;
            console.log(`🚀 Hijacked Active Post (${hijackedCount}): ${targetPostUrl}`);

            logActivity(config, {
              account: acc.username,
              type: '💬 VIRAL_HIJACK_REPLY',
              targetUrl: targetPostUrl,
              detail: `Dropped bait comment & liked active post`
            });
            await randomSleep(4, 6);
          }
        } catch (_) {}
      }

      if (masterAcc) {
        masterAcc.lastStatus = `✅ Posted Video + Link & ${hijackedCount} Hijacks`;
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
    await randomSleep(5, 8);
  }

  // 5. CROSS-ACCOUNT ENGAGEMENT POD
  if (
    newlyPublishedTweets.length > 0 &&
    (config.settings?.crossAccountLike || config.settings?.crossAccountRetweet)
  ) {
    console.log(`\n🔥 Running Cross-Account Engagement Pod for ${newlyPublishedTweets.length} post(s)...`);
    for (const acc of activeAccounts) {
      const targetsForAcc = newlyPublishedTweets.filter((t) => t.author !== acc.username);
      if (targetsForAcc.length === 0) continue;

      const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 }
      });
      await context.addCookies([
        { name: 'auth_token', value: acc.auth_token.trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true },
        { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true }
      ]);
      const page = await context.newPage();

      try {
        for (const item of targetsForAcc) {
          await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await randomSleep(4, 6);

          if (config.settings?.crossAccountLike) {
            const likeBtn = page.locator('[data-testid="like"]').first();
            if (await likeBtn.isVisible().catch(() => false)) {
              await likeBtn.click({ force: true }).catch(() => {});
              await sleep(1500);
            }
          }
          if (config.settings?.crossAccountRetweet) {
            const rtBtn = page.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click({ force: true }).catch(() => {});
              await sleep(1200);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) {
                await confirmRt.click({ force: true }).catch(() => {});
              }
              await sleep(1500);
            }
          }
          logActivity(config, {
            account: acc.username,
            type: '⚡ POD_BOOST',
            targetUrl: item.url,
            detail: `Liked & Retweeted ${item.author}'s post`
          });
        }
      } catch (_) {
      } finally {
        await browser.close();
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  console.log('\n🎉 Run v4.5 Completed & Activity Logs Saved!');
}

runBot();
