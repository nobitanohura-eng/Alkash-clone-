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

function pickMultipleRandom(arr, count) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return [...arr].sort(() => 0.5 - Math.random()).slice(0, count);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomSleep = (minSec, maxSec) => sleep((Math.floor(Math.random() * (maxSec - minSec + 1)) + minSec) * 1000);

async function downloadMedia(url) {
  try {
    const cleanUrl = url.split('?')[0];
    const ext = cleanUrl.endsWith('.mp4') ? '.mp4' : cleanUrl.endsWith('.gif') ? '.gif' : '.jpg';
    const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}${ext}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': 'https://www.reddit.com/'
      }
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 5000) return null;
    fs.writeFileSync(tempPath, Buffer.from(buffer));
    return tempPath;
  } catch (e) {
    console.log('⚠️ Media download skipped:', e.message);
    return null;
  }
}

async function runBot() {
  const configPath = path.resolve(process.cwd(), 'data/config.json');
  if (!fs.existsSync(configPath)) {
    console.log('⚠️ data/config.json not found!');
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const activeAccounts = (config.accounts || []).filter((a) => a.status === 'active' && a.auth_token && a.ct0);

  if (activeAccounts.length === 0) {
    console.log('⚠️ No active Twitter account found.');
    process.exit(0);
  }

  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];
  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];

  const defaultCaptions = [
    "{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {again ✌️🐆|tonight 😈|🙊|👀}",
    "{Wait for the end|Don't pause at 0:02|Did I show too much?|Deleting this soon} {😳|🤫|💦|🔥}",
    "{can't sleep, who's still up? 🌙|am I your type? be honest 👀|would you say hi back? <3}"
  ];
  const defaultReplies = [
    "{Full uncensored video|Watch what happened next|Full 3 min leaked clip} right here 👇😈 {{LINK}}"
  ];
  const defaultTargets = ['#nsfwtwt', '#thirsttrap', '#desimms'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  const maxAccounts = Math.min(activeAccounts.length, parseInt(config.settings?.maxAccountsPerRun || 5, 10));
  const accountsToRun = activeAccounts.slice(0, maxAccounts);

  console.log(`🚀 Running Safe Anti-Ban Bot for ${accountsToRun.length} account(s)...`);

  for (const acc of accountsToRun) {
    console.log(`\n👤 Account: ${acc.username}`);

    const launchArgs = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    const browser = await chromium.launch(launchArgs);
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US'
    });

    // Hide Playwright webdriver flag from Twitter Anti-Bot detection
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

    try {
      // 1. Pick Media from Queue & Download Locally
      let mediaItem = null;
      while (config.mediaQueue.length > 0 && !localMediaPath) {
        const candidate = config.mediaQueue.shift();
        localMediaPath = await downloadMedia(candidate);
        if (localMediaPath) {
          mediaItem = candidate;
          config.usedMedia.push(mediaItem);
        }
      }

      if (!mediaItem) {
        mediaItem = 'https://i.ibb.co/BH7qych6/media-1793206956474-d4ed18e8.webp';
        localMediaPath = await downloadMedia(mediaItem);
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(mediaItem)}&t=${Date.now().toString().slice(-4)}`;
      const caption = spin(pickRandom(captionsPool));
      const hashtags = pickMultipleRandom(targetsPool.filter((t) => t.startsWith('#')), 2).join(' ');
      const fullMainTweet = [caption, hashtags].filter(Boolean).join('\n\n');

      // 2. Open X Home & Check if Logged In
      console.log('📝 Opening X Home...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(6, 9);

      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login') || currentUrl.includes('/account/access')) {
        console.log(`⚠️ Account ${acc.username} is logged out or locked by X (URL: ${currentUrl}). Skipping...`);
        continue;
      }

      // Click Desktop Sidebar "Post" Button if inline editor isn't active
      const sidePostBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
      if (await sidePostBtn.isVisible().catch(() => false)) {
        await sidePostBtn.click();
        await randomSleep(2, 4);
      }

      const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
      await editor.waitFor({ state: 'visible', timeout: 20000 });
      await editor.click();

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        console.log(`📤 Uploading native media: ${path.basename(localMediaPath)}`);
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(localMediaPath);
        await randomSleep(10, 15);
        await editor.fill(fullMainTweet);
      } else {
        await editor.fill(`${fullMainTweet}\n\n${cloakedLink}`);
      }

      await randomSleep(3, 5);
      const postBtn = page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first();
      await postBtn.click();
      console.log(`✅ Main Post Published by ${acc.username}!`);
      await randomSleep(8, 12);

      // 3. Navigate to Profile & Self-Reply with Cloaked Money Link
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(5, 8);

      const latestTweetHref = await page.locator(`article[data-testid="tweet"] a[href*="/status/"]`).first().getAttribute('href').catch(() => null);
      if (latestTweetHref && config.settings?.autoSelfReply !== false) {
        const fullTweetUrl = `https://x.com${latestTweetHref}`;
        await page.goto(fullTweetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomSleep(4, 7);

        let replyMsg = spin(pickRandom(repliesPool));
        replyMsg = replyMsg.includes('{{LINK}}') ? replyMsg.replace('{{LINK}}', cloakedLink) : `${replyMsg} ${cloakedLink}`;

        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        if (await replyBox.isVisible().catch(() => false)) {
          await replyBox.click();
          await replyBox.fill(replyMsg);
          await randomSleep(3, 5);
          await page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first().click();
          console.log(`💬 Self-Reply Money Link posted under ${fullTweetUrl}`);
          await randomSleep(5, 8);
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

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await randomSleep(8, 15);
  }

  console.log('\n🎉 All Accounts Processed Safely!');
}

runBot();
