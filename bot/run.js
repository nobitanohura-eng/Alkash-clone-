import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

function spin(text) {
  if (!text) return '';
  return text.replace(/\{([^{}]+)\}/g, (_, opts) => {
    const choices = opts.split('|');
    return choices[Math.floor(Math.random() * choices.length)];
  });
}

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pick N unique random items from an array
function pickMultipleRandom(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (minSec, maxSec) => sleep((Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000);

// Helper: Download Video/Image locally for Native Upload
async function downloadMedia(url) {
  try {
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.endsWith('.mp4') ? '.mp4' : cleanUrl.endsWith('.gif') ? '.gif' : '.jpg';
    const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}${ext}`);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    return tempPath;
  } catch (e) {
    console.log('⚠️ Media download failed, falling back to link card:', e.message);
    return null;
  }
}

async function runBot() {
  const configPath = path.resolve(process.cwd(), 'data/config.json');
  if (!fs.existsSync(configPath)) {
    console.log('⚠️ data/config.json not found! Admin Panel se "Save to GitHub" dabayein.');
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const activeAccounts = (config.accounts || []).filter((a) => a.status === 'active' && a.auth_token && a.ct0);

  if (activeAccounts.length === 0) {
    console.log('⚠️ Koi active Twitter account nahi mila.');
    process.exit(0);
  }

  // Ensure harvestedUsers array exists in config.json
  if (!Array.isArray(config.harvestedUsers)) {
    config.harvestedUsers = [];
  }

  console.log('⏳ Initializing human-like delay...');
  await randomSleep(10, 45);

  const maxAccounts = Math.min(activeAccounts.length, parseInt(config.settings?.maxAccountsPerRun || 5, 10));
  const accountsToRun = activeAccounts.slice(0, maxAccounts);
  const postedTweetUrls = [];

  console.log(`🚀 Starting Bot for ${accountsToRun.length} account(s)...`);

  // =========================================================================
  // PHASE 1: NATIVE MEDIA POST + ACTIVE TAGGING + SELF-REPLY + OUTREACH
  // =========================================================================
  for (const acc of accountsToRun) {
    console.log(`\n👤 Account: ${acc.username}`);

    const launchArgs = {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (acc.proxy && acc.proxy.trim() !== '') {
      launchArgs.proxy = { server: acc.proxy.trim() };
    }

    const browser = await chromium.launch(launchArgs);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });

    await context.addCookies([
      { name: 'auth_token', value: acc.auth_token.trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true },
      { name: 'auth_token', value: acc.auth_token.trim(), domain: '.twitter.com', path: '/', httpOnly: true, secure: true },
      { name: 'ct0', value: acc.ct0.trim(), domain: '.twitter.com', path: '/', secure: true }
    ]);

    const page = await context.newPage();
    let localMediaPath = null;

    try {
      // 1. Pick Media from Scraper Queue (or fallback to config.images)
      let mediaItem = null;
      if (Array.isArray(config.mediaQueue) && config.mediaQueue.length > 0) {
        mediaItem = config.mediaQueue.shift();
        if (!config.usedMedia) config.usedMedia = [];
        config.usedMedia.push(mediaItem);
      } else {
        const rawImg = pickRandom(config.images) || 'xYz987A';
        mediaItem = rawImg.startsWith('http') ? rawImg : `https://i.imgur.com/${rawImg.replace(/\.(jpg|png|gif|jpeg)$/i, '')}.jpg`;
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(mediaItem)}&t=${Date.now().toString().slice(-4)}`;
      const caption = spin(pickRandom(config.captions) || '{Caught me being|Feeling a little} {cute|naughty|playful} {again ✌️🐆|tonight 🙊|👀}');

      // 2. SMART TAGGING SETUP (Combine Admin Panel targets + Auto-Harvested Active Users)
      const allTagPool = [...(config.targets || []), ...(config.harvestedUsers || [])];
      const mainPostTags = pickMultipleRandom(allTagPool, 2).join(' '); // 2 tags for main post
      const replyTags = pickMultipleRandom(config.harvestedUsers, 2).join(' '); // 2 active user @mentions for reply

      const fullMainCaption = mainPostTags ? `${caption}\n\n${mainPostTags}` : caption;

      localMediaPath = await downloadMedia(mediaItem);

      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(4, 6);

      const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
      await editor.waitFor({ state: 'visible', timeout: 20000 });

      // Upload Native Video/Image
      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(localMediaPath);
        await randomSleep(6, 10);

        await editor.click();
        await editor.fill(fullMainCaption);
      } else {
        await editor.click();
        await editor.fill(`${fullMainCaption}\n\n${cloakedLink}`);
        await randomSleep(4, 6);
      }

      await randomSleep(2, 4);
      const postBtn = page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first();
      await postBtn.click();
      console.log(`✅ Main Tweet posted by ${acc.username} with tags: ${mainPostTags}`);
      await randomSleep(7, 10);

      // 3. Auto-Self-Reply with Money Link + Active User Tags
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(4, 6);

      const firstTweetLink = await page.locator(`a[href*="/${cleanHandle}/status/"]`).first().getAttribute('href').catch(() => null);
      if (firstTweetLink) {
        const tweetUrl = `https://x.com${firstTweetLink}`;
        postedTweetUrls.push({ url: tweetUrl, author: acc.username });

        if (config.settings?.autoSelfReply !== false) {
          await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await randomSleep(4, 6);

          const defaultReply = '{Full uncensored video|Watch what happened next|The rest of this clip is too spicy for X} {👇|😈|💦} {{LINK}}';
          let replyText = spin(pickRandom(config.replies) || defaultReply);
          replyText = replyText.includes('{{LINK}}') ? replyText.replace('{{LINK}}', cloakedLink) : `${replyText} ${cloakedLink}`;

          // Add active user mentions in the reply so they get notified directly on the link comment!
          if (replyTags) {
            replyText = `${replyText}\n\n👀 ${replyTags}`;
          }

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            await replyInput.click();
            await replyInput.fill(replyText);
            await randomSleep(3, 5);
            await page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first().click();
            console.log(`💬 Self-Reply + Money Link + Active Mentions posted on ${tweetUrl}`);
            await randomSleep(4, 6);
          }
        }
      }

      // 4. VIRAL OUTREACH + ACTIVE USER HARVESTER
      // Pick only hashtag/keyword for search (avoid searching pure @username if possible)
      const searchKeywords = (config.targets || []).filter((t) => !t.startsWith('@'));
      const searchTarget = pickRandom(searchKeywords) || 'nsfw OR thirsttrap OR "caught me"';
      console.log(`🔍 Searching active posts for Outreach & Harvesting: "${searchTarget}"`);

      await page.goto(`https://x.com/search?q=${encodeURIComponent(searchTarget)}&f=live`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await randomSleep(5, 7);

      const otherTweets = page.locator('article[data-testid="tweet"]');
      const count = await otherTweets.count().catch(() => 0);

      // A) HARVEST ACTIVE USERS from live feed
      for (let h = 0; h < Math.min(count, 6); h++) {
        try {
          const userLink = await otherTweets.nth(h).locator('div[data-testid="User-Name"] a[href^="/"]').first().getAttribute('href').catch(() => null);
          if (userLink) {
            const handle = `@${userLink.replace('/', '').trim()}`;
            const ownHandles = activeAccounts.map((a) => `@${a.username.replace('@', '').trim().toLowerCase()}`);
            if (
              handle.length > 2 &&
              !handle.includes('/') &&
              !ownHandles.includes(handle.toLowerCase()) &&
              !config.harvestedUsers.includes(handle)
            ) {
              config.harvestedUsers.push(handle);
              console.log(`🎯 Harvested active user for future tagging: ${handle}`);
            }
          }
        } catch (_) {}
      }
      // Keep only the latest 100 fresh active users in config.json
      if (config.harvestedUsers.length > 100) {
        config.harvestedUsers = config.harvestedUsers.slice(-100);
      }

      // B) LIKE & BAIT-REPLY on top 2 active posts
      const maxOutreach = Math.min(count, 2);
      for (let i = 0; i < maxOutreach; i++) {
        try {
          const targetTweet = otherTweets.nth(i);

          const likeBtn = targetTweet.locator('[data-testid="like"]').first();
          if (await likeBtn.isVisible().catch(() => false)) {
            await likeBtn.click();
            console.log(`❤️ Liked active post (#${i + 1})`);
            await randomSleep(2, 4);
          }

          const replyIcon = targetTweet.locator('[data-testid="reply"]').first();
          if (await replyIcon.isVisible().catch(() => false)) {
            await replyIcon.click();
            await randomSleep(3, 4);

            const baitReply = spin('{omg wait till you see my pinned post 😳🔥|i just posted something way crazier on my profile 🙊💦|check my latest video before i delete it 👀😈|can someone rate my latest clip? 🥰}');
            const modalInput = page.locator('[data-testid="tweetTextarea_0"]').first();
            if (await modalInput.isVisible().catch(() => false)) {
              await modalInput.click();
              await modalInput.fill(baitReply);
              await randomSleep(2, 4);
              await page.locator('[data-testid="tweetButton"]').first().click();
              console.log(`🗣️ Replied bait on active post (#${i + 1})`);
              await randomSleep(4, 6);
            }
          }
        } catch (outreachErr) {
          console.log(`⚠️ Outreach skip on post #${i + 1}:`, outreachErr.message);
        }
      }
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
    } finally {
      if (localMediaPath && fs.existsSync(localMediaPath)) {
        fs.unlinkSync(localMediaPath);
      }
      await browser.close();
    }

    // Save updated mediaQueue & harvestedUsers back to config.json
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(5, 12);
  }

  // =========================================================================
  // PHASE 2: CROSS-ACCOUNT POD (LIKE + RETWEET + BOOKMARK)
  // =========================================================================
  if (
    postedTweetUrls.length > 0 &&
    (config.settings?.crossAccountLike || config.settings?.crossAccountRetweet || config.settings?.crossAccountBookmark)
  ) {
    console.log(`\n🔥 Starting Engagement Pod...`);
    for (const acc of accountsToRun) {
      const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
      const context = await browser.newContext();
      await context.addCookies([
        { name: 'auth_token', value: acc.auth_token.trim(), domain: '.x.com', path: '/', httpOnly: true, secure: true },
        { name: 'ct0', value: acc.ct0.trim(), domain: '.x.com', path: '/', secure: true }
      ]);
      const page = await context.newPage();

      try {
        for (const item of postedTweetUrls) {
          if (item.author === acc.username) continue;
          await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await randomSleep(4, 6);

          if (config.settings?.crossAccountLike) {
            const likeBtn = page.locator('[data-testid="like"]').first();
            if (await likeBtn.isVisible().catch(() => false)) await likeBtn.click();
            await randomSleep(1, 3);
          }
          if (config.settings?.crossAccountRetweet) {
            const rtBtn = page.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click();
              await sleep(1000);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) await confirmRt.click();
              await randomSleep(1, 3);
            }
          }
          if (config.settings?.crossAccountBookmark) {
            const bmBtn = page.locator('[data-testid="bookmark"]').first();
            if (await bmBtn.isVisible().catch(() => false)) await bmBtn.click();
            await randomSleep(1, 3);
          }
          console.log(`⚡ Pod Boost by ${acc.username} -> ${item.url}`);
        }
      } catch (e) {
        console.error(`⚠️ Pod error on ${acc.username}:`, e.message);
      } finally {
        await browser.close();
      }
    }
  }

  console.log('\n🎉 All Bot Tasks Completed!');
}

runBot();
