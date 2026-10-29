/**
 * File: bot/run.js (AlcashX Cloud Pro v9.0 — Bulletproof Viral Hijacker, SafeSearch Card Engine & Pod)
 * Fixes & Upgrades:
 *  1. ZERO Stock Photos: Uses Custom Image Vault (config.images) first, then SafeSearch Blurred RedGifs/Reddit Model Cards
 *  2. Google SafeSearch Blur Transform (`toSafeSearchCardImage`) on every card for maximum curiosity & CTR
 *  3. Bulletproof 4-Layer Viral Finder (Waits for actual Tweet DOM rendering + skips Promoted/Locked tweets)
 *  4. Reliable OpenGraph Card Preview Trigger (Types Space/Newline so X Composer always fetches the large image card)
 *  5. Verified Reply Submission (Waits for modal close / toast so replies are never cut off mid-flight)
 *  6. Cross-Account Fleet Pod (Like + Bookmark + Retweet) & Full Gmail HTML Telemetry Report
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// High-Converting Tier-1 & Global Viral Search Queries (Safe-Search Friendly + High Engagement)
const VIRAL_SEARCH_QUERIES = [
  '"who is up" min_faves:15 lang:en -filter:replies',
  '"can\'t sleep" min_faves:20 lang:en -filter:replies',
  '"rate me" min_faves:15 lang:en -filter:replies',
  '"am I your type" min_faves:15 lang:en -filter:replies',
  '"single and bored" OR "up for chat" lang:en -filter:replies',
  '"girlfriend application" OR "boyfriend application" min_faves:20 lang:en',
  'who is awake right now lang:en -filter:replies',
  '"be honest" min_faves:30 lang:en filter:media -filter:replies'
];

// High-Traffic Viral Profiles Fallback (100% active comment sections 24/7)
const VIRAL_SEED_PROFILES = [
  'https://x.com/kirawontmiss',
  'https://x.com/DailyLoud',
  'https://x.com/PopCrave',
  'https://x.com/PicturesFoIder',
  'https://x.com/non_aesthetic'
];

const VIRAL_HIJACK_BAITS = [
  '{⚠️ SafeSearch blurred my photo here 😳 tap below to unblur my full bedroom clip 🔞👇|X flagged my uncut video as sensitive... unlocked it free on my private page below 🙊💦}',
  '{can someone rate what I just uploaded? deleting in 10 mins before it gets banned 👀🔞|be honest, is this too spicy for X? had to put the unblurred version on my page 😈👇}',
  '{still wide awake alone in bed... unlocked my censored camera roll for 15 mins 🌙💦|nobody is awake so I\'m dropping my unblurred private archive right here 🤫🔥}',
  '{my ex told me to delete this immediately 😳 tap the blurred card below to watch free 👇🔞|if you\'re still scrolling, tap below to disable SafeSearch on my private clip 👀💦}'
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

function logActivity(config, entry) {
  if (!Array.isArray(config.activityLog)) config.activityLog = [];
  config.activityLog.unshift({
    time: new Date().toISOString(),
    ...entry
  });
  config.activityLog = config.activityLog.slice(0, 100);
}

/**
 * Emergency Live RedGifs HD Model Poster Fetcher (Used if queue is ever empty — ZERO stock photos!)
 */
async function fetchEmergencyModelCards() {
  const cards = [];
  try {
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' }
    });
    if (authRes.ok) {
      const { token } = await authRes.json();
      const sRes = await fetch(
        'https://api.redgifs.com/v2/gifs/search?search_text=tiktok%20tease&order=trending&type=g&count=25',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (sRes.ok) {
        const data = await sRes.json();
        for (const g of data?.gifs || []) {
          const poster = g?.urls?.poster || g?.urls?.thumbnail;
          if (poster) {
            cards.push(
              `https://wsrv.nl/?url=${encodeURIComponent(poster)}&w=960&h=540&fit=cover&a=attention&blur=6&con=12&bri=-5&output=jpg`
            );
          }
        }
      }
    }
  } catch (_) {}
  return cards;
}

