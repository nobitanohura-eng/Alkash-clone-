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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const maxAccounts = Math.min(activeAccounts.length, parseInt(config.settings?.maxAccountsPerRun || 5, 10));
  const accountsToRun = activeAccounts.slice(0, maxAccounts);
  const postedTweetUrls = [];

  console.log(`🚀 Starting Bot for ${accountsToRun.length} account(s)...`);

  // PHASE 1: TWEET + TAG + AUTO SELF-REPLY
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

    try {
      const rawImg = pickRandom(config.images) || 'xYz987A';
      const imgId = rawImg.includes('imgur.com/')
        ? rawImg.split('/').pop().replace(/\.(jpg|png|gif|jpeg)$/i, '')
        : rawImg.trim();

      const cloakedLink = `${CLOAKER_BASE_URL}/?img=${encodeURIComponent(imgId)}&t=${Date.now().toString().slice(-4)}`;
      const caption = spin(pickRandom(config.captions) || 'Private feed unlocked for 10 mins 🔥');
      const target1 = pickRandom(config.targets) || '';
      const target2 = pickRandom(config.targets) || '';
      const tags = [target1, target2].filter(Boolean).join(' ');

      const fullTweetText = `${caption}\n\n${tags}\n${cloakedLink}`.trim();

      await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(4500);

      const editor = page.locator('[data-testid="tweetTextarea_0"]').first();
      await editor.waitFor({ state: 'visible', timeout: 20000 });
      await editor.click();
      await editor.fill(fullTweetText);

      // Wait 4.5s for Twitter Image Card preview to load
      await sleep(4500);

      const postBtn = page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first();
      await postBtn.click();
      console.log(`✅ Tweet posted by ${acc.username}!`);
      await sleep(6000);

      const cleanHandle = acc.username.replace('@', '').trim();
      await page.goto(`https://x.com/${cleanHandle}`, { waitUntil: 'domcontentloaded', timeout: 40000 });
      await sleep(4500);

      const firstTweetLink = await page.locator(`a[href*="/${cleanHandle}/status/"]`).first().getAttribute('href').catch(() => null);
      if (firstTweetLink) {
        const tweetUrl = `https://x.com${firstTweetLink}`;
        postedTweetUrls.push({ url: tweetUrl, author: acc.username });

        if (config.settings?.autoSelfReply && config.replies?.length > 0) {
          await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 40000 });
          await sleep(4000);

          let replyText = spin(pickRandom(config.replies));
          replyText = replyText.includes('{{LINK}}') ? replyText.replace('{{LINK}}', cloakedLink) : `${replyText} ${cloakedLink}`;

          const replyInput = page.locator('[data-testid="tweetTextarea_0"]').first();
          if (await replyInput.isVisible().catch(() => false)) {
            await replyInput.click();
            await replyInput.fill(replyText);
            await sleep(2500);
            await page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first().click();
            console.log(`💬 Self-Reply posted on ${tweetUrl}`);
            await sleep(3500);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Error on ${acc.username}:`, err.message);
    } finally {
      await browser.close();
    }
  }

  // PHASE 2: CROSS-ACCOUNT POD (LIKE + RETWEET + BOOKMARK)
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
          await sleep(3500);

          if (config.settings?.crossAccountLike) {
            const likeBtn = page.locator('[data-testid="like"]').first();
            if (await likeBtn.isVisible().catch(() => false)) await likeBtn.click();
            await sleep(1200);
          }
          if (config.settings?.crossAccountRetweet) {
            const rtBtn = page.locator('[data-testid="retweet"]').first();
            if (await rtBtn.isVisible().catch(() => false)) {
              await rtBtn.click();
              await sleep(1000);
              const confirmRt = page.locator('[data-testid="retweetConfirm"]').first();
              if (await confirmRt.isVisible().catch(() => false)) await confirmRt.click();
              await sleep(1200);
            }
          }
          if (config.settings?.crossAccountBookmark) {
            const bmBtn = page.locator('[data-testid="bookmark"]').first();
            if (await bmBtn.isVisible().catch(() => false)) await bmBtn.click();
            await sleep(1200);
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
