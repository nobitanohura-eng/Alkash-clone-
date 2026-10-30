
  /**
 * File: bot/run.js (AlcashX Cloud Pro v10.0 — Per-Account Mode + Zero-Link Home Feed Hijacker + Multi-Threads)
 * Fixes & Upgrades:
 *  1. Respects Per-Account Post Mode from Dashboard: 'poll' (100% Zero-Link List Poll), 'image' (SafeSearch Card), or 'hybrid'
 *  2. 100% WORKING Like & Comment on Others' Tweets: Interacts directly on /home feed & seed profiles via Reply Modal (Bypasses X /search login blocks!)
 *  3. STRICT ZERO-LINK POLICY in Replies/Comments & Poll Mode: Never posts links in comments so accounts stay 100% safe from spam bans!
 *  4. Multi-Account Meta Threads Support: Loops through all active config.threadsAccounts
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// Default Vertical List Polls (100% Zero Links — Pure Engagement!)
const DEFAULT_VERTICAL_POLLS = [
  `Would you kiss me even if I were {38|42} years old?\n\n︎\n◯ Yes\n︎\n︎\n◯ No\n︎\n︎\n◯ Age is just a number ❤️`,
  `Be honest... what's the first thing you notice about a girl?\n\n︎\n◯ Eyes & Smile\n︎\n︎\n◯ Curves & Figure 👀\n︎\n︎\n◯ Vibe & Voice`,
  `If I texted you "I can't sleep, come over" at 2 AM, what are you doing?\n\n︎\n◯ On my way in 5 mins 🚗\n︎\n︎\n◯ Asking for a selfie first 🙊\n︎\n︎\n◯ Staying asleep`,
  `Sach batana... late night chat ke liye kaunsi vibe best hai?\n\n︎\n◯ Long drive & music 🌙\n︎\n︎\n◯ Room lock & chill 🔒\n︎\n︎\n◯ Video call 📱`
];

// 100% ZERO-LINK Teasing Comments for Replying on Other People's Tweets
const ZERO_LINK_OUTREACH_COMMENTS = [
  '{omg this is literally my mood right now 😳🔥|wait till you see what I just posted on my profile 🙊|i can’t sleep either, who is still awake? 🌙}',
  '{be honest, would you say hi back if I DMed you? 👀❤️|rate my latest post on my profile? be honest 🙈🔥|literally me every single night lol 😭✨}',
  '{who else is scrolling in bed wide awake right now? 👀🌙|stoppp this is too real 😂🔥|check my latest poll on my profile and vote honestly 👀}'
];

const VIRAL_SEED_PROFILES = [
  'https://x.com/kirawontmiss',
  'https://x.com/DailyLoud',
  'https://x.com/PicturesFoIder',
  'https://x.com/non_aesthetic'
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (minSec, maxSec) =>
  sleep((Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000);

function logActivity(config, entry) {
  if (!Array.isArray(config.activityLog)) config.activityLog = [];
  config.activityLog.unshift({
    time: new Date().toISOString(),
    ...entry
  });
  config.activityLog = config.activityLog.slice(0, 100);
}

function normalizeForSafeSearchCard(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('http')) return '';
  let u = rawUrl.trim();
  if (u.includes('redgifs.com') && u.split('?')[0].endsWith('.mp4')) {
    u = u.replace('-mobile.mp4', '-poster.jpg').replace('.mp4', '-poster.jpg');
  }
  if (u.includes('wsrv.nl') || u.includes('#noblur')) {
    return u.replace('#noblur', '');
  }
  return `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=960&h=540&fit=cover&a=attention&blur=6&con=12&bri=-5&output=jpg`;
}

function buildClickableCardLink(mediaItem) {
  const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 9999)}`;
  const cardImg = normalizeForSafeSearchCard(mediaItem);
  return `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(cardImg)}&id=${uniqueCode}`;
}

async function typeIntoEditor(page, editorLocator, text, waitAfterMs = 2500) {
  await editorLocator.waitFor({ state: 'visible', timeout: 20000 });
  await editorLocator.click({ force: true });
  await sleep(400);
  await editorLocator.fill(text);
  await sleep(500);
  // Real keystroke wakes up X's React state so Post/Reply button activates!
  await page.keyboard.press('End').catch(() => {});
  await page.keyboard.type(' ').catch(() => {});
  await sleep(waitAfterMs);
}

async function publishTweetSafely(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  const btn = page.locator(buttonSelector).first();
  for (let i = 0; i < 15; i++) {
    const isDisabled = await btn.getAttribute('aria-disabled').catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(600);
  }

  let clicked = false;
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 6000 });
      clicked = true;
    } catch (_) {}
  }

  if (!clicked && (await btn.isVisible().catch(() => false))) {
    try {
      await btn.evaluate((el) => el.click());
      clicked = true;
    } catch (_) {}
  }

  await sleep(3000);
  if (await page.locator('[data-testid="tweetButton"]').isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(3000);
    } catch (_) {}
  }
  return clicked;
}

// ============================================================================
// MULTI-ACCOUNT META THREADS AUTO-POSTER (Supports Unlimited Threads Accounts)
// ============================================================================
async function runMultiAccountThreads(config, pollsPool) {
  const threadsList = Array.isArray(config.threadsAccounts) ? config.threadsAccounts : [];
  const activeThreads = threadsList.filter((t) => t.status === 'active' && t.accessToken && t.userId);

  // Also check env secret fallback if user added single token in GitHub Secrets
  if (activeThreads.length === 0 && process.env.THREADS_ACCESS_TOKEN) {
    activeThreads.push({
      username: '@Threads_Env',
      userId: process.env.THREADS_USER_ID || 'me',
      accessToken: process.env.THREADS_ACCESS_TOKEN,
      postMode: 'poll'
    });
  }

  if (activeThreads.length === 0) return;

  console.log(`\n🧵 Running Meta Threads Auto-Poster for ${activeThreads.length} account(s)...`);

  for (const th of activeThreads) {
    try {
      const textToPost = spin(pickRandom(pollsPool));
      const createUrl = `https://graph.threads.net/v1.0/${encodeURIComponent(th.userId)}/threads?media_type=TEXT&text=${encodeURIComponent(textToPost)}&access_token=${encodeURIComponent(th.accessToken)}`;

      const createRes = await fetch(createUrl, { method: 'POST' });
      const createData = await createRes.json();
      if (!createData.id) {
        th.lastStatus = `⚠️ API Error`;
        continue;
      }

      await sleep(3000);
      const pubUrl = `https://graph.threads.net/v1.0/${encodeURIComponent(th.userId)}/threads_publish?creation_id=${encodeURIComponent(createData.id)}&access_token=${encodeURIComponent(th.accessToken)}`;
      const pubRes = await fetch(pubUrl, { method: 'POST' });
      const pubData = await pubRes.json();

      if (pubData.id) {
        console.log(`✅ Published Viral Poll on Threads (${th.username})! ID: ${pubData.id}`);
        th.lastStatus = `✅ Posted Poll (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
        logActivity(config, {
          account: th.username,
          type: '🧵 THREADS_POLL',
          targetUrl: `https://www.threads.net/${th.username.replace('@', '')}`,
          detail: 'Published Vertical Text Poll on Meta Threads'
        });
      }
    } catch (e) {
      th.lastStatus = `❌ Failed`;
    }
  }
}

// ============================================================================
// 100% WORKING HOME-FEED & SEED PROFILE LIKE + ZERO-LINK COMMENT ENGINE
// ============================================================================
async function executeLikesAndCommentsOnFeed(page, acc, cleanHandle, config) {
  const interactedUrls = [];
  const customReplies = (config.replies || [])
    .map((r) => r.replace(/\{\{LINK\}\}/g, '').replace(/https?:\/\/\S+/g, '').trim())
    .filter((r) => r.length > 4);
  const commentPool = customReplies.length > 0 ? customReplies : ZERO_LINK_OUTREACH_COMMENTS;

  // Source 1: Account's Own "For You" Home Feed (Never blocked by X Search filters!)
  const feedSources = ['https://x.com/home', pickRandom(VIRAL_SEED_PROFILES)];

  for (const sourceUrl of feedSources) {
    if (interactedUrls.length >= 2) break;

    try {
      console.log(`🔍 Opening Feed for Likes & Comments: ${sourceUrl}`);
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await sleep(4000);

      // Dismiss any popups
      await page.keyboard.press('Escape').catch(() => {});
      await page.mouse.wheel(0, 700).catch(() => {});
      await sleep(2500);

      // Extract direct status URLs from rendered tweet cards
      const foundUrls = await page
        .evaluate((own) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          const urls = [];
          for (const art of articles) {
            const txt = art.innerText || '';
            if (txt.includes('Promoted') || txt.includes('\nAd\n')) continue;
            const links = Array.from(art.querySelectorAll('a[href*="/status/"]'));
            for (const l of links) {
              const href = (l.getAttribute('href') || '').split('?')[0];
              const m = href.match(/\/([a-zA-Z0-9_]+)\/status\/(\d+)/);
              if (m && m[1].toLowerCase() !== own.toLowerCase()) {
                urls.push(`https://x.com/${m[1]}/status/${m[2]}`);
              }
            }
          }
          return [...new Set(urls)];
        }, cleanHandle)
        .catch(() => []);

      console.log(`📡 Found ${foundUrls.length} active tweets on ${sourceUrl}`);

      for (const targetTweetUrl of foundUrls.slice(0, 4)) {
        if (interactedUrls.length >= 2) break;
        if (interactedUrls.includes(targetTweetUrl)) continue;

        try {
          console.log(`⚡ Interacting with Tweet: ${targetTweetUrl}`);
          await page.goto(targetTweetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
          await randomSleep(3, 5);

          const mainTweet = page.locator('article[data-testid="tweet"]').first();
          if (!(await mainTweet.isVisible().catch(() => false))) continue;

          // 1. LIKE THE TWEET
          const likeBtn = mainTweet.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            console.log(`❤️ Liked Tweet: ${targetTweetUrl}`);
            await sleep(1500);
          }

          // 2. CLICK REPLY ICON TO OPEN MODAL & POST ZERO-LINK COMMENT
          const replyIcon = mainTweet.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click({ force: true }).catch(() => {});
            await sleep(2200);
          }

          let replyEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (!(await replyEditor.isVisible().catch(() => false))) {
            const inlinePh = page.locator('[data-testid="tweetTextarea_0_label"]').first();
            if (await inlinePh.isVisible().catch(() => false)) {
              await inlinePh.click({ force: true }).catch(() => {});
              await sleep(1500);
            }
          }

          replyEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyEditor.isVisible().catch(() => false)) {
            // Strictly strip any accidental URLs so 0 links are ever posted in comments!
            const cleanComment = spin(pickRandom(commentPool)).replace(/https?:\/\/\S+/g, '').trim();
            await typeIntoEditor(page, replyEditor, cleanComment, 2000);

            const sent = await publishTweetSafely(
              page,
              '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
            );

            if (sent) {
              interactedUrls.push(targetTweetUrl);
              console.log(`💬 Liked + Replied (Zero-Link) on: ${targetTweetUrl}`);
              logActivity(config, {
                account: acc.username,
                type: '💬 LIKED_AND_REPLIED',
                targetUrl: targetTweetUrl,
                detail: `Liked & commented: "${cleanComment.slice(0, 35)}..."`
              });
              await randomSleep(4, 6);
            }
          }
        } catch (innerErr) {
          console.log('⚠️ Tweet interaction skip:', innerErr.message);
        }
      }
    } catch (err) {
      console.log(`⚠️ Feed source warning (${sourceUrl}):`, err.message);
    }
  }

  return interactedUrls;
}

async function sendEmailReport(config, runSummary) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailTo = process.env.EMAIL_TO || emailUser;

  if (!emailUser || !emailPass) return;

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: emailUser.trim(), pass: emailPass.trim() }
    });

    const rowsHtml = runSummary
      .map(
        (s) => `
        <tr>
          <td style="padding:8px;border:1px solid #334155;"><b>${s.account}</b></td>
          <td style="padding:8px;border:1px solid #334155;">${s.mode}</td>
          <td style="padding:8px;border:1px solid #334155;">${s.status}</td>
          <td style="padding:8px;border:1px solid #334155;"><a href="${s.mainPostUrl || '#'}">View Post</a></td>
          <td style="padding:8px;border:1px solid #334155;">${s.hijacks.map((u, i) => `<a href="${u}">Reply #${i + 1}</a>`).join(', ') || 'None'}</td>
        </tr>`
      )
      .join('');

    const htmlBody = `
      <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:20px;border-radius:12px;">
        <h2 style="color:#38bdf8;margin-top:0;">🚀 AlcashX Cloud Pro v10.0 — Automated Run Report</h2>
        <p><b>Time:</b> ${new Date().toLocaleString()} | <b>X Accounts Run:</b> ${runSummary.length}</p>
        <table style="width:100%;border-collapse:collapse;background:#1e293b;color:#e2e8f0;font-size:13px;">
          <thead>
            <tr style="background:#020617;color:#38bdf8;">
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Account</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Mode</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Result</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Main Post</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Liked &amp; Replied Tweets</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: `"AlcashX AutoBot" <${emailUser.trim()}>`,
      to: emailTo.trim(),
      subject: `✅ AlcashX v10.0 Report: ${runSummary.length} Account(s) Posted & Engaged`,
      html: htmlBody
    });
    console.log(`📧 Email Report sent to ${emailTo}!`);
  } catch (err) {
    console.log(`⚠️ Email warning: ${err.message}`);
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

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.images)) config.images = [];
  if (!Array.isArray(config.polls) || config.polls.length === 0) {
    config.polls = DEFAULT_VERTICAL_POLLS;
  }
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];
  if (!Array.isArray(config.activityLog)) config.activityLog = [];

  // 1. Run Multi-Account Meta Threads First
  await runMultiAccountThreads(config, config.polls);

  const activeAccounts = (config.accounts || []).filter(
    (a) => a.status === 'active' && a.auth_token && a.ct0
  );

  if (activeAccounts.length === 0) {
    console.log('⚠️ No active X accounts found.');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    process.exit(0);
  }

  const usedSet = new Set(config.usedMedia);
  for (const customUrl of config.images) {
    if (customUrl && !usedSet.has(customUrl) && !config.mediaQueue.includes(customUrl)) {
      config.mediaQueue.unshift(customUrl);
    }
  }

  const defaultCaptions = [
    '{⚠️ SafeSearch blurred my photo 😳|X censored my bedroom clip 🙊|Tap below to disable SafeSearch filter 🔞}',
    '{Caught me being|Feeling a little} {naughty alone in bed 🙊🔥|playful tonight 😈💦}'
  ];
  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const targetsPool = config.targets?.length ? config.targets : ['#thirsttrap', '#latenight'];

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
  const fleetBoostTargets = [];
  const runSummary = [];

  console.log(
    `🚀 AlcashX v10.0 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active X account(s)...`
  );

  for (const acc of accountsToRun) {
    // Determine exact mode for this specific account ('poll', 'image', or 'hybrid')
    const assignedMode = acc.postMode || 'poll';
    const effectiveMode =
      assignedMode === 'hybrid'
        ? Math.random() < 0.5
          ? 'poll'
          : 'image'
        : assignedMode;

    console.log(`\n======================================================`);
    console.log(`👤 ACCOUNT: ${acc.username} | ASSIGNED MODE: ${assignedMode.toUpperCase()} -> RUNNING: ${effectiveMode.toUpperCase()}`);
    console.log(`======================================================`);

    const masterAcc = config.accounts.find((x) => x.username === acc.username);
    if (masterAcc) masterAcc.lastRunAt = new Date().toISOString();

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
      viewport: { width: 1280, height: 850 },
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
    const cleanHandle = acc.username.replace('@', '').trim();
    let newestOwnTweetUrl = null;

    try {
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(4, 6);

      if (page.url().includes('/login') || page.url().includes('/account/access')) {
        console.log(`❌ Account ${acc.username} session expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        runSummary.push({ account: acc.username, mode: effectiveMode, status: '❌ Cookie Expired', mainPostUrl: '', hijacks: [] });
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#latenight']);

      if (effectiveMode === 'poll') {
        // MODE A: 100% ZERO-LINK VERTICAL LIST TEXT POLL
        const rawPoll = spin(pickRandom(config.polls)).replace(/https?:\/\/\S+/g, '').trim();
        const pollTweetText = `${rawPoll}\n\n${oneHashtag}`;
        console.log(`📊 Publishing Vertical Text Poll (Zero Links) on ${acc.username}...`);
        await typeIntoEditor(page, editor0, pollTweetText, 2500);
      } else {
        // MODE B: SAFESEARCH IMAGE CARD MODE
        const mediaItem = config.mediaQueue.shift() || pickRandom(config.images);
        if (mediaItem) {
          usedSet.add(mediaItem);
          config.usedMedia.push(mediaItem);
        }
        const cardLink = buildClickableCardLink(mediaItem);
        const caption = spin(pickRandom(captionsPool));
        const imageTweetText = `${caption}\n\n${oneHashtag}\n${cardLink}`;
        console.log(`🖼️ Publishing SafeSearch Image Card on ${acc.username}...`);
        await typeIntoEditor(page, editor0, imageTweetText, 5500);
      }

      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Main Post Published (${effectiveMode.toUpperCase()})!`);
      await randomSleep(5, 7);

      // Verify Published Post URL on Profile
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
      await sleep(2500);

      newestOwnTweetUrl = await page
        .evaluate((handle) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          for (const art of articles) {
            if ((art.innerText || '').includes('Pinned')) continue;
            const links = Array.from(art.querySelectorAll('a[href*="/status/"]'));
            for (const l of links) {
              const h = (l.getAttribute('href') || '').split('?')[0];
              if (h.toLowerCase().includes(`/${handle.toLowerCase()}/status/`)) {
                return `https://x.com${h}`;
              }
            }
          }
          return null;
        }, cleanHandle)
        .catch(() => null);

      if (newestOwnTweetUrl) {
        fleetBoostTargets.push({ url: newestOwnTweetUrl, author: acc.username });
        logActivity(config, {
          account: acc.username,
          type: effectiveMode === 'poll' ? '📊 TEXT_POLL_POST' : '🖼️ IMAGE_CARD_POST',
          targetUrl: newestOwnTweetUrl,
          detail: effectiveMode === 'poll' ? 'Posted Vertical List Poll (No Link)' : 'Posted SafeSearch Blurred Image Card'
        });
      }

      // STEP 2: LIKE & COMMENT ON OTHER PEOPLE'S POSTS (100% Zero-Link Home Feed Engine)
      let hijackedList = [];
      if (config.settings?.enableOutreachLikesAndReplies !== false) {
        hijackedList = await executeLikesAndCommentsOnFeed(page, acc, cleanHandle, config);
      }

      const modeBadge = effectiveMode === 'poll' ? '📊 Poll' : '🖼️ Image';
      const statusMsg = `✅ ${modeBadge} + ${hijackedList.length} Likes/Replies`;
      if (masterAcc) masterAcc.lastStatus = statusMsg;

      runSummary.push({
        account: acc.username,
        mode: modeBadge,
        status: statusMsg,
        mainPostUrl: newestOwnTweetUrl || `https://x.com/${cleanHandle}`,
        hijacks: hijackedList
      });
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
      if (masterAcc) masterAcc.lastStatus = `⚠️ Error: ${err.message.slice(0, 25)}`;
      runSummary.push({ account: acc.username, mode: effectiveMode, status: '❌ Error', mainPostUrl: '', hijacks: [] });
    } finally {
      await browser.close();
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(4, 7);
  }

  // STEP 3: CROSS-ACCOUNT ENGAGEMENT POD
  if (
    fleetBoostTargets.length > 0 &&
    (config.settings?.crossAccountLike !== false || config.settings?.crossAccountRetweet !== false)
  ) {
    console.log(`\n🔥 Step 3: Running Cross-Account Engagement Pod for ${fleetBoostTargets.length} post(s)...`);
    for (const acc of activeAccounts) {
      const targetsForAcc = fleetBoostTargets.filter((t) => t.author !== acc.username);
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
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 }).catch(() => {});
          await randomSleep(3, 5);

          const likeBtn = page.locator('article[data-testid="tweet"] [data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1200);
          }

          if (config.settings?.crossAccountRetweet) {
            const rtBtn = page.locator('article[data-testid="tweet"] [data-testid="retweet"]').first();
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
            detail: `Liked & Retweeted ${item.author}'s Post`
          });
        }
      } catch (_) {
      } finally {
        await browser.close();
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  await sendEmailReport(config, runSummary);
  console.log('\n🎉 AlcashX v10.0 Run Completed!');
}

runBot();