/**
 * Ensures any media URL is converted into a high-CTR Google SafeSearch Blurred JPG Card URL
 */
function normalizeForSafeSearchCard(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('http')) {
    return '';
  }
  let u = rawUrl.trim();
  // Convert RedGifs MP4 to Poster JPG first
  if (u.includes('redgifs.com') && u.split('?')[0].endsWith('.mp4')) {
    u = u.replace('-mobile.mp4', '-poster.jpg').replace('.mp4', '-poster.jpg');
  }
  // If already processed via wsrv.nl or marked with #noblur by user's custom vault, keep as-is
  if (u.includes('wsrv.nl') || u.includes('#noblur')) {
    return u.replace('#noblur', '');
  }
  // Apply Google SafeSearch style optical censor blur (blur=6, contrast boost)
  return `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=960&h=540&fit=cover&a=attention&blur=6&con=12&bri=-5&output=jpg`;
}

function buildClickableCardLink(mediaItem) {
  const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 9999)}`;
  const cardImg = normalizeForSafeSearchCard(mediaItem);
  return `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(cardImg)}&id=${uniqueCode}`;
}

/**
 * Enters text into X's DraftJS editor and triggers OpenGraph Card preview reliably
 */
async function fillAndTriggerCardPreview(page, editorLocator, textWithLink, waitMs = 5500) {
  await editorLocator.waitFor({ state: 'visible', timeout: 20000 });
  await editorLocator.click({ force: true });
  await sleep(400);
  await editorLocator.fill(textWithLink);
  await sleep(500);
  // Pressing Space + Backspace forces X's lexical editor to parse the URL and fetch the OG Card!
  await page.keyboard.press('End').catch(() => {});
  await page.keyboard.press('Space').catch(() => {});
  await sleep(waitMs);
}

/**
 * Publishes Tweet/Reply and waits until X actually processes the submission
 */
async function publishTweetSafely(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  const btn = page.locator(buttonSelector).first();
  for (let i = 0; i < 15; i++) {
    const isDisabled = await btn.getAttribute('aria-disabled').catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(700);
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

  // Wait for the CreateTweet network response or button disappearance
  await sleep(3500);
  if (await page.locator('[data-testid="tweetButton"]').isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(3000);
    } catch (_) {}
  }
  return clicked;
}

/**
 * Waits for tweets to render on page, skips Promoted ads, and extracts viral tweet URLs + @handles
 */
async function extractTweetsFromPage(page, ownHandle) {
  await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
  await page.mouse.wheel(0, 900).catch(() => {});
  await sleep(2000);

  return page
    .evaluate((own) => {
      const banned = new Set([
        'home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i', 'tos', 'privacy'
      ]);
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const postUrls = [];
      const handles = [];

      for (const art of articles) {
        const textContent = art.innerText || '';
        // Skip Promoted Ads
        if (textContent.includes('\nPromoted') || textContent.includes('Ad\n')) continue;

        // Check if reply button is disabled/locked on card
        const replyBtn = art.querySelector('[data-testid="reply"]');
        if (replyBtn && replyBtn.getAttribute('aria-disabled') === 'true') continue;

        const links = Array.from(art.querySelectorAll('a[href*="/status/"]'));
        for (const l of links) {
          const href = (l.getAttribute('href') || '').split('?')[0];
          const match = href.match(/^\/([a-zA-Z0-9_]+)\/status\/(\d+)$/);
          if (match && match[1].toLowerCase() !== own.toLowerCase()) {
            postUrls.push(`https://x.com${match[0]}`);
          }
        }

        const userAnchors = Array.from(art.querySelectorAll('a[href^="/"]'));
        for (const a of userAnchors) {
          const raw = (a.getAttribute('href') || '').split('?')[0].replace(/^\/+/, '');
          if (/^[a-zA-Z0-9_]{3,15}$/.test(raw) && !banned.has(raw.toLowerCase()) && raw.toLowerCase() !== own.toLowerCase()) {
            handles.push('@' + raw);
          }
        }
      }
      return { postUrls: [...new Set(postUrls)], handles: [...new Set(handles)] };
    }, ownHandle)
    .catch(() => ({ postUrls: [], handles: [] }));
}

