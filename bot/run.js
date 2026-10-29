/**
 * AlcashX Cloud Pro — Autonomous Anti-Suspension Twitter/X Bot (bot/run.js)
 * Fixed:
 *  - Media queue items are correctly removed so videos don't repeat
 *  - Guaranteed auto-self-reply linking to your Vercel fanpage cloaker
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const CLOAKER_BASE_URL = process.env.CLOAKER_URL || 'https://fan-page-orpin-mu.vercel.app';

function spin(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\{([^{}]+)\}/g, (_, group) => {
    const optionsList = group.split('|');
    return optionsList[Math.floor(Math.random() * optionsList.length)];
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
    } catch (_) {}
  }
}

async function downloadMedia(rawUrl) {
  try {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let url = rawUrl.trim();

    if (!url.startsWith('http')) {
      url = `https://i.imgur.com/${url}.mp4`;
    } else if (url.includes('imgur.com/') && !url.includes('i.imgur.com')) {
      const id = url.split('/').pop().split('?')[0].split('.')[0];
      url = `https://i.imgur.com/${id}.jpg`;
    }

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*'
    };

    console.log(`🌐 Fetching media candidate: ${url}`);
    let res = await fetch(url, { headers, redirect: 'follow' });
    if (!res.ok) return null;

    let contentType = (res.headers.get('content-type') || '').toLowerCase();

    if (contentType.includes('text/html')) {
      const html = await res.text();
      const mp4Match = html.match(/https:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?/i);
      const ogVideo = html.match(
        /<meta[^>]+property=["']og:video(?::url|:secure_url)?["'][^>]+content=["']([^"']+)["']/i
      );
      const ogImage = html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      );
      const extractedUrl = mp4Match?.[0] || ogVideo?.[1] || ogImage?.[1];

      if (!extractedUrl) return null;
      url = extractedUrl;
      res = await fetch(url, { headers, redirect: 'follow' });
      if (!res.ok) return null;
      contentType = (res.headers.get('content-type') || '').toLowerCase();
    }

    if (contentType.includes('text/html') || contentType.includes('application/json')) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 10000 || buffer.byteLength > 48 * 1024 * 1024) return null;

    let ext = '.jpg';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (contentType.includes('video') || cleanUrl.endsWith('.mp4')) {
      ext = '.mp4';
    } else if (contentType.includes('gif') || cleanUrl.endsWith('.gif')) {
      ext = '.gif';
    } else if (contentType.includes('png') || cleanUrl.endsWith('.png')) {
      ext = '.png';
    }

    const tempPath = path.resolve(process.cwd(), `temp_${Date.now()}${ext}`);
    fs.writeFileSync(tempPath, buffer);
    return tempPath;
  } catch (e) {
    return null;
  }
}

async function openComposeEditor(page) {
  const inlineEditor = page.locator('[data-testid="tweetTextarea_0"]').first();
  if (await inlineEditor.isVisible().catch(() => false)) {
    await inlineEditor.click({ force: true });
    return inlineEditor;
  }

  await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 40000 });
  await randomSleep(4, 6);
  await inlineEditor.waitFor({ state: 'visible', timeout: 20000 });
  await inlineEditor.click({ force: true });
  return inlineEditor;
}

async function runBot() {
  const dataDir = path.resolve(process.cwd(), 'data');
  const configPath = path.join(dataDir, 'config.json');

  if (!fs.existsSync(configPath)) {
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

  const activeAccounts = (config.accounts || []).filter(
    (a) => a.status === 'active' && a.auth_token && a.ct0
  );

  if (activeAccounts.length === 0) {
    process.exit(0);
  }

  if (!Array.isArray(config.mediaQueue)) config.mediaQueue = [];
  if (!Array.isArray(config.images)) config.images = [];
  if (!Array.isArray(config.harvestedUsers)) config.harvestedUsers = [];
  if (!Array.isArray(config.usedMedia)) config.usedMedia = [];

  const defaultCaptions = [
    '{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {again ✌️🐆|tonight 😈|🙊|👀}',
    "{Wait for the end|Don't pause at 0:02|Did I show too much?|Deleting this in 10 mins} {😳|🤫|💦|🔥}",
    "{can't sleep, who's still up? 🌙|am I your type? be honest 👀|would you say hi back? <3}"
  ];
  const defaultReplies = [
    '{Full uncensored video|Watch what happened next} {👇|😈|💦} {{LINK}}',
    "Watch the full uncut version free on my VIP page 👉 {{LINK}} 🔥"
  ];
  const defaultTargets = ['#nsfwtwt', '#thirsttrap'];

  const captionsPool = config.captions?.length ? config.captions : defaultCaptions;
  const repliesPool = config.replies?.length ? config.replies : defaultReplies;
  const targetsPool = config.targets?.length ? config.targets : defaultTargets;

  const sortedAccounts = [...activeAccounts].sort((a, b) => {
    const timeA = a.lastRunAt ? new Date(a.lastRunAt).getTime() : 0;
    const timeB = b.lastRunAt ? new Date(b.lastRunAt).getTime() : 0;
    return timeA - timeB;
  });

  const accountsToRun = sortedAccounts.slice(0, 1);

  for (const acc of accountsToRun) {
    const masterAcc = config.accounts.find((x) => x.username === acc.username);
    if (masterAcc) masterAcc.lastRunAt = new Date().toISOString();

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
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
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(3, 5);

      // Pull and remove item from mediaQueue permanently so it never repeats
      while (config.mediaQueue.length > 0 && !localMediaPath) {
        mediaItem = config.mediaQueue.shift(); // Removes item from queue array
        localMediaPath = await downloadMedia(mediaItem);
        if (localMediaPath) {
          config.usedMedia.push(mediaItem);
        }
      }

      // Fallback if queue is empty
      if (!localMediaPath && config.images.length > 0) {
        mediaItem = pickRandom(config.images);
        localMediaPath = await downloadMedia(mediaItem);
      }

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(mediaItem || 'vip')}&t=${Date.now().toString().slice(-4)}`;

      const hashtags = targetsPool.filter((t) => t.startsWith('#'));
      const oneHashtag = pickRandom(hashtags.length ? hashtags : ['#nsfwtwt']);
      const oneUser = pickRandom(config.harvestedUsers);
      const selectedTags = [oneHashtag, oneUser].filter(Boolean).join(' ');

      const caption = spin(pickRandom(captionsPool));
      const fullMainTweet = [caption, selectedTags].filter(Boolean).join('\n\n');

      const editor = await openComposeEditor(page);
      await editor.fill(fullMainTweet);
      await randomSleep(2, 3);

      if (localMediaPath && fs.existsSync(localMediaPath)) {
        const fileInput = page.locator('input[data-testid="fileInput"], input[type="file"]').first();
        await fileInput.setInputFiles(localMediaPath);
        await randomSleep(10, 14);
      }

      await publishTweetSafely(page);
      await randomSleep(6, 9);

      // Go to profile and post Self-Reply with Fanpage link
      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await randomSleep(4, 6);

      const latestTweetHref = await page
        .locator(`article[data-testid="tweet"] a[href*="/status/"]`)
        .first()
        .getAttribute('href')
        .catch(() => null);

      if (latestTweetHref) {
        const fullTweetUrl = `https://x.com${latestTweetHref}`;
        await page.goto(fullTweetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await randomSleep(3, 5);

        let replyMsg = spin(pickRandom(repliesPool));
        replyMsg = replyMsg.includes('{{LINK}}')
          ? replyMsg.replace('{{LINK}}', cloakedLink)
          : `${replyMsg} ${cloakedLink}`;

        const replyBox = page.locator('[data-testid="tweetTextarea_0"]').first();
        if (await replyBox.isVisible().catch(() => false)) {
          await replyBox.click({ force: true });
          await replyBox.fill(replyMsg);
          await randomSleep(2, 4);
          await publishTweetSafely(page, '[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
          await randomSleep(4, 6);
        }
      }
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      if (localMediaPath && fs.existsSync(localMediaPath)) {
        try { fs.unlinkSync(localMediaPath); } catch (_) {}
      }
      await browser.close();
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
}

runBot();
