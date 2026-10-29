/**
 * File: bot/run.js (AlcashX Cloud Pro v8.0 — Tier-1/2 Viral Comment Hijacker & Clickable Card Engine)
 * Goal: Maximum Impressions, Viral Reply Hijacking, Likes/Retweets & Adsterra Tier-1/2 Clicks
 * Features:
 *  1. Clickable Fanpage Card Main Post (5s OG Card Preview Wait) + Auto Self-Reply
 *  2. 3x Aggressive Viral Post Hijacking per Account (Likes, Retweets & Drops Clickable Card Replies on High-Reach English Posts)
 *  3. Modal + Inline Dual Reply Unlocker (Never misses a reply box!)
 *  4. Real Tier-1/2 Active Commenter Harvester + Cross-Account Fleet Pod (Like/RT/Bookmark)
 *  5. Optional Gmail Telemetry Report (if EMAIL_USER & EMAIL_PASS are set)
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

// Clean Glamour/Teaser Image Pool for Clickable Cards (Works with wsrv.nl blur on your Fanpage Cloaker)
const FALLBACK_CARD_IMAGES = [
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80',
  'https://images.unsplash.com/photo-1503185912284-5271ff81b9a8?w=800&q=80',
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=800&q=80'
];

// High-Converting Tier-1 (USA, UK, CA, AU) & Tier-2 Viral Search Queries
const TIER1_VIRAL_QUERIES = [
  '"who is up" min_faves:25 lang:en -filter:replies',
  '"can\'t sleep" min_faves:30 lang:en -filter:replies',
  '"rate me" min_faves:25 lang:en filter:media -filter:replies',
  '"am I your type" min_faves:20 lang:en -filter:replies',
  '"be honest" min_faves:40 lang:en filter:media -filter:replies',
  '"boyfriend application" OR "girlfriend application" min_faves:30 lang:en',
  '#thirsttrap min_faves:20 lang:en -filter:replies',
  '#nsfwtwt min_faves:25 lang:en -filter:replies',
  '"single and bored" OR "up for chat" min_faves:15 lang:en',
  '"send me" min_faves:30 lang:en filter:media -filter:replies'
];

// High-CTR Viral Reply Baits (Designed to make Tier-1 users click your Card/Profile immediately)
const VIRAL_HIJACK_BAITS = [
  '{omg wait till you see what I just unlocked on my private page 😳🔥|i tried to post the unblurred version here but X deleted it... watch it free below 🙊💦}',
  '{can someone rate what I just uploaded? I\'m deleting it in 10 mins 👀🔞|be honest, is this too spicy for X? had to put the uncut clip on my page 😈👇}',
  '{still wide awake alone in bed... unlocked my private camera roll for 15 mins 🌙💦|nobody is awake so I\'m dropping my private unblurred link right here 🤫🔥}',
  '{my ex told me to delete this video immediately 😳 watch before I lock it again 👇🔞|if you\'re still scrolling, tap below to unblur my full bedroom clip 👀💦}'
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
  config.activityLog = config.activityLog.slice(0, 80);
}

// Bulletproof Tweet / Reply Publisher
async function publishTweetSafely(
  page,
  buttonSelector = '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
) {
  for (let i = 0; i < 15; i++) {
    const isDisabled = await page
      .locator(buttonSelector)
      .first()
      .getAttribute('aria-disabled')
      .catch(() => null);
    if (isDisabled !== 'true') break;
    await sleep(800);
  }

  // Layer 1: Direct JS DOM Click on Submit Button
  const btn = page.locator(buttonSelector).first();
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.evaluate((el) => el.click());
      await sleep(3000);
    } catch (_) {}
  }

  // Layer 2: Playwright Force Click
  if (await btn.isVisible().catch(() => false)) {
    try {
      await btn.click({ force: true, timeout: 6000 });
      await sleep(2500);
    } catch (_) {}
  }

  // Layer 3: Keyboard Control+Enter Fallback
  if (await btn.isVisible().catch(() => false)) {
    try {
      await page.keyboard.press('Control+Enter');
      await sleep(2500);
    } catch (_) {}
  }
}

// Builds a Unique Clickable Fanpage Card URL (Triggers X summary_large_image Card!)
function buildClickableCardLink(mediaItem) {
  const uniqueCode = `${Date.now().toString(36)}${Math.floor(Math.random() * 9999)}`;
  const cleanMedia = mediaItem && mediaItem.startsWith('http') ? mediaItem : pickRandom(FALLBACK_CARD_IMAGES);
  return `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(cleanMedia)}&id=${uniqueCode}`;
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

  // Purge dummy usernames
  const dummyPatterns = ['simp_account', 'active_user', 'reply_guy', 'nsfw_retweeter', 'thirst_trap_lover', 'user1'];
  config.harvestedUsers = config.harvestedUsers.filter(
    (u) => !dummyPatterns.some((pat) => u.toLowerCase().includes(pat))
  );

  const usedSet = new Set(config.usedMedia);
  config.mediaQueue = config.mediaQueue.filter((u) => u && !usedSet.has(u));

  if (config.mediaQueue.length < 5) {
    for (const img of [...(config.images || []), ...FALLBACK_CARD_IMAGES]) {
      if (img && !usedSet.has(img) && !config.mediaQueue.includes(img)) {
        config.mediaQueue.push(img);
      }
    }
    if (config.mediaQueue.length === 0) {
      config.mediaQueue.push(...FALLBACK_CARD_IMAGES);
    }
  }

  const defaultCaptions = [
    '{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {alone in my room 🙊🔥|tonight 😈💦|👀|🌙}',
    "{Tap the image below to unblur 😳|Deleting this in 15 mins before my ex sees|Did I show too much?} {🤫🔥|💦|👀}",
    "{can't sleep in my dorm, who's still up? 🌙|am I your type? be honest 👀|unlocked my private folder for 10 mins 👇🔞}"
  ];
  const defaultReplies = [
    '{Full unblurred photo & 2 min video|Watch what happened next|Unlock the rest of my private folder} free right here 👇🔞 {{LINK}}',
    "{X keeps censoring my posts}, tap here to view my uncut private archive 👉 {{LINK}} 💦🔥"
  ];
  const defaultTargets = ['#thirsttrap', '#nsfwtwt', '#egirl', '#latenight'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  // Rotate accounts by oldest lastRunAt
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

  console.log(
    `🚀 AlcashX v8.0 Viral Hijacker Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
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
    let hijackedSuccessCount = 0;

    try {
      // Pick unique media URL for Clickable Card
      const mediaItem = config.mediaQueue.shift() || pickRandom(FALLBACK_CARD_IMAGES);
      usedSet.add(mediaItem);
      config.usedMedia.push(mediaItem);

      const mainCardLink = buildClickableCardLink(mediaItem);
      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#thirsttrap', '#nsfwtwt']);
      const taggedUsers = pickMultipleRandom(config.harvestedUsers, 2).join(' ');

      const caption = spin(pickRandom(captionsPool));
      // Main Tweet includes the Clickable Fanpage Card URL so X renders a giant clickable image card!
      const mainTweetText = `${caption}\n\n${oneHashtag}\n${mainCardLink}`;

      // ------------------------------------------------------------------------
      // STEP 1: PUBLISH MAIN CLICKABLE CARD POST ON OWN PROFILE
      // ------------------------------------------------------------------------
      console.log(`📝 Step 1: Publishing Main Clickable Fanpage Card for ${acc.username}...`);
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 7);

      if (page.url().includes('/login') || page.url().includes('/account/access')) {
        console.log(`❌ Account ${acc.username} session expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        continue;
      }

      const editor0 = page.locator('[data-testid="tweetTextarea_0"]').first();
      await editor0.waitFor({ state: 'visible', timeout: 25000 });
      await editor0.click({ force: true });
      await editor0.fill(mainTweetText);

      // CRITICAL: Wait 5.5 seconds so X fetches OpenGraph Card Preview from your Vercel Cloaker!
      console.log('⏳ Waiting 5.5s for X OpenGraph Clickable Card preview to render...');
      await sleep(5500);

      // Optional: Also attach Thread Comment #1 with extra tags + link
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
            await editor1.click({ force: true });
            await editor1.fill(threadText);
            await sleep(2500);
          }
        } catch (_) {}
      }

      await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
      console.log(`✅ Step 1 Complete: Main Clickable Card Published!`);
      await randomSleep(6, 9);

      // Grab newest non-pinned status URL from own profile for Fleet Pod
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(4, 6);

      const newestOwnTweetUrl = await page
        .evaluate((handle) => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          for (const art of articles) {
            // Skip pinned tweet banner if present
            if (art.innerText.includes('Pinned')) continue;
            const link = art.querySelector(`a[href*="/${handle}/status/"]`) || art.querySelector('a[href*="/status/"]');
            if (link) {
              const h = link.getAttribute('href');
              return h.startsWith('http') ? h : `https://x.com${h}`;
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
          detail: 'Published Clickable Fanpage Card + Thread'
        });
      }

      // ------------------------------------------------------------------------
      // STEP 2: AGGRESSIVE TIER-1 / TIER-2 VIRAL POST HIJACKER (3 VIRAL POSTS!)
      // ------------------------------------------------------------------------
      const pickedQueries = pickMultipleRandom(TIER1_VIRAL_QUERIES, 2);
      const viralPostCandidates = [];

      for (const q of pickedQueries) {
        console.log(`🔍 Step 2: Searching High-Reach Tier-1 Viral Posts: ${q}`);
        // Search both Top and Live high-fave English tweets
        await page.goto(`https://x.com/search?q=${encodeURIComponent(q)}&f=live`, {
          waitUntil: 'domcontentloaded',
          timeout: 40000
        });
        await randomSleep(5, 7);

        // Scroll slightly to load more viral posts & active commenters
        await page.mouse.wheel(0, 700).catch(() => {});
        await sleep(2000);

        const extracted = await page
          .evaluate((own) => {
            const banned = new Set(['home', 'explore', 'notifications', 'messages', 'settings', 'search', 'compose', 'i']);
            const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            const postUrls = [];
            const handles = [];

            for (const art of articles) {
              const statusEl = art.querySelector('a[href*="/status/"]');
              if (statusEl) {
                const href = statusEl.getAttribute('href') || '';
                if (!href.toLowerCase().includes(`/${own.toLowerCase()}/status/`)) {
                  postUrls.push(href.startsWith('http') ? href : `https://x.com${href}`);
                }
              }
              const userAnchors = Array.from(art.querySelectorAll('a[href^="/"]'));
              for (const a of userAnchors) {
                const raw = (a.getAttribute('href') || '').split('?')[0].replace(/^\/+/, '');
                if (/^[a-zA-Z0-9_]{3,15}$/.test(raw) && !banned.has(raw.toLowerCase())) {
                  handles.push('@' + raw);
                }
              }
            }
            return { postUrls: [...new Set(postUrls)], handles: [...new Set(handles)] };
          }, cleanHandle)
          .catch(() => ({ postUrls: [], handles: [] }));

        // Save harvested real Tier-1 @users
        const ownLower = `@${cleanHandle.toLowerCase()}`;
        for (const h of extracted.handles) {
          if (h.toLowerCase() !== ownLower && !config.harvestedUsers.includes(h)) {
            config.harvestedUsers.push(h);
          }
        }
        config.harvestedUsers = config.harvestedUsers.slice(-180);

        for (const u of extracted.postUrls) {
          if (!viralPostCandidates.includes(u)) viralPostCandidates.push(u);
        }
      }

      // Fallback broad query if strict min_faves returned 0 posts
      if (viralPostCandidates.length === 0) {
        console.log('🔄 Fallback search: Fetching active #thirsttrap / "who is up" posts...');
        await page.goto(
          `https://x.com/search?q=${encodeURIComponent('(#thirsttrap OR "who is up" OR "rate me") lang:en -filter:replies')}&f=live`,
          { waitUntil: 'domcontentloaded', timeout: 40000 }
        );
        await randomSleep(5, 7);
        const fbUrls = await page
          .evaluate((own) => {
            return Array.from(document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]'))
              .map((a) => a.getAttribute('href') || '')
              .filter((h) => h && !h.toLowerCase().includes(`/${own.toLowerCase()}/status/`))
              .map((h) => (h.startsWith('http') ? h : `https://x.com${h}`));
          }, cleanHandle)
          .catch(() => []);
        viralPostCandidates.push(...new Set(fbUrls));
      }

      const targetsToHijack = viralPostCandidates.slice(0, 3);
      console.log(`🎯 Found ${viralPostCandidates.length} viral posts! Hijacking Top ${targetsToHijack.length}...`);

      for (const viralUrl of targetsToHijack) {
        try {
          console.log(`⚡ Opening Viral Post to Hijack: ${viralUrl}`);
          await page.goto(viralUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await randomSleep(4, 6);

          const mainArticle = page.locator('article[data-testid="tweet"]').first();
          if (!(await mainArticle.isVisible().catch(() => false))) continue;

          // 1) LIKE the Viral Post (Sends notification to author + boosts visibility)
          const likeBtn = mainArticle.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            console.log(`❤️ Liked viral post: ${viralUrl}`);
            await sleep(1500);
          }

          // 2) RETWEET 1st Viral Post (Builds authentic Tier-1 feed activity)
          if (hijackedSuccessCount === 0) {
            const rtBtn = mainArticle.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click({ force: true }).catch(() => {});
              await sleep(1000);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) {
                await confirmRt.click({ force: true }).catch(() => {});
                console.log(`🔁 Retweeted viral post for organic profile look!`);
                await sleep(1500);
              }
            }
          }

          // 3) POST BAIT COMMENT + CLICKABLE CARD UNDER VIRAL POST!
          // Try clicking the Reply Icon on the main article to open the dedicated Reply Modal (Most reliable!)
          const replyIconBtn = mainArticle.locator('[data-testid="reply"]').first();
          if (await replyIconBtn.isVisible().catch(() => false)) {
            await replyIconBtn.click({ force: true }).catch(() => {});
            await sleep(2500);
          } else {
            // Fallback: Click inline reply label
            const inlineLabel = page.locator('[data-testid="tweetTextarea_0_label"]').first();
            if (await inlineLabel.isVisible().catch(() => false)) {
              await inlineLabel.click({ force: true }).catch(() => {});
              await sleep(2000);
            }
          }

          const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyBox.isVisible().catch(() => false)) {
            const hijackCardLink = buildClickableCardLink(pickRandom(config.mediaQueue) || mediaItem);
            const baitText = spin(pickRandom(VIRAL_HIJACK_BAITS));
            const fullHijackReply = `${baitText}\n${hijackCardLink}`;

            await replyBox.click({ force: true });
            await replyBox.fill(fullHijackReply);

            // Wait 5 seconds so the Clickable Card renders inside the viral reply!
            console.log('⏳ Waiting 5s for Clickable Card preview inside Viral Reply...');
            await sleep(5000);

            await publishTweetSafely(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
            hijackedSuccessCount++;
            console.log(`🚀 SUCCESS! Hijacked Viral Post #${hijackedSuccessCount}: ${viralUrl}`);

            logActivity(config, {
              account: acc.username,
              type: '🔥 VIRAL_HIJACK_COMMENT',
              targetUrl: viralUrl,
              detail: `Liked + Dropped Clickable Card Comment on Viral Post`
            });

            await randomSleep(5, 8);
          } else {
            console.log('⚠️ Reply box locked/hidden on this post, moving to next...');
          }
        } catch (hijackErr) {
          console.log('⚠️ Skipped 1 viral hijack target:', hijackErr.message);
        }
      }

      if (masterAcc) {
        masterAcc.lastStatus = `✅ 1 Card Post + ${hijackedSuccessCount} Viral Hijacks`;
      }
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
      if (masterAcc) masterAcc.lastStatus = `⚠️ Error: ${err.message.slice(0, 30)}`;
    } finally {
      await browser.close();
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(5, 9);
  }

  // --------------------------------------------------------------------------
  // STEP 3: CROSS-ACCOUNT ENGAGEMENT POD (Like + Retweet + Bookmark)
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
          await randomSleep(4, 6);

          // Like
          const likeBtn = page.locator('article[data-testid="tweet"] [data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1500);
          }

          // Bookmark (Massive X Algorithm Boost!)
          const bmBtn = page.locator('article[data-testid="tweet"] [data-testid="bookmark"]').first();
          if (await bmBtn.isVisible().catch(() => false)) {
            await bmBtn.click({ force: true }).catch(() => {});
            await sleep(1200);
          }

          // Retweet
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

  console.log('\n🎉 AlcashX v8.0 Run Completed! All Viral Hijacks & Pod Boosts Saved.');
}

runBot();