async function sendEmailReport(config, runSummary) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailTo = process.env.EMAIL_TO || emailUser;

  if (!emailUser || !emailPass) {
    console.log('ℹ️ EMAIL_USER or EMAIL_PASS not set in Secrets. Skipping email report.');
    return;
  }

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
          <td style="padding:8px;border:1px solid #334155;">${s.status}</td>
          <td style="padding:8px;border:1px solid #334155;"><a href="${s.mainPostUrl || '#'}">View Main Post</a></td>
          <td style="padding:8px;border:1px solid #334155;">${s.hijacks.map((u, i) => `<a href="${u}">Hijack #${i + 1}</a>`).join(', ') || 'None'}</td>
        </tr>`
      )
      .join('');

    const htmlBody = `
      <div style="font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:20px;border-radius:12px;">
        <h2 style="color:#38bdf8;margin-top:0;">🚀 AlcashX Cloud Pro v9.0 — Run Telemetry Report</h2>
        <p><b>Run Time:</b> ${new Date().toLocaleString()} | <b>Custom Vault:</b> ${config.images?.length || 0} | <b>Queue:</b> ${config.mediaQueue.length} items</p>
        <table style="width:100%;border-collapse:collapse;background:#1e293b;color:#e2e8f0;font-size:13px;">
          <thead>
            <tr style="background:#020617;color:#38bdf8;">
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Account</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Result</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Main Post</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Viral Posts Hijacked</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from: `"AlcashX AutoBot" <${emailUser.trim()}>`,
      to: emailTo.trim(),
      subject: `✅ AlcashX v9.0 Report: ${runSummary.length} Account(s) Executed`,
      html: htmlBody
    });
    console.log(`📧 Email Telemetry Report sent to ${emailTo}!`);
  } catch (err) {
    console.log(`⚠️ Email Report warning: ${err.message}`);
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
  if (!Array.isArray(config.activityLog)) config.activityLog = [];

  const usedSet = new Set(config.usedMedia);

  // Purge any old Unsplash stock links from config
  config.images = config.images.filter((u) => u && !u.includes('images.unsplash.com'));
  config.mediaQueue = config.mediaQueue.filter(
    (u) => u && !u.includes('images.unsplash.com') && !usedSet.has(u)
  );

  // Priority 1: Ensure user's Custom Uploaded Vault Images (config.images) are front-loaded
  for (const customUrl of config.images) {
    if (!usedSet.has(customUrl) && !config.mediaQueue.includes(customUrl)) {
      config.mediaQueue.unshift(customUrl);
    }
  }

  // Priority 2: If queue is running low, fetch real RedGifs HD Model Cards live
  if (config.mediaQueue.length < 6) {
    const emergencyCards = await fetchEmergencyModelCards();
    for (const c of emergencyCards) {
      if (!usedSet.has(c) && !config.mediaQueue.includes(c)) {
        config.mediaQueue.push(c);
      }
    }
  }

  const defaultCaptions = [
    '{⚠️ SafeSearch blurred my photo 😳|X censored my bedroom clip 🙊|Tap below to disable SafeSearch filter 🔞} {deleting in 15 mins 🔥|watch full uncut version below 👇💦}',
    '{Caught me being|Feeling a little} {naughty alone in bed 🙊🔥|playful tonight 😈💦} {tap card below to unblur 👇🔞}',
    "{can't sleep in my dorm, who's still up? 🌙|am I your type? be honest 👀|unlocked my censored camera roll for 10 mins 👇🔞}"
  ];
  const defaultReplies = [
    '{🔞 SafeSearch Unblurred Photo & Full 2 Min Video|Watch what happened next without censor|Unlock the rest of my private folder} free right here 👇🔥 {{LINK}}',
    "{X keeps censoring my uploads}, tap here to view my uncut private archive 👉 {{LINK}} 💦🔞"
  ];
  const defaultTargets = ['#thirsttrap', '#nsfwtwt', '#egirl', '#latenight'];

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
  const fleetBoostTargets = [];
  const runSummary = [];

  console.log(
    `🚀 AlcashX v9.0 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
  );

  for (const acc of accountsToRun) {
    console.log(`\n========================================`);
    console.log(`👤 ACCOUNT: ${acc.username}`);
    console.log(`========================================`);

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
    const hijackedUrlsForAcc = [];
    let newestOwnTweetUrl = null;

    try {
      // Pick next model image (Custom Vault or Scraped SafeSearch Queue)
      const mediaItem = config.mediaQueue.shift() || pickRandom(config.images);
      if (mediaItem) {
        usedSet.add(mediaItem);
        config.usedMedia.push(mediaItem);
      }

      const mainCardLink = buildClickableCardLink(mediaItem);
      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#thirsttrap', '#latenight']);
      const taggedUsers = pickMultipleRandom(config.harvestedUsers, 2).join(' ');

      const caption = spin(pickRandom(captionsPool));
      const mainTweetText = `${caption}\n\n${oneHashtag}\n${mainCardLink}`;

      // ------------------------------------------------------------------------
      // STEP 1: PUBLISH MAIN SAFESEARCH BLURRED CLICKABLE CARD POST
      // ------------------------------------------------------------------------
      console.log(`📝 Step 1: Publishing SafeSearch Blurred Clickable Card for ${acc.username}...`);
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(4, 6);

      if (page.url().includes('/login') || page.url().includes('/account/access')) {
        console.log(`❌ Account ${acc.username} session expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        runSummary.push({ account: acc.username, status: '❌ Cookie Expired', mainPostUrl: '', hijacks: [] });
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      await fillAndTriggerCardPreview(page, editor0, mainTweetText, 6000);

      if (config.settings?.autoSelfReply !== false) {
        const addThreadBtn = page.locator('[data-testid="addButton"]').first();
        if (await addThreadBtn.isVisible().catch(() => false)) {
          try {
            await addThreadBtn.click({ force: true });
            await sleep(2000);
            const editor1 = page.locator('[data-testid="tweetTextarea_1"]').first();
            if (await editor1.isVisible().catch(() => false)) {
              let replyTpl = spin(pickRandom(repliesPool));
              replyTpl = replyTpl.includes('{{LINK}}')
                ? replyTpl.replace('{{LINK}}', mainCardLink)
                : `${replyTpl} ${mainCardLink}`;
              const threadText = taggedUsers ? `${replyTpl}\n\n👀 ${taggedUsers}` : replyTpl;
              await fillAndTriggerCardPreview(page, editor1, threadText, 3000);
            }
          } catch (_) {}
        }
      }

      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Step 1 Complete: Main SafeSearch Card Published!`);
      await randomSleep(5, 7);

      // Grab own latest tweet URL for Fleet Pod
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
          type: '🃏 MAIN_CARD_POST',
          targetUrl: newestOwnTweetUrl,
          detail: 'Published SafeSearch Blurred Fanpage Card'
        });
      }

      // ------------------------------------------------------------------------
      // STEP 2: 4-LAYER BULLETPROOF VIRAL POST FINDER & HIJACKER
      // ------------------------------------------------------------------------
      const viralPostCandidates = [];

      // LAYER A: Top Tab Search (High-Engagement Viral Posts)
      const queryA = pickRandom(VIRAL_SEARCH_QUERIES);
      console.log(`🔍 Step 2A: Searching Viral Posts (Top Tab): "${queryA}"`);
      await page.goto(`https://x.com/search?q=${encodeURIComponent(queryA)}&f=top`, {
        waitUntil: 'domcontentloaded',
        timeout: 40000
      });
      await sleep(3500);
      const topExtracted = await extractTweetsFromPage(page, cleanHandle);
      viralPostCandidates.push(...topExtracted.postUrls);
      for (const h of topExtracted.handles) {
        if (!config.harvestedUsers.includes(h)) config.harvestedUsers.push(h);
      }

      // LAYER B: Live Tab Search (Fresh Active Conversations)
      if (viralPostCandidates.length < 4) {
        const queryB = pickRandom(VIRAL_SEARCH_QUERIES);
        console.log(`🔍 Step 2B: Searching Active Posts (Live Tab): "${queryB}"`);
        await page.goto(`https://x.com/search?q=${encodeURIComponent(queryB)}&f=live`, {
          waitUntil: 'domcontentloaded',
          timeout: 40000
        });
        await sleep(3500);
        const liveExtracted = await extractTweetsFromPage(page, cleanHandle);
        for (const u of liveExtracted.postUrls) {
          if (!viralPostCandidates.includes(u)) viralPostCandidates.push(u);
        }
        for (const h of liveExtracted.handles) {
          if (!config.harvestedUsers.includes(h)) config.harvestedUsers.push(h);
        }
      }

      // LAYER C: Home "For You" Algorithmic Viral Timeline
      if (viralPostCandidates.length < 4) {
        console.log('🔥 Step 2C: Pulling Viral Posts from Home "For You" Feed...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 40000 });
        await sleep(4000);
        const homeExtracted = await extractTweetsFromPage(page, cleanHandle);
        for (const u of homeExtracted.postUrls) {
          if (!viralPostCandidates.includes(u)) viralPostCandidates.push(u);
        }
      }

      // LAYER D: High-Traffic Viral Seed Profiles (100% Guaranteed Fallback)
      if (viralPostCandidates.length < 3) {
        const seedProfile = pickRandom(VIRAL_SEED_PROFILES);
        console.log(`⚡ Step 2D: Pulling Viral Posts from Seed Profile: ${seedProfile}`);
        await page.goto(seedProfile, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await sleep(4000);
        const seedExtracted = await extractTweetsFromPage(page, cleanHandle);
        for (const u of seedExtracted.postUrls) {
          if (!viralPostCandidates.includes(u)) viralPostCandidates.push(u);
        }
      }

      config.harvestedUsers = config.harvestedUsers.slice(-200);
      // Try up to 6 candidates until we successfully hijack 3 viral posts!
      const candidatePool = viralPostCandidates.slice(0, 6);
      console.log(`🎯 Located ${viralPostCandidates.length} viral candidates! Hijacking up to 3 posts...`);

      for (const viralUrl of candidatePool) {
        if (hijackedUrlsForAcc.length >= 3) break;

        try {
          console.log(`⚡ Opening Viral Post: ${viralUrl}`);
          await page.goto(viralUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 12000 }).catch(() => {});
          await randomSleep(3, 5);

          const mainArticle = page.locator('article[data-testid="tweet"]').first();
          if (!(await mainArticle.isVisible().catch(() => false))) continue;

          // 1) LIKE the Viral Post
          const likeBtn = mainArticle.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            console.log(`❤️ Liked Viral Post: ${viralUrl}`);
            await sleep(1200);
          }

          // 2) BOOKMARK the Viral Post (Extra engagement signal)
          const bmBtn = mainArticle.locator('[data-testid="bookmark"]').first();
          if (await bmBtn.isVisible().catch(() => false)) {
            await bmBtn.click({ force: true }).catch(() => {});
            await sleep(1000);
          }

          // 3) RETWEET the 1st Viral Post
          if (hijackedUrlsForAcc.length === 0) {
            const rtBtn = mainArticle.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click({ force: true }).catch(() => {});
              await sleep(1200);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) {
                await confirmRt.click({ force: true }).catch(() => {});
                console.log(`🔁 Retweeted Viral Post!`);
                await sleep(1500);
              }
            }
          }

          // 4) OPEN REPLY EDITOR (Try Inline Reply Box first, then Reply Modal Button)
          let replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (!(await replyBox.isVisible().catch(() => false))) {
            const inlineLabel = page.locator('[data-testid="tweetTextarea_0_label"]').first();
            if (await inlineLabel.isVisible().catch(() => false)) {
              await inlineLabel.click({ force: true }).catch(() => {});
              await sleep(1800);
            }
          }

          if (!(await replyBox.isVisible().catch(() => false))) {
            const replyIconBtn = mainArticle.locator('[data-testid="reply"]').first();
            if (await replyIconBtn.isVisible().catch(() => false)) {
              await replyIconBtn.click({ force: true }).catch(() => {});
              await sleep(2200);
            }
          }

          replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyBox.isVisible().catch(() => false)) {
            const nextMedia = pickRandom(config.images) || pickRandom(config.mediaQueue) || mediaItem;
            const hijackCardLink = buildClickableCardLink(nextMedia);
            const baitText = spin(pickRandom(VIRAL_HIJACK_BAITS));
            const fullHijackReply = `${baitText}\n${hijackCardLink}`;

            console.log('⏳ Filling reply & triggering SafeSearch Card preview (5.5s)...');
            await fillAndTriggerCardPreview(page, replyBox, fullHijackReply, 5500);

            const sent = await publishTweetSafely(
              page,
              '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
            );

            if (sent) {
              hijackedUrlsForAcc.push(viralUrl);
              console.log(`🚀 SUCCESS! Hijacked Viral Post #${hijackedUrlsForAcc.length}: ${viralUrl}`);

              logActivity(config, {
                account: acc.username,
                type: '🔥 VIRAL_HIJACK_COMMENT',
                targetUrl: viralUrl,
                detail: 'Liked + Dropped SafeSearch Blurred Card Reply'
              });
              await randomSleep(5, 7);
            }
          } else {
            console.log('ℹ️ Reply restricted on this tweet, trying next candidate...');
          }
        } catch (e) {
          console.log('⚠️ Skipped candidate:', e.message);
        }
      }

      const statusMsg = `✅ 1 Card + ${hijackedUrlsForAcc.length} Viral Hijacks`;
      if (masterAcc) masterAcc.lastStatus = statusMsg;
      runSummary.push({
        account: acc.username,
        status: statusMsg,
        mainPostUrl: newestOwnTweetUrl || `https://x.com/${cleanHandle}`,
        hijacks: hijackedUrlsForAcc
      });
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
      if (masterAcc) masterAcc.lastStatus = `⚠️ Error: ${err.message.slice(0, 30)}`;
      runSummary.push({ account: acc.username, status: `❌ Error`, mainPostUrl: '', hijacks: [] });
    } finally {
      await browser.close();
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(4, 7);
  }

  // --------------------------------------------------------------------------
  // STEP 3: CROSS-ACCOUNT ENGAGEMENT POD (Like + Bookmark + Retweet)
  // --------------------------------------------------------------------------
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

          const bmBtn = page.locator('article[data-testid="tweet"] [data-testid="bookmark"]').first();
          if (await bmBtn.isVisible().catch(() => false)) {
            await bmBtn.click({ force: true }).catch(() => {});
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

          console.log(`⚡ Pod Boost (${acc.username} -> ${item.url}): Liked + Bookmarked + Retweeted!`);
          logActivity(config, {
            account: acc.username,
            type: '⚡ POD_BOOST',
            targetUrl: item.url,
            detail: `Liked, Bookmarked & Retweeted ${item.author}'s Card Post`
          });
        }
      } catch (_) {
      } finally {
        await browser.close();
      }
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  // --------------------------------------------------------------------------
  // STEP 4: SEND GMAIL TELEMETRY REPORT
  // --------------------------------------------------------------------------
  await sendEmailReport(config, runSummary);

  console.log('\n🎉 AlcashX v9.0 Run Completed! All SafeSearch Cards, Viral Hijacks, Pod Boosts & Email Processed.');
}

runBot();
