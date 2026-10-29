/**
 * File: bot/run.js
 * AlcashX Cloud Pro v7.0 — Clickable Fanpage Card Engine (Zero X Blur + Direct Link Clicks!)
 * Strategy:
 *  - Instead of uploading native files (which X converts into non-clickable pic.x.com links and blurs),
 *    v7.0 posts your Cloaked Vercel Fanpage URL directly so X renders a massive CLICKABLE IMAGE CARD!
 *  - Every single tap on the image opens your Vercel Fanpage -> Adsterra Direct Link!
 *  - Uses Tier-1 "Call Me / Private Cam / Tap to Unblur" hooks for maximum USA/UK reach & zero bans.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

const FALLBACK_IMAGES = [
  'https://wsrv.nl/?url=https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e&w=900&h=500&fit=cover&blur=10&output=jpg',
  'https://wsrv.nl/?url=https://images.unsplash.com/photo-1517841905240-472988babdf9&w=900&h=500&fit=cover&blur=10&output=jpg',
  'https://wsrv.nl/?url=https://images.unsplash.com/photo-1534528741775-53994a69daeb&w=900&h=500&fit=cover&blur=10&output=jpg'
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

async function typeIntoXEditor(page, editorLocator, text) {
  await editorLocator.waitFor({ state: 'visible', timeout: 20000 });
  await editorLocator.click({ force: true });
  await sleep(500);
  await editorLocator.fill(text);
  await sleep(600);
  await page.keyboard.type(' ');
  await sleep(400);
}

async function publishTweetAndWait(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(600);

  for (let i = 0; i < 20; i++) {
    const btn = page.locator(buttonSelector).first();
    const isDisabled = await btn.getAttribute('aria-disabled').catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(1000);
  }

  await sleep(1500);

  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(4000);
    } catch (_) {}
  }

  if (await btn.isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(3500);
    } catch (_) {}
  }

  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 8000 });
      await sleep(3500);
    } catch (_) {}
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

async function sendEmailReport(config, runSummaryRows) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) return;

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass }
    });

    const runActionsHtml = runSummaryRows.map((r) => `<li style="margin-bottom:6px;">${r}</li>`).join('');
    const htmlBody = `
      <div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:20px;border-radius:12px;">
        <h2 style="color:#38bdf8;margin-top:0;">🚀 AlcashX v7.0 — Clickable Card Run Report</h2>
        <p style="color:#94a3b8;font-size:13px;">Time (IST): <b>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b></p>
        <ul style="font-size:14px;line-height:1.6;">${runActionsHtml}</ul>
        <p style="font-size:12px;color:#94a3b8;">Remaining Queue: ${(config.mediaQueue || []).length} images | Active @Users: ${(config.harvestedUsers || []).length}</p>
      </div>`;

    await transporter.sendMail({
      from: `"AlcashX AutoBot" <${emailUser}>`,
      to: emailUser,
      subject: `✅ AlcashX v7.0 Report — ${runSummaryRows.length} Clickable Cards Published`,
      html: htmlBody
    });
    console.log('📧 Email Report sent!');
  } catch (err) {
    console.log('⚠️ Email report skipped:', err.message);
  }
}

async function runBot() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const configPath = path.join(dataDir, 'config.json');

  if (!fs.existsSync(configPath)) process.exit(0);

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const activeAccounts = (config.accounts || []).filter(
    (a) => a.status === 'active' && a.auth_token && a.ct0
  );
  if (activeAccounts.length === 0) process.exit(0);

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];
  if (!Array.isArray(config.activityLog)) config.activityLog = [];

  const usedSet = new Set(config.usedMedia);

  // Filter out old .mp4 links so we only use High-Reach Image Cards
  config.mediaQueue = config.mediaQueue.filter(
    (u) => u && !usedSet.has(u) && !u.endsWith('.mp4') && !u.includes('redgifs.com')
  );

  if (config.mediaQueue.length === 0) {
    config.mediaQueue.push(...FALLBACK_IMAGES);
  }

  // Tier-1 High-Reach "Call Me / Tap to Unblur / Live Room" Hooks (Zero Adult Filter Trigger!)
  const tier1CardHooks = [
    '{I am online on private cam right now 🟢|Feeling lonely in my room tonight 🌙|Anyone awake for a 1-on-1 video call? 📞} {Tap my card below to connect free 👇|Click the image below to join my room 👇}',
    '{Had to blur this photo so X doesn\'t delete it 🙊|Tap the blurred image below to see the uncensored version 👇|Tap the photo card below to unlock full resolution 🔓👀}',
    '{Free for a private video call for the next 20 mins 📞💚|Who wants my private room link? Tap below before I lock it 👇|Tap the preview below to open my private feed 🔥}'
  ];

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
  const runSummaryRows = [];

  console.log(`🚀 AlcashX v7.0 (Clickable Card Mode): Running ${accountsToRun.length} account(s)...`);

  for (const acc of accountsToRun) {
    console.log(`\n👤 Account: ${acc.username}`);
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

    try {
      // 1. Pick Unique Image URL for the Clickable Card
      const mediaItem = config.mediaQueue.shift() || pickRandom(FALLBACK_IMAGES);
      usedSet.add(mediaItem);
      config.usedMedia.push(mediaItem);

      // Force a pre-blurred version of the image for the X Card so X AI NEVER flags it AND users click to unblur!
      const cardImageParam = mediaItem.includes('wsrv.nl')
        ? mediaItem
        : `https://wsrv.nl/?url=${encodeURIComponent(mediaItem)}&w=900&h=500&fit=cover&blur=11&output=jpg`;

      const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 999)}`;
      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(cardImageParam)}&id=${uniqueCode}`;

      const safeHashtags = ['#latenight', '#girlfriend', '#selfie', '#dating', '#facetime'];
      const oneTag = pickRandom(safeHashtags);
      const userMentions = pickMultipleRandom(config.harvestedUsers, 2).join(' ');

      const hookText = spin(pickRandom(tier1CardHooks));
      // Notice: We put the Cloaked Fanpage Link DIRECTLY in the tweet (NO native file upload!)
      // So X renders a massive Clickable Website Card instead of pic.x.com!
      const fullCardTweet = `${hookText}\n\n${cloakedLink}\n\n${[oneTag, userMentions].filter(Boolean).join(' ')}`;

      // 2. Open Compose & Publish Clickable Fanpage Card
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 7);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/account/access')) {
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        runSummaryRows.push(`<b>${acc.username}</b>: ❌ Cookie Expired / Locked`);
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      await typeIntoXEditor(page, editor0, fullCardTweet);

      // Wait 7 seconds so X's Card Scraper fetches your Vercel URL and renders the Clickable Blurred Card Preview!
      console.log(`🃏 Waiting 7s for X to render Clickable Blurred Fanpage Card: ${cloakedLink}`);
      await randomSleep(6, 8);

      await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Clickable Fanpage Card Published on ${acc.username}!`);
      await randomSleep(6, 8);

      // 3. Verify Published URL on Profile
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(4, 6);

      const newestHref = await page
        .evaluate((handle) => {
          const links = Array.from(document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]'));
          let bestHref = null;
          let maxId = 0n;
          for (const a of links) {
            const h = (a.getAttribute('href') || '').split('?')[0];
            const m = h.match(new RegExp(`^/${handle}/status/(\\d+)$`, 'i'));
            if (m && m[1]) {
              const idNum = BigInt(m[1]);
              if (idNum > maxId) {
                maxId = idNum;
                bestHref = h;
              }
            }
          }
          return bestHref;
        }, cleanHandle)
        .catch(() => null);

      const publishedUrl = newestHref ? `https://x.com${newestHref}` : `https://x.com/${cleanHandle}`;
      newlyPublishedTweets.push({ url: publishedUrl, author: acc.username });

      logActivity(config, {
        account: acc.username,
        type: '🃏 CLICKABLE_CARD_POST',
        targetUrl: publishedUrl,
        mediaUrl: cardImageParam,
        detail: `Published Unblurred Clickable Fanpage Card (${cloakedLink})`
      });

      // 4. TIER-1 USA/UK LIVE OUTREACH & HIJACKER
      const tier1Queries = [
        '"can\'t sleep" min_faves:5 lang:en',
        '"who is awake" min_faves:3 lang:en',
        '"bored" min_faves:15 lang:en',
        '"need a gf" min_faves:3 lang:en',
        '"facetime" min_faves:5 lang:en'
      ];
      const chosenQuery = pickRandom(tier1Queries);
      console.log(`🔍 Searching Tier-1 English Feed: ${chosenQuery}`);

      await page.goto(`https://x.com/search?q=${encodeURIComponent(chosenQuery)}&f=live`, {
        waitUntil: 'domcontentloaded',
        timeout: 40000
      });
      await randomSleep(5, 7);

      const scrapedHandles = await page
        .evaluate(() => {
          const banned = new Set(['home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i']);
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
      for (const h of scrapedHandles) {
        if (h.toLowerCase() !== ownHandleLower && !config.harvestedUsers.includes(h)) {
          config.harvestedUsers.push(h);
        }
      }
      config.harvestedUsers = config.harvestedUsers.slice(-150);

      // Hijack Top 2 Tier-1 Posts with Clickable Card Link!
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
            await sleep(1000);
          }

          const replyIcon = mainArticle.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click({ force: true }).catch(() => {});
            await sleep(2000);
          }

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            const hijackCardReply = spin(
              `{i'm wide awake too 😊 tap my card below to video call me right now 📞💚|can't sleep either! tap the blurred photo below to unlock my private room 🙊👇}\n${cloakedLink}`
            );
            await typeIntoXEditor(page, replyInput, hijackCardReply);
            await randomSleep(5, 7); // Let X load the clickable card inside the reply too!
            await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
            hijackedCount++;

            logActivity(config, {
              account: acc.username,
              type: '💬 CARD_HIJACK_REPLY',
              targetUrl: targetPostUrl,
              detail: `Dropped Clickable Fanpage Card on Tier-1 Post`
            });
            await randomSleep(4, 6);
          }
        } catch (_) {}
      }

      if (masterAcc) masterAcc.lastStatus = `✅ Clickable Card + ${hijackedCount} Tier-1 Hijacks`;
      runSummaryRows.push(
        `<b>${acc.username}</b>: ✅ Clickable Card Published (<a href="${publishedUrl}">View Tweet</a>) + ${hijackedCount} Tier-1 Hijacks`
      );
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
    } finally {
      await browser.close();
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(5, 8);
  }

  await sendEmailReport(config, runSummaryRows);
  console.log('\n🎉 Run v7.0 (Clickable Blurred Card Engine) Completed!');
}

runBot();
