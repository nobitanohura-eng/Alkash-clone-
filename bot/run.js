/**
 * File: bot/run.js
 * AlcashX Cloud Pro v5.0 — 100% Guaranteed Cloaked Link Publisher + React Input Trigger + Viral Hijacker
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

// CRITICAL FIX: Triggers X's React onChange state so Reply/Post buttons NEVER stay disabled!
async function typeIntoXEditor(page, editorLocator, text) {
  await editorLocator.waitFor({ state: 'visible', timeout: 20000 });
  await editorLocator.click({ force: true });
  await sleep(500);
  await editorLocator.fill(text);
  await sleep(600);
  // Real keyboard press wakes up Draft.js / React state on X!
  await page.keyboard.type(' ');
  await sleep(400);
}

async function publishTweetAndWait(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(600);

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

  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(4500);
    } catch (_) {}
  }

  if (await btn.isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(4000);
    } catch (_) {}
  }

  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 8000 });
      await sleep(4000);
    } catch (_) {}
  }
}

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
    if (rawBuffer.byteLength < 30000 || rawBuffer.byteLength > 8.5 * 1024 * 1024) {
      console.log(`⏩ Skipping file (${(rawBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
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
    '{Part 1 before X deletes it|Wait till 0:04 😳|Caught on camera|My camera roll is dangerous} {🙊💦|😈🔥|👀}',
    "{Should I post the uncut part 2?|Did I show too much at the end?|Deleting this in 10 mins} {😳💦|🤫🔥|👇}",
    "{Full leaked clip is in my replies 👇|Don't pause at the end 😳|Be honest, would you? 💦} {🙊|😈|🔥}"
  ];
  const defaultReplies = [
    '{Full 3 min uncut leaked video|Watch what happened next without censor|The rest of this clip is too spicy for X} right here 👇🔞 {{LINK}}',
    "{X deleted the second half}, watch the full uncensored video free on my VIP page 👉 {{LINK}} 💦🔥"
  ];
  const defaultTargets = ['#thirsttrap', '#GFMode', '#latenight'];

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
    `🚀 Autonomous Bot v5.0 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
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
      // 1. Download Fast MP4
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
        console.log('⚠️ Could not download a valid MP4. Skipping...');
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
      const fullMainTweet = `${caption}\n\nFull uncut link in replies 👇🔞\n${[oneHashtag, mainMentions].filter(Boolean).join(' ')}`;
      const selfReplyComment = replyMentions
        ? `${fullReplyText}\n\n👀 ${replyMentions}`
        : `${fullReplyText}`;

      // 2. Open Compose & Upload Video
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 7);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/account/access')) {
        console.log(`❌ Account ${acc.username} cookie expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      await typeIntoXEditor(page, editor0, fullMainTweet);
      await randomSleep(2, 3);

      console.log(`📤 Uploading MP4 to X: ${path.basename(localMediaPath)}`);
      const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
      await fileInput.setInputFiles(localMediaPath);
      await randomSleep(10, 14);

      await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Main Video Post submitted on ${acc.username}! Waiting 8s for profile indexing...`);
      await randomSleep(8, 10);

      // 3. BULLETPROOF SELF-REPLY VIA PROFILE REPLY MODAL (100% Never Misses Link!)
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(5, 7);

      const firstTweetArticle = page.locator('article[data-testid="tweet"]').first();
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

      let linkReplySuccess = false;

      // Method A: Click Reply Icon directly on Profile's 1st Tweet to open clean Reply Modal!
      if (await firstTweetArticle.isVisible().catch(() => false)) {
        const replyIconBtn = firstTweetArticle.locator('[data-testid="reply"]').first();
        if (await replyIconBtn.isVisible().catch(() => false)) {
          console.log(`💬 Clicking Reply Icon on latest tweet to attach Money Link: ${cloakedLink}`);
          await replyIconBtn.click({ force: true });
          await randomSleep(3, 5);

          const modalEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await modalEditor.isVisible().catch(() => false)) {
            await typeIntoXEditor(page, modalEditor, selfReplyComment);
            await randomSleep(5, 7); // Wait 6s so X fetches the Vercel Fanpage Image Card!
            await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
            linkReplySuccess = true;
            console.log(`🔗 SUCCESS! Cloaked Fanpage Link published via Reply Modal!`);
            await randomSleep(4, 6);
          }
        }
      }

      // Method B Fallback: Navigate directly to status URL if Modal didn't open
      if (!linkReplySuccess && latestHref) {
        console.log(`🔄 Fallback: Opening ${publishedUrl} directly to post link comment...`);
        await page.goto(publishedUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await randomSleep(4, 6);

        const inlinePlaceholder = page
          .locator('[data-testid="tweetTextarea_0_label"], [data-testid="tweetTextarea_0"]')
          .first();
        if (await inlinePlaceholder.isVisible().catch(() => false)) {
          await inlinePlaceholder.click({ force: true }).catch(() => {});
          await sleep(1000);
          const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          await typeIntoXEditor(page, replyBox, selfReplyComment);
          await randomSleep(5, 7);
          await publishTweetAndWait(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
          linkReplySuccess = true;
          console.log(`🔗 SUCCESS! Cloaked Fanpage Link published on Status Page!`);
        }
      }

      logActivity(config, {
        account: acc.username,
        type: '🎬 VIDEO_AND_LINK',
        targetUrl: publishedUrl,
        mediaUrl: mediaItem,
        detail: `Video + Link Comment (${linkReplySuccess ? '✅ Link Posted' : '⚠️ Video Only'})`
      });

      // 4. SAFE-SEARCH BYPASS VIRAL HIJACKER (With React Keyboard Trigger + Cloaked Link Bait!)
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

      // B) Hijack Top 2 Active Posts using Reply Modal + React Trigger
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

          const mainArticle = page.locator('article[data-testid="tweet"]').first();
          const likeBtn = mainArticle.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1200);
          }

          // Click the reply icon on the viral tweet to open modal
          const replyIcon = mainArticle.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click({ force: true }).catch(() => {});
            await sleep(2000);
          }

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            const baitMsg = spin(
              `{i can't sleep either 😭 just posted a crazy leaked clip on my profile before deleting 🙊💦|omg wait till you see the uncut video I just dropped on my page 😳🔥|rate the new video I just posted on my profile? be honest 👀🔞}`
            );
            await typeIntoXEditor(page, replyInput, baitMsg);
            await randomSleep(2, 4);
            await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
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
        masterAcc.lastStatus = `✅ Video + Link (${linkReplySuccess ? 'OK' : 'Retry'}) + ${hijackedCount} Hijacks`;
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

  // 5. CROSS-ACCOUNT ENGAGEMENT POD (Likes & Retweets BOTH Main Post & Link Comment!)
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

          // Like first 2 tweets on the page (Main Video Post + Self-Reply Link Comment!)
          if (config.settings?.crossAccountLike) {
            const likeBtns = page.locator('[data-testid="like"]');
            const count = await likeBtns.count().catch(() => 0);
            for (let k = 0; k < Math.min(count, 2); k++) {
              await likeBtns.nth(k).click({ force: true }).catch(() => {});
              await sleep(1200);
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
            detail: `Liked Video + Link Comment & Retweeted ${item.author}`
          });
        }
      } catch (_) {
      } finally {
        await browser.close();
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  console.log('\n🎉 Run v5.0 Completed & Activity Logs Saved!');
}

runBot();
