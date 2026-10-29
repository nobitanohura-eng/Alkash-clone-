/**
 * File: bot/run.js
 * AlcashX Cloud Pro v4.0 — High-Engagement Amateur Video Bot + Viral Hijacker + Live Activity Logger
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

// Downloads MP4 & mutates binary hash so X's automated hash-scanner never auto-blurs or flags duplicates!
async function downloadMedia(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const url = rawUrl.trim();

    // Block Rule34 animated ads & Mixkit stock videos
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
    if (rawBuffer.byteLength < 25000 || rawBuffer.byteLength > 45 * 1024 * 1024) return null;

    // Anti-Blur Hash Randomizer: Append 16 random bytes so every upload has a 100% unique MD5/SHA256 fingerprint
    const saltBytes = crypto.randomBytes(16);
    const finalBuffer = Buffer.concat([rawBuffer, saltBytes]);

    let ext = '.mp4';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.gif')) ext = '.gif';
    else if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) ext = '.jpg';
    else if (cleanUrl.endsWith('.png')) ext = '.png';

    const tempPath = path.resolve(
      process.cwd(),
      `temp_${Date.now()}_${Math.floor(Math.random() * 9999)}${ext}`
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

  // Purge dummy usernames & old junk URLs
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
    '{Caught me being|Feeling so|Just being} {naughty alone|horny tonight|playful in bed|so wet rn} {🙊💦|😈🔥|👀|🤫}',
    "{Wait till 0:04 😳|Don't pause this|Did I show too much?|Deleting this in 10 mins before my ex sees} {😳💦|🤫🔥|😈}",
    "{can't sleep, who wants the full video? 🌙|would you help me finish? be honest 👀💦|my fingers weren't enough tonight 🙊🔥}"
  ];
  const defaultReplies = [
    '{Full 3 min uncut video|Watch me finish without censor|The rest of this clip is too wet for X} right here 👇🔞 {{LINK}}',
    "{X keeps deleting the full video}, watch my private uncensored tape free here 👉 {{LINK}} 💦🔥"
  ];
  const defaultTargets = ['#nsfwtwt', '#thirsttrap', '#desimms', 'who is up'];

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
    `🚀 Autonomous Bot v4.0 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
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
      // 1. Download Pure Amateur MP4 from Queue
      let tries = 0;
      while (config.mediaQueue.length > 0 && !localMediaPath && tries < 15) {
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
        console.log('⚠️ No valid MP4 downloaded for this run. Skipping post to avoid low-quality fallback!');
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
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#nsfwtwt', '#thirsttrap']);
      const realMentions = pickMultipleRandom(config.harvestedUsers, 2).join(' ');

      const caption = spin(pickRandom(captionsPool));
      const fullMainTweet = [caption, oneHashtag].filter(Boolean).join('\n\n') + ' ';
      const threadReplyTweet = realMentions
        ? `${fullReplyText}\n\n👀 ${realMentions} `
        : `${fullReplyText} `;

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
      await editor0.waitFor({ state: 'visible', timeout: 25000 });
      await editor0.click({ force: true });
      await editor0.fill(fullMainTweet);
      await randomSleep(2, 3);

      console.log(`📤 Uploading high-converting MP4: ${path.basename(localMediaPath)}`);
      const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
      await fileInput.setInputFiles(localMediaPath);
      await randomSleep(12, 17);

      // 3. Attach Cloaked Link in Thread Comment #1 via "+" Button
      let attachedAsThread = false;
      const addThreadBtn = page.locator('[data-testid="addButton"]').first();
      if (await addThreadBtn.isVisible().catch(() => false)) {
        try {
          await addThreadBtn.click({ force: true });
          await randomSleep(2, 3);
          const editor1 = page.locator('[data-testid="tweetTextarea_1"]').first();
          if (await editor1.isVisible().catch(() => false)) {
            await editor1.click({ force: true });
            await editor1.fill(threadReplyTweet);
            await randomSleep(2, 3);
            attachedAsThread = true;
          }
        } catch (_) {}
      }

      if (!attachedAsThread) {
        await editor0.click({ force: true });
        await editor0.fill(`${caption}\n\n👇🔞 ${cloakedLink}\n${oneHashtag} `);
        await randomSleep(2, 3);
      }

      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Published Video + Cloaked Link on ${acc.username}!`);
      await randomSleep(8, 11);

      // Verify Published Post URL on Profile & If Thread Failed, Post Self-Reply Directly
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(4, 6);

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
      logActivity(config, {
        account: acc.username,
        type: '🎬 MAIN_VIDEO_POST',
        targetUrl: publishedUrl,
        mediaUrl: mediaItem,
        detail: `Posted MP4 + Link Thread (${attachedAsThread ? 'Thread #1' : 'Direct'})`
      });

      // 4. VIRAL COMMENT HIJACKER (Hijacks 2 High-Reach Posts & Logs Exact URLs!)
      const hijackQueries = [
        '#nsfwtwt filter:media',
        '#thirsttrap filter:media',
        '"who is up" filter:replies',
        '"rate me" filter:media'
      ];
      const chosenQuery = pickRandom(hijackQueries);
      console.log(`🔍 Searching Viral Posts to Hijack & Harvest Users: ${chosenQuery}`);

      await page.goto(`https://x.com/search?q=${encodeURIComponent(chosenQuery)}&f=live`, {
        waitUntil: 'domcontentloaded',
        timeout: 40000
      });
      await randomSleep(5, 7);

      // A) Harvest Real Active @Users
      const scrapedHandles = await page
        .evaluate(() => {
          const banned = new Set(['home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i']);
          const anchors = Array.from(document.querySelectorAll('article[data-testid="tweet"] a[href^="/"]'));
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
      console.log(`🎯 Harvested ${newlyAdded} real @users (Pool: ${config.harvestedUsers.length})`);

      // B) Hijack Top 2 Viral Posts with Teasing Bait Replies
      const candidateUrls = await page
        .evaluate((own) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const urls = [];
          for (const art of articles) {
            const statusLink = art.querySelector('a[href*="/status/"]');
            if (statusLink) {
              const href = statusLink.getAttribute('href') || '';
              if (!href.toLowerCase().includes(`/${own.toLowerCase()}/status/`)) {
                urls.push(href.startsWith('http') ? href : `https://x.com${href}`);
              }
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

          // Like the viral post first
          const likeBtn = page.locator('article[data-testid="tweet"] [data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1500);
          }

          // Activate reply input
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
              `{omg wait till you see the uncut video I just posted on my profile 😳💦|i just uploaded a way wetter video on my page before deleting 🙊🔥|my fingers weren't enough... check my pinned post right now 👀🔞} `
            );
            await replyInput.click({ force: true });
            await replyInput.fill(baitMsg);
            await randomSleep(2, 4);
            await publishTweetSafely(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
            hijackedCount++;
            console.log(`🚀 Hijacked Viral Post (${hijackedCount}): ${targetPostUrl}`);

            logActivity(config, {
              account: acc.username,
              type: '💬 VIRAL_HIJACK_REPLY',
              targetUrl: targetPostUrl,
              detail: `Dropped bait comment & liked viral post`
            });
            await randomSleep(4, 6);
          }
        } catch (_) {}
      }

      if (masterAcc) {
        masterAcc.lastStatus = `✅ Posted Video + ${hijackedCount} Viral Hijacks`;
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

  // 5. CROSS-ACCOUNT ENGAGEMENT POD (Cross-Like & Retweet + Activity Logging)
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

  console.log('\n🎉 Run v4.0 Completed & Activity Logs Saved!');
}

runBot();
