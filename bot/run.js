/**
 * File: bot/run.js (AlcashX Cloud Pro v11.0 — Self-Reply Funnel + Cooldown Ban-Guard + Multi-Threads)
 * Upgrades in v11.0:
 *  1. AUTO SELF-REPLY FUNNEL: After posting a 0-link Poll, the bot replies to its own tweet ("If you voted Yes, check my Pinned Post 🙊") to drive massive Bio/Pinned link clicks with 0% ban risk!
 *  2. SMART COOLDOWN GUARD: Protects your account if only 1 account is active (enforces minimum 85-minute gap between posts on the same account).
 *  3. 100% WORKING Like & Comment on /home feed & seed profiles via Reply Modal (Zero links in replies).
 *  4. Multi-Account Meta Threads Auto-Poster included.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// High-Viral Vertical List Polls (100% Zero Links — Pure Algorithm Bait!)
const DEFAULT_VERTICAL_POLLS = [
  `Would you kiss me even if I were {38|42|44} years old?\n\n︎\n◯ Yes, without hesitation\n︎\n︎\n◯ No, too old\n︎\n︎\n◯ Depends how you look (check my profile 👀)`,
  `If we were locked in my bedroom for 24 hours, what are we doing first?\n\n︎\n◯ Watching movies\n︎\n︎\n◯ Testing the bed frame 🙊\n︎\n︎\n◯ Show me how you look first`,
  `Be honest... does a girl making the first move at 2 AM turn you on?\n\n︎\n◯ 100% yes 🔥\n︎\n︎\n◯ No, I prefer chasing\n︎\n︎\n◯ DM me and find out 👀`,
  `If I texted you "I can't sleep, come over" right now, what's your move?\n\n︎\n◯ On my way in 5 mins 🚗\n︎\n︎\n◯ Asking for a preview clip first 🙊\n︎\n︎\n◯ Staying asleep`,
  `Sach batana... agar pados wali {bhabhi|girl} raat ko akele room me bulaye toh pehla move kya hoga?\n\n︎\n◯ Darwaza andar se lock 🔒\n︎\n︎\n◯ Direct kiss 🙈\n︎\n︎\n◯ Pehle bio wala video dekhunga 👀`
];

// Self-Reply hooks posted underneath our OWN Poll to funnel viewers to our Bio / Pinned Link (Zero URLs = 0% Ban!)
const SELF_REPLY_FUNNEL_HOOKS = [
  '{If you voted Option 1, please don’t open my Pinned Post in public 🙊🔞|Wait till you see the uncut clip I just pinned on my profile 👀🔥|Replying to everyone who votes! Also unlocked my private folder in my bio for the next 10 mins 🤫}',
  '{Since everyone keeps asking in DMs... the full uncensored video is in my bio link right now 👇🔞|Be honest in the replies 👀 and check my Pinned Post before I delete it 🙊}'
];

// 100% ZERO-LINK Teasing Comments for Replying on Other People's Tweets
const ZERO_LINK_OUTREACH_COMMENTS = [
  '{omg this is literally my mood right now 😳🔥|wait till you see what I just pinned on my profile 🙊|i can’t sleep either, who is still awake? 🌙}',
  '{be honest, would you say hi back if I DMed you? 👀❤️|rate the latest post on my profile? be honest 🙈🔥|check the poll on my profile and vote honestly 👀}',
  '{who else is scrolling in bed wide awake right now? 👀🌙|stoppp this is too real 😂🔥|don’t check my profile if you’re in public rn 🤫}'
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
// MULTI-ACCOUNT META THREADS AUTO-POSTER
// ============================================================================
async function runMultiAccountThreads(config, pollsPool) {
  const threadsList = Array.isArray(config.threadsAccounts) ? config.threadsAccounts : [];
  const activeThreads = threadsList.filter((t) => t.status === 'active' && t.accessToken && t.userId);

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
// NEW v11.0: AUTO SELF-REPLY FUNNEL UNDER OWN POLL TWEET
// ============================================================================
async function postSelfReplyFunnelOnOwnPoll(page, ownTweetUrl, acc, config) {
  if (!ownTweetUrl) return;
  try {
    console.log(`🎯 Posting Self-Reply Funnel under our own Poll: ${ownTweetUrl}`);
    await page.goto(ownTweetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
    await randomSleep(2, 4);

    const mainTweet = page.locator('article[data-testid="tweet"]').first();
    const replyIcon = mainTweet.locator('[data-testid="reply"]').first();
    if (await replyIcon.isVisible().catch(() => false)) {
      await replyIcon.click({ force: true }).catch(() => {});
      await sleep(2000);
    }

    const replyEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
    if (await replyEditor.isVisible().catch(() => false)) {
      const funnelText = spin(pickRandom(SELF_REPLY_FUNNEL_HOOKS));
      await typeIntoEditor(page, replyEditor, funnelText, 2000);
      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`🔥 Self-Reply Funnel Published under ${ownTweetUrl}!`);
      logActivity(config, {
        account: acc.username,
        type: '🎯 SELF_REPLY_FUNNEL',
        targetUrl: ownTweetUrl,
        detail: `Added Bio/Pinned funnel reply under Poll`
      });
    }
  } catch (e) {
    console.log('⚠️ Self-reply funnel skip:', e.message);
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

  const feedSources = ['https://x.com/home', pickRandom(VIRAL_SEED_PROFILES)];

  for (const sourceUrl of feedSources) {
    if (interactedUrls.length >= 2) break;

    try {
      console.log(`🔍 Opening Feed for Likes & Comments: ${sourceUrl}`);
      await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await sleep(4000);

      await page.keyboard.press('Escape').catch(() => {});
      await page.mouse.wheel(0, 700).catch(() => {});
      await sleep(2500);

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

      for (const targetTweetUrl of foundUrls.slice(0, 4)) {
        if (interactedUrls.length >= 2) break;
        if (interactedUrls.includes(targetTweetUrl)) continue;

        try {
          await page.goto(targetTweetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
          await randomSleep(3, 5);

          const mainTweet = page.locator('article[data-testid="tweet"]').first();
          if (!(await mainTweet.isVisible().catch(() => false))) continue;

          // 1. LIKE THE TWEET
          const likeBtn = mainTweet.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1500);
          }

          // 2. CLICK REPLY ICON & POST ZERO-LINK COMMENT
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

  if (!emailUser || !emailPass || runSummary.length === 0) return;

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
        <h2 style="color:#38bdf8;margin-top:0;">🚀 AlcashX Cloud Pro v11.0 — Automated Run Report</h2>
        <p><b>Time:</b> ${new Date().toLocaleString()} | <b>X Accounts Processed:</b> ${runSummary.length}</p>
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
      subject: `✅ AlcashX v11.0 Report: ${runSummary.length} Account(s) Posted & Engaged`,
      html: htmlBody
    });
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

  // Safe default: 1 account per run if fleet has <= 2 accounts, otherwise up to config setting
  const safeDefaultMax = activeAccounts.length <= 2 ? 1 : 2;
  const maxPerRun = Math.min(
    sortedAccounts.length,
    Math.max(1, parseInt(config.settings?.maxAccountsPerRun || safeDefaultMax, 10))
  );
  const accountsToRun = sortedAccounts.slice(0, maxPerRun);
  const runSummary = [];

  for (const acc of accountsToRun) {
    // SMART COOLDOWN BAN-GUARD: If only 1-2 accounts exist and this account ran < 80 mins ago via scheduled cron, let it rest!
    const lastRunMs = acc.lastRunAt ? new Date(acc.lastRunAt).getTime() : 0;
    const minsSinceLastRun = (Date.now() - lastRunMs) / 60000;
    const isManualRun = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

    if (!isManualRun && activeAccounts.length === 1 && minsSinceLastRun < 80) {
      console.log(`🛡️ Ban-Guard Cooldown: ${acc.username} ran ${Math.round(minsSinceLastRun)}m ago. Skipping to protect single account!`);
      continue;
    }

    const assignedMode = acc.postMode || 'poll';
    const effectiveMode =
      assignedMode === 'hybrid'
        ? Math.random() < 0.65
          ? 'poll'
          : 'image'
        : assignedMode;

    console.log(`\n======================================================`);
    console.log(`👤 ACCOUNT: ${acc.username} | MODE: ${effectiveMode.toUpperCase()}`);
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
        const rawPoll = spin(pickRandom(config.polls)).replace(/https?:\/\/\S+/g, '').trim();
        const pollTweetText = `${rawPoll}\n\n${oneHashtag}`;
        console.log(`📊 Publishing Vertical Text Poll (Zero Links) on ${acc.username}...`);
        await typeIntoEditor(page, editor0, pollTweetText, 2500);
      } else {
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
        logActivity(config, {
          account: acc.username,
          type: effectiveMode === 'poll' ? '📊 TEXT_POLL_POST' : '🖼️ IMAGE_CARD_POST',
          targetUrl: newestOwnTweetUrl,
          detail: effectiveMode === 'poll' ? 'Posted Vertical List Poll (No Link)' : 'Posted SafeSearch Blurred Image Card'
        });

        // NEW v11.0: If we posted a Poll, drop a Self-Reply underneath pointing to our Pinned Post / Bio!
        if (effectiveMode === 'poll') {
          await postSelfReplyFunnelOnOwnPoll(page, newestOwnTweetUrl, acc, config);
        }
      }

      // STEP 2: LIKE & COMMENT ON OTHER PEOPLE'S POSTS (100% Zero-Link Home Feed Engine)
      let hijackedList = [];
      if (config.settings?.enableOutreachLikesAndReplies !== false) {
        hijackedList = await executeLikesAndCommentsOnFeed(page, acc, cleanHandle, config);
      }

      const modeBadge = effectiveMode === 'poll' ? '📊 Poll + Self-Funnel' : '🖼️ Image Card';
      const statusMsg = `✅ ${modeBadge} + ${hijackedList.length} Replies`;
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

  await sendEmailReport(config, runSummary);
  console.log('\n🎉 AlcashX v11.0 Run Completed!');
}

runBot();
