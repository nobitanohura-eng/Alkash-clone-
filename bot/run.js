/**
 * File: bot/run.js
 * AlcashX Cloud Pro v6.0 (10-Day Challenge Edition)
 * Upgrades:
 *  1. 32-Byte Anti-Blur Hash Mutator + Zero-Buffer Corruption
 *  2. Pinned-Tweet Bypass (Finds exact newest status URL so Self-Reply never hits old pinned post)
 *  3. High-CTR Viral Hijacker (Drops Direct Cloaked Link + Profile Bait on active posts)
 *  4. Automated HTML Email Status Reporter (Alerts on Posts, Hijacks, Suspensions & Queue Health)
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

// Triggers X's React Draft.js state so Reply/Post buttons NEVER stay disabled
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

// ============================================================================
// ANTI-BLUR MP4 DOWNLOADER & 32-BYTE CRYPTOGRAPHIC HASH MUTATOR
// ============================================================================
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

    // Append 32 random bytes to mutate SHA-256 / MD5 hash & bypass X duplicate/adult AI filter
    const saltBytes = crypto.randomBytes(32);
    const finalBuffer = Buffer.concat([rawBuffer, saltBytes]);

    const tempPath = path.resolve(
      process.cwd(),
      `temp_${Date.now()}_${Math.floor(Math.random() * 9999)}.mp4`
    );
    fs.writeFileSync(tempPath, finalBuffer);
    console.log(
      `🛡️ Anti-Blur Hash Mutated: ${path.basename(tempPath)} (${(finalBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`
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

// ============================================================================
// AUTOMATED EMAIL STATUS REPORTER (GMAIL SMTP)
// ============================================================================
async function sendEmailReport(config, runSummaryRows) {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) {
    console.log('ℹ️ EMAIL_USER / EMAIL_PASS not set in GitHub Secrets. Skipping email notification.');
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass }
    });

    const allAccountsHtml = (config.accounts || [])
      .map(
        (a) =>
          `<tr>
            <td style="padding:8px;border:1px solid #334155;font-weight:bold;">${a.username}</td>
            <td style="padding:8px;border:1px solid #334155;">${a.status.toUpperCase()}</td>
            <td style="padding:8px;border:1px solid #334155;">${a.lastStatus || 'Pending'}</td>
            <td style="padding:8px;border:1px solid #334155;">${a.lastRunAt ? new Date(a.lastRunAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Never'}</td>
          </tr>`
      )
      .join('');

    const runActionsHtml = runSummaryRows
      .map((r) => `<li style="margin-bottom:6px;">${r}</li>`)
      .join('');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;background:#0f172a;color:#f8fafc;padding:20px;border-radius:12px;">
        <h2 style="color:#38bdf8;margin-top:0;">🚀 AlcashX Cloud Pro — Live Bot Run Report</h2>
        <p style="color:#94a3b8;font-size:13px;">Run Time (IST): <b>${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</b></p>
        
        <div style="background:#1e293b;padding:12px;border-radius:8px;margin-bottom:16px;">
          <b>📊 Queue &amp; Pool Telemetry:</b><br/>
          • Remaining Pure MP4 Queue: <b style="color:#38bdf8;">${(config.mediaQueue || []).length} videos</b><br/>
          • Total Videos Posted: <b style="color:#10b981;">${(config.usedMedia || []).length}</b><br/>
          • Harvested Active @Users: <b style="color:#c084fc;">${(config.harvestedUsers || []).length} users</b>
        </div>

        <h3 style="color:#10b981;">⚡ Actions Executed This Run:</h3>
        <ul style="font-size:14px;line-height:1.5;">
          ${runActionsHtml || '<li>No accounts processed in this cycle.</li>'}
        </ul>

        <h3 style="color:#f59e0b;">👥 Fleet Account Health Overview:</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#1e293b;">
          <thead>
            <tr style="background:#020617;color:#94a3b8;">
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Account</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Mode</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Latest Health / Status</th>
              <th style="padding:8px;border:1px solid #334155;text-align:left;">Last Run (IST)</th>
            </tr>
          </thead>
          <tbody>${allAccountsHtml}</tbody>
        </table>
      </div>
    `;

    const hasAlert = (config.accounts || []).some(
      (a) => (a.lastStatus || '').includes('❌') || (a.lastStatus || '').includes('⚠️')
    );
    const subjectPrefix = hasAlert ? '⚠️ [ACTION NEEDED]' : '✅ [SUCCESS]';

    await transporter.sendMail({
      from: `"AlcashX AutoBot" <${emailUser}>`,
      to: emailUser,
      subject: `${subjectPrefix} AlcashX Report — ${runSummaryRows.length} Account(s) Processed`,
      html: htmlBody
    });
    console.log('📧 HTML Email Status Report sent successfully!');
  } catch (err) {
    console.log('⚠️ Email report failed:', err.message);
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
  const runSummaryRows = [];

  console.log(
    `🚀 Autonomous Bot v6.0 Starting: Running ${accountsToRun.length} of ${activeAccounts.length} active account(s)...`
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
        runSummaryRows.push(`<b>${acc.username}</b>: ⚠️ Skipped (Media Queue Empty/Download Failed)`);
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

      // 2. Open Compose & Verify Account Health
      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 7);

      const currentUrl = page.url();
      if (
        currentUrl.includes('/login') ||
        currentUrl.includes('/account/access') ||
        currentUrl.includes('/ suspended')
      ) {
        console.log(`❌ Account ${acc.username} cookie expired or locked!`);
        if (masterAcc) masterAcc.lastStatus = '❌ Cookie Expired / Locked';
        logActivity(config, {
          account: acc.username,
          type: '🚨 ACCOUNT_LOCKED',
          targetUrl: `https://x.com/${acc.username.replace('@', '')}`,
          detail: `Session expired or locked (${currentUrl})`
        });
        runSummaryRows.push(`<b>${acc.username}</b>: ❌ <span style="color:#f43f5e;">Cookie Expired / Account Locked!</span>`);
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

      // 3. PINNED-TWEET BYPASS: Find the HIGHEST (Newest) Status ID on Profile!
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(5, 7);

      const newestHref = await page
        .evaluate((handle) => {
          const links = Array.from(
            document.querySelectorAll('article[data-testid="tweet"] a[href*="/status/"]')
          );
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

      const publishedUrl = newestHref
        ? `https://x.com${newestHref}`
        : `https://x.com/${cleanHandle}`;

      newlyPublishedTweets.push({ url: publishedUrl, author: acc.username });

      let linkReplySuccess = false;

      // Navigate directly to the newest tweet URL so we NEVER accidentally reply to an old Pinned Tweet!
      if (newestHref) {
        console.log(`💬 Opening newest tweet ${publishedUrl} to attach Cloaked Link...`);
        await page.goto(publishedUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await randomSleep(4, 6);

        // Try clicking the reply icon on the main tweet to open Modal, or click inline reply box
        const replyIcon = page.locator('article[data-testid="tweet"] [data-testid="reply"]').first();
        if (await replyIcon.isVisible().catch(() => false)) {
          await replyIcon.click({ force: true }).catch(() => {});
          await sleep(2000);
        } else {
          const inlinePlaceholder = page
            .locator('[data-testid="tweetTextarea_0_label"], [data-testid="tweetTextarea_0"]')
            .first();
          if (await inlinePlaceholder.isVisible().catch(() => false)) {
            await inlinePlaceholder.click({ force: true }).catch(() => {});
            await sleep(1200);
          }
        }

        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        if (await replyBox.isVisible().catch(() => false)) {
          await typeIntoXEditor(page, replyBox, selfReplyComment);
          await randomSleep(5, 7); // Allow X to render OpenGraph Card preview
          await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
          linkReplySuccess = true;
          console.log(`🔗 SUCCESS! Cloaked Fanpage Link published under ${publishedUrl}!`);
          await randomSleep(4, 6);
        }
      }

      logActivity(config, {
        account: acc.username,
        type: '🎬 VIDEO_AND_LINK',
        targetUrl: publishedUrl,
        mediaUrl: mediaItem,
        detail: `Video + Link (${linkReplySuccess ? '✅ Link Attached' : '⚠️ Video Only'})`
      });

      // 4. SAFE-SEARCH BYPASS VIRAL HIJACKER (With Direct Link + Profile Bait!)
      const unfilteredQueries = [
        '"who is up" min_faves:3',
        '"can\'t sleep" min_faves:5',
        '"rate me" min_faves:3',
        '"anyone awake" min_faves:3',
        '"bored" min_faves:10'
      ];
      const chosenQuery = pickRandom(unfilteredQueries);
      console.log(`🔍 Searching Live Feed for Users & Hijacking: ${chosenQuery}`);

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

      // B) Hijack Top 2 Active Posts (1st with Profile Bait, 2nd with Direct Cloaked Link!)
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
      for (let idx = 0; idx < candidateUrls.length; idx++) {
        const targetPostUrl = candidateUrls[idx];
        try {
          await page.goto(targetPostUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await randomSleep(4, 6);

          const mainArticle = page.locator('article[data-testid="tweet"]').first();
          const likeBtn = mainArticle.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click({ force: true }).catch(() => {});
            await sleep(1200);
          }

          const replyIcon = mainArticle.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click({ force: true }).catch(() => {});
            await sleep(2000);
          }

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            const baitMsg =
              idx === 0
                ? spin(
                    `{i can't sleep either 😭 just posted my uncut leaked clip here before deleting 👇🔞|omg wait till you see what I just uploaded on my VIP page 😳🔥} ${cloakedLink}`
                  )
                : spin(
                    `{i can't sleep either 😭 just dropped a crazy video on my profile before deleting 🙊💦|rate the new video I just pinned on my profile? be honest 👀🔞}`
                  );

            await typeIntoXEditor(page, replyInput, baitMsg);
            await randomSleep(4, 6);
            await publishTweetAndWait(page, '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]');
            hijackedCount++;
            console.log(`🚀 Hijacked Active Post (${hijackedCount}): ${targetPostUrl}`);

            logActivity(config, {
              account: acc.username,
              type: '💬 VIRAL_HIJACK_REPLY',
              targetUrl: targetPostUrl,
              detail: idx === 0 ? 'Dropped Cloaked Link on Viral Post' : 'Dropped Profile Bait on Viral Post'
            });
            await randomSleep(4, 6);
          }
        } catch (_) {}
      }

      const finalAccStatus = `✅ Video + Link (${linkReplySuccess ? 'OK' : 'Retry'}) + ${hijackedCount} Hijacks`;
      if (masterAcc) masterAcc.lastStatus = finalAccStatus;
      runSummaryRows.push(
        `<b>${acc.username}</b>: ${finalAccStatus} — <a href="${publishedUrl}" style="color:#38bdf8;">View Tweet ↗</a>`
      );
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
      runSummaryRows.push(`<b>${acc.username}</b>: ⚠️ Error (${err.message.slice(0, 60)})`);
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

  // 6. SEND LIVE HTML EMAIL TELEMETRY REPORT
  await sendEmailReport(config, runSummaryRows);

  console.log('\n🎉 Run v6.0 Completed, Activity Logs & Email Report Dispatched!');
}

runBot();
