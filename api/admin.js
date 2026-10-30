/**
 * AlcashX Cloud Pro v10.0 — Ultimate Command Center (api/admin.js)
 * New in v10.0:
 *  1. Per-Account Post Mode Selector in Dashboard: Choose [📊 Text Poll (No Links)] vs [🖼️ Image Card] vs [⚡ Hybrid] per account!
 *  2. Dedicated Tab 4: Meta Threads Multi-Account Manager (Add/Manage multiple Threads accounts with User ID & Token)
 *  3. Global Engagement Controls: Toggle Zero-Link Viral Commenting/Liking ON/OFF directly from Dashboard
 *  4. External Cron Webhook (/api/admin?cron=1&pin=YOUR_PIN) to guarantee 100% exact 2-hour auto-runs!
 */

const DEFAULT_CONFIG = {
  accounts: [],
  threadsAccounts: [],
  images: [],
  captions: [],
  polls: [],
  replies: [],
  targets: [],
  mediaQueue: [],
  usedMedia: [],
  harvestedUsers: [],
  activityLog: [],
  settings: {
    globalPostMode: 'per_account', // 'per_account', 'poll_only', 'image_only', 'hybrid'
    enableOutreachLikesAndReplies: true,
    zeroLinksInOutreach: true,
    autoSelfReply: false,
    crossAccountLike: true,
    crossAccountRetweet: true,
    crossAccountBookmark: true,
    maxAccountsPerRun: 2
  },
  updatedAt: null
};

const BANNED_WORDS = [
  'jerkmate', 'chaturbate', 'stripchat', 'bonga', 'cam4', 'ad', 'promo',
  'hentai', 'anime', '3d', 'sfm', 'cartoon', 'animated', 'rule34', 'furry',
  'gay', 'trans', 'shemale', 'femboy', 'cuck', 'male', 'guy'
];

function toSafeSearchBlurUrl(rawImgUrl, blurLevel = 6) {
  if (!rawImgUrl || typeof rawImgUrl !== 'string') return '';
  const clean = rawImgUrl.trim();
  if (clean.includes('wsrv.nl')) return clean;
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=960&h=540&fit=cover&a=attention&blur=${blurLevel}&con=12&bri=-5&output=jpg`;
}

async function fetchFreshSafeSearchModelCards(nicheQuery = 'tiktok tease') {
  const urls = [];
  try {
    const authRes = await fetch('https://api.redgifs.com/v2/auth/temporary', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0' },
      cache: 'no-store'
    });
    if (authRes.ok) {
      const { token } = await authRes.json();
      if (token) {
        const queries = [
          nicheQuery,
          'tiktok tease',
          'mirror selfie girl',
          'shirt lift tease',
          'bikini try on',
          'girlfriend tease',
          'desi saree tease'
        ];
        const picked = queries[Math.floor(Math.random() * queries.length)];
        const page = Math.floor(Math.random() * 4) + 1;
        const sRes = await fetch(
          `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(picked)}&order=trending&type=g&count=35&page=${page}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0.0.0'
            },
            cache: 'no-store'
          }
        );
        if (sRes.ok) {
          const data = await sRes.json();
          for (const g of data?.gifs || []) {
            const tags = (g?.tags || []).map((t) => String(t).toLowerCase());
            const desc = String(g?.description || '').toLowerCase();
            if (BANNED_WORDS.some((b) => tags.some((t) => t.includes(b)) || desc.includes(b))) continue;
            const poster = g?.urls?.poster || g?.urls?.thumbnail;
            if (poster && poster.startsWith('http')) {
              urls.push(toSafeSearchBlurUrl(poster, 6));
            }
          }
        }
      }
    }
  } catch (_) {}
  return urls;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  const filePath = 'data/config.json';

  const ghHeaders = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'AlcashX-Cloud-Pro-v10.0',
    'Content-Type': 'application/json'
  };

  // EXTERNAL CRON WEBHOOK SUPPORT: Hit /api/admin?cron=1&pin=YOUR_PIN every 2 hours from cron-job.org for 100% guaranteed auto-runs!
  if (req.method === 'GET' && req.query?.cron === '1') {
    if (req.query?.pin !== expectedPassword && req.headers['x-vercel-cron'] !== '1') {
      return res.status(401).json({ ok: false, error: 'Invalid cron PIN' });
    }
    try {
      const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/bot.yml/dispatches`;
      const dRes = await fetch(dispatchUrl, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({ ref: branch }),
        cache: 'no-store'
      });
      return res.status(200).json({
        ok: dRes.ok || dRes.status === 204,
        triggeredAt: new Date().toISOString(),
        message: '✅ 2-Hour Auto-Cron Dispatched GitHub Actions Workflow!'
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(renderAdminHTML());
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, password, config, niche, base64Image } = body;

      const providedPassword = password || req.headers['x-admin-password'];

      if (!expectedPassword) {
        return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD not configured in Vercel.' });
      }
      if (!providedPassword || providedPassword !== expectedPassword) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN.' });
      }
      if (!githubToken || !githubRepo) {
        return res.status(500).json({ ok: false, error: 'Missing GITHUB_TOKEN or GITHUB_REPO in Vercel.' });
      }

      const contentsUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

      // 1. LOAD CONFIG + LIVE GITHUB DIAGNOSTICS
      if (action === 'load_config') {
        const cacheBuster = Date.now();
        const [getRes, runsRes] = await Promise.all([
          fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}&_t=${cacheBuster}`, {
            method: 'GET',
            headers: ghHeaders,
            cache: 'no-store'
          }),
          fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?per_page=6&_t=${cacheBuster}`, {
            method: 'GET',
            headers: ghHeaders,
            cache: 'no-store'
          })
        ]);

        let runs = [];
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          runs = (runsData.workflow_runs || []).map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            conclusion: r.conclusion,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            url: r.html_url
          }));
        }

        if (getRes.status === 404) {
          return res.status(200).json({ ok: true, isNew: true, repo: githubRepo, branch, sha: null, config: DEFAULT_CONFIG, runs });
        }
        if (!getRes.ok) {
          const errText = await getRes.text();
          return res.status(getRes.status).json({ ok: false, error: `GitHub API Error: ${errText}` });
        }

        const fileData = await getRes.json();
        const decodedJson = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let parsedConfig = DEFAULT_CONFIG;
        try {
          parsedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(decodedJson) };
        } catch (_) {}

        return res.status(200).json({
          ok: true,
          repo: githubRepo,
          branch,
          sha: fileData.sha,
          config: parsedConfig,
          runs
        });
      }

      // 2. LIVE WORKFLOW RUNS POLLING
      if (action === 'poll_runs') {
        const runsRes = await fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?per_page=6&_t=${Date.now()}`, {
          method: 'GET',
          headers: ghHeaders,
          cache: 'no-store'
        });
        let runs = [];
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          runs = (runsData.workflow_runs || []).map((r) => ({
            id: r.id,
            name: r.name,
            status: r.status,
            conclusion: r.conclusion,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            url: r.html_url
          }));
        }
        return res.status(200).json({ ok: true, repo: githubRepo, runs });
      }

      // 3. INSTANT SERVERLESS CLOUD SCRAPER
      if (action === 'cloud_scrape') {
        const freshUrls = await fetchFreshSafeSearchModelCards(niche || 'tiktok tease');
        return res.status(200).json({
          ok: true,
          urls: freshUrls,
          message: `☁️ Pulled ${freshUrls.length} SafeSearch Blurred HD Model Cards! Click "💾 Save Changes" to lock them in.`
        });
      }

      // 4. DIRECT PHONE/PC CUSTOM IMAGE UPLOAD TO GITHUB VAULT
      if (action === 'upload_custom_image') {
        if (!base64Image) {
          return res.status(400).json({ ok: false, error: 'Missing image payload.' });
        }
        const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
        const safeName = `model_${Date.now()}_${Math.floor(Math.random() * 999)}.jpg`;
        const uploadPath = `public/uploads/${safeName}`;
        const uploadApiUrl = `https://api.github.com/repos/${githubRepo}/contents/${uploadPath}`;

        const upRes = await fetch(uploadApiUrl, {
          method: 'PUT',
          headers: ghHeaders,
          body: JSON.stringify({
            message: `📸 Upload custom model card ${safeName}`,
            content: cleanBase64,
            branch
          })
        });

        if (!upRes.ok) {
          const errText = await upRes.text();
          return res.status(upRes.status).json({ ok: false, error: `Upload failed: ${errText}` });
        }

        const rawCdnUrl = `https://raw.githubusercontent.com/${githubRepo}/${branch}/${uploadPath}#noblur`;
        return res.status(200).json({
          ok: true,
          url: rawCdnUrl,
          message: `📸 Custom Model Card uploaded! Click "💾 Save Changes" to sync queue.`
        });
      }

      // 5. SAVE CONFIG (PRESERVES PER-ACCOUNT POST MODES & THREADS MULTI-ACCOUNTS)
      if (action === 'save_config') {
        if (!config || typeof config !== 'object') {
          return res.status(400).json({ ok: false, error: 'Invalid config payload.' });
        }

        for (let attempt = 1; attempt <= 2; attempt++) {
          let existingSha = null;
          let existingFileConfig = {};

          const shaRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}&_t=${Date.now()}`, {
            method: 'GET',
            headers: ghHeaders,
            cache: 'no-store'
          });

          if (shaRes.ok) {
            const existingData = await shaRes.json();
            existingSha = existingData.sha;
            try {
              existingFileConfig = JSON.parse(Buffer.from(existingData.content, 'base64').toString('utf-8'));
            } catch (_) {}
          }

          const usedSet = new Set([
            ...(Array.isArray(existingFileConfig.usedMedia) ? existingFileConfig.usedMedia : []),
            ...(Array.isArray(config.usedMedia) ? config.usedMedia : [])
          ]);

          const isJunkOrStock = (u) => {
            if (!u || typeof u !== 'string' || !u.startsWith('http')) return true;
            return (
              u.includes('images.unsplash.com') ||
              u.includes('aacdn.net') ||
              u.includes('rule34') ||
              u.includes('mixkit.co')
            );
          };

          const cleanCustomImages = [
            ...new Set(
              (Array.isArray(config.images) ? config.images : []).filter((u) => !isJunkOrStock(u))
            )
          ];

          const mergedQueue = [
            ...new Set([
              ...cleanCustomImages.filter((u) => !usedSet.has(u)),
              ...(Array.isArray(config.mediaQueue) ? config.mediaQueue : []),
              ...(Array.isArray(existingFileConfig.mediaQueue) ? existingFileConfig.mediaQueue : [])
            ])
          ]
            .filter((u) => !isJunkOrStock(u) && !usedSet.has(u))
            .map((u) => {
              if (u.includes('redgifs.com') && u.split('?')[0].endsWith('.mp4')) {
                const poster = u.replace('-mobile.mp4', '-poster.jpg').replace('.mp4', '-poster.jpg');
                return toSafeSearchBlurUrl(poster, 6);
              }
              return u;
            });

          const mergedUsers = [
            ...new Set([
              ...(Array.isArray(config.harvestedUsers) ? config.harvestedUsers : []),
              ...(Array.isArray(existingFileConfig.harvestedUsers) ? existingFileConfig.harvestedUsers : [])
            ])
          ].filter((u) => !u.includes('simp_account') && !u.includes('active_user') && !u.includes('user1'));

          const remoteAccMap = new Map(
            (existingFileConfig.accounts || []).map((a) => [a.username, a])
          );
          const mergedAccounts = (Array.isArray(config.accounts) ? config.accounts : []).map((acc) => {
            const rem = remoteAccMap.get(acc.username);
            return {
              ...acc,
              postMode: acc.postMode || rem?.postMode || 'poll', // 'poll', 'image', 'hybrid'
              lastRunAt: acc.lastRunAt || rem?.lastRunAt || null,
              lastStatus: acc.lastStatus || rem?.lastStatus || null
            };
          });

          const payloadToSave = {
            ...existingFileConfig,
            accounts: mergedAccounts,
            threadsAccounts: Array.isArray(config.threadsAccounts)
              ? config.threadsAccounts
              : existingFileConfig.threadsAccounts || [],
            images: cleanCustomImages,
            captions: Array.isArray(config.captions) ? config.captions : [],
            polls: Array.isArray(config.polls) ? config.polls : existingFileConfig.polls || [],
            replies: Array.isArray(config.replies) ? config.replies : [],
            targets: Array.isArray(config.targets) ? config.targets : [],
            mediaQueue: mergedQueue.slice(0, 400),
            usedMedia: [...usedSet].slice(-2500),
            harvestedUsers: mergedUsers.slice(-200),
            activityLog: Array.isArray(existingFileConfig.activityLog)
              ? existingFileConfig.activityLog.slice(0, 100)
              : [],
            settings: {
              globalPostMode: config.settings?.globalPostMode || 'per_account',
              enableOutreachLikesAndReplies: config.settings?.enableOutreachLikesAndReplies !== false,
              zeroLinksInOutreach: config.settings?.zeroLinksInOutreach !== false,
              autoSelfReply: Boolean(config.settings?.autoSelfReply),
              crossAccountLike: Boolean(config.settings?.crossAccountLike),
              crossAccountRetweet: Boolean(config.settings?.crossAccountRetweet),
              crossAccountBookmark: Boolean(config.settings?.crossAccountBookmark ?? true),
              maxAccountsPerRun: Math.max(1, parseInt(config.settings?.maxAccountsPerRun ?? 2, 10) || 2)
            },
            updatedAt: new Date().toISOString()
          };

          const contentBase64 = Buffer.from(JSON.stringify(payloadToSave, null, 2), 'utf-8').toString('base64');
          const putBody = {
            message: `⚡ Sync config via AlcashX Command Center v10.0 [${new Date().toISOString()}]`,
            content: contentBase64,
            branch
          };
          if (existingSha) putBody.sha = existingSha;

          const putRes = await fetch(contentsUrl, {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify(putBody),
            cache: 'no-store'
          });

          if (putRes.status === 409 && attempt === 1) continue;

          if (!putRes.ok) {
            const errText = await putRes.text();
            return res.status(putRes.status).json({ ok: false, error: `GitHub Save Error: ${errText}` });
          }

          const putResult = await putRes.json();
          return res.status(200).json({
            ok: true,
            message: `✅ Saved! X Accounts: ${payloadToSave.accounts.length} | Threads Accounts: ${payloadToSave.threadsAccounts.length} | Queue: ${payloadToSave.mediaQueue.length}`,
            sha: putResult.content?.sha || null,
            config: payloadToSave
          });
        }
      }

      // 6. TRIGGER BOT NOW
      if (action === 'trigger_bot') {
        const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/bot.yml/dispatches`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ ref: branch }),
          cache: 'no-store'
        });
        if (dispatchRes.status === 204 || dispatchRes.ok) {
          return res.status(200).json({
            ok: true,
            message: `🚀 Autonomous Bot v10.0 Dispatched! Watch Live Monitor & Check Gmail after completion.`
          });
        }
        const errText = await dispatchRes.text();
        return res.status(dispatchRes.status).json({ ok: false, error: `Dispatch failed: ${errText}` });
      }

      return res.status(400).json({ ok: false, error: `Unknown action "${action}"` });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}

function renderAdminHTML() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>AlcashX Cloud Pro v10.0 — Multi-Mode X & Threads Command Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script>
    tailwind.config = { darkMode: 'class', theme: { extend: { fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] } } } }
  </script>
  <style>
    body { background: radial-gradient(circle at top right, #0f172a, #060911 65%); color: #F1F5F9; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    .glass { background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(12px); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #060911; }
    ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px; }
  </style>
</head>
<body class="min-h-screen text-slate-100 pb-12">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-6">
    
    <!-- Top Command Bar -->
    <header class="glass border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 shadow-xl">
      <div>
        <div class="flex flex-wrap items-center gap-2.5">
          <span class="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-300 border border-emerald-500/30">v10.0 PER-ACCOUNT MODE + THREADS HUB</span>
          <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">AlcashX Command Center</h1>
          <span id="connBadge" class="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">⚪ Standby</span>
        </div>
        <p id="connSubtext" class="text-xs text-slate-400 mt-1">Select [📊 Text Poll] or [🖼️ Image Card] Per Account · Zero-Link Feed Hijacker · Multi-Account Threads</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input id="adminPassword" type="password" placeholder="Admin PIN" class="w-full sm:w-36 h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500" />
        <button onclick="loadConfigFromGitHub()" class="h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer">🔄 Sync GitHub</button>
        <button onclick="instantCloudRefill('tiktok tease')" class="h-10 px-3.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer shadow">☁️ +30 Image Cards</button>
        <button onclick="saveConfigToGitHub()" class="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer shadow-lg">💾 Save Changes</button>
      </div>
    </header>

    <div id="toastBanner" class="hidden rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold transition-all"></div>

    <!-- Real-Time KPI Grid -->
    <section class="grid grid-cols-2 lg:grid-cols-6 gap-3.5 items-stretch">
      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active X Fleet</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statActiveAccounts" class="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">0</span>
          <span id="statTotalAccounts" class="text-xs text-slate-400 font-mono">of 0</span>
        </div>
      </div>

      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mode Breakdown</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statPollVsImg" class="text-sm sm:text-base font-extrabold text-sky-400 font-mono">0 Poll · 0 Img</span>
        </div>
      </div>

      <div class="glass border border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between bg-amber-950/10">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-300">Image Queue</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statMediaQueue" class="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">0</span>
          <span id="statCustomVault" class="text-xs text-amber-300/80 font-mono">0 vault</span>
        </div>
      </div>

      <div class="glass border border-purple-500/30 rounded-2xl p-4 flex flex-col justify-between bg-purple-950/10">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-purple-300">Threads Fleet</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statThreadsCount" class="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">0</span>
          <span class="text-xs text-purple-300/80 font-mono">connected</span>
        </div>
      </div>

      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Engine State</span>
        <div class="mt-2 flex flex-col">
          <span id="statBotStatus" class="text-sm font-bold text-emerald-400 truncate">Ready · Autopilot</span>
          <span id="statRepoInfo" class="text-[10px] text-slate-500 font-mono truncate">Auto-Cron Active</span>
        </div>
      </div>

      <div class="col-span-2 lg:col-span-1 flex">
        <button onclick="triggerBotNow()" class="w-full min-h-[76px] rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-extrabold text-sm sm:text-base tracking-tight shadow-[0_0_30px_rgba(16,185,129,0.4)] cursor-pointer flex flex-col items-center justify-center px-4">
          <span>🚀 RUN BOT NOW</span>
          <span class="text-[10px] font-mono font-semibold opacity-80">Instant Cloud Dispatch</span>
        </button>
      </div>
    </section>

    <!-- Live GitHub Actions Telemetry + Activity Proof Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section class="glass border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <h2 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">GitHub Actions Stream (bot.yml)</h2>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="copyWebhookCronUrl()" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-mono cursor-pointer">⏰ Copy 2h Cron URL</button>
            <button onclick="pollWorkflowRuns()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-400 font-mono cursor-pointer">🔄 Refresh</button>
          </div>
        </div>
        <div id="runsListContainer" class="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
          <div class="text-slate-500 py-2">Enter Admin PIN and click "Sync GitHub" to view live cloud runs...</div>
        </div>
      </section>

      <section class="glass border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm">🎯</span>
            <h2 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Verified Posts &amp; Live Feed Likes/Comments Log</h2>
          </div>
          <span id="activityCountBadge" class="text-[11px] font-mono text-emerald-400">0 actions logged</span>
        </div>
        <div id="activityLogContainer" class="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
          <div class="text-slate-500 py-2">Run the bot to see live clickable URLs of Text Polls, Image Cards, and Liked/Commented tweets!</div>
        </div>
      </section>
    </div>

    <!-- Navigation Tabs (4 Dedicated Tabs) -->
    <nav class="flex items-center gap-1.5 p-1.5 glass border border-slate-800 rounded-2xl overflow-x-auto">
      <button onclick="switchTab('accounts')" id="tabBtn-accounts" class="flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-white cursor-pointer whitespace-nowrap">👥 1. X Accounts &amp; Modes</button>
      <button onclick="switchTab('content')" id="tabBtn-content" class="flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">📊 2. Text Polls &amp; Image Studio</button>
      <button onclick="switchTab('gallery')" id="tabBtn-gallery" class="flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">⚙️ 3. Outreach, Queue &amp; Cron</button>
      <button onclick="switchTab('threads')" id="tabBtn-threads" class="flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">🧵 4. Threads Multi-Account Hub</button>
    </nav>

    <!-- TAB 1: X ACCOUNTS MANAGER WITH PER-ACCOUNT POST MODE -->
    <section id="tabPanel-accounts" class="space-y-5">
      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm sm:text-base font-bold text-white">Add X (Twitter) Account &amp; Choose Its Posting Mode</h2>
          <span class="text-xs text-sky-300 font-mono">💡 Choose whether each account posts [📊 Text Poll (No Link)], [🖼️ Image Card], or [⚡ Hybrid]!</span>
        </div>
        <form onsubmit="handleAddAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <input id="accUsername" type="text" required placeholder="@handle" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="accAuthToken" type="text" required placeholder="auth_token" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="accCt0" type="text" required placeholder="ct0 token" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <select id="accPostMode" class="w-full h-11 px-3 bg-slate-950 border border-sky-500/50 rounded-xl text-xs text-sky-300 font-bold">
            <option value="poll">📊 Text Poll Only (No Link)</option>
            <option value="image">🖼️ Image Card Mode</option>
            <option value="hybrid">⚡ Hybrid (Poll + Image)</option>
          </select>
          <input id="accProxy" type="text" placeholder="Proxy (Optional)" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <div class="flex gap-2">
            <select id="accStatus" class="w-full h-11 px-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
            <button type="submit" class="h-11 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap">+ Add</button>
          </div>
        </form>
      </div>

      <div class="glass border border-slate-800 rounded-2xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Configured X Fleet (Change Any Account's Mode Live Below!)</h3>
          <div class="flex gap-2">
            <button onclick="setAllAccountsMode('poll')" class="px-2.5 py-1 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold cursor-pointer">Set All -> 📊 Text Poll</button>
            <button onclick="setAllAccountsMode('image')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold cursor-pointer">Set All -> 🖼️ Image Card</button>
            <button onclick="setAllAccountsMode('hybrid')" class="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold cursor-pointer">Set All -> ⚡ Hybrid</button>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                <th class="py-3 px-4">Account &amp; Profile</th>
                <th class="py-3 px-4">Assigned Post Mode (Switch Anytime)</th>
                <th class="py-3 px-4">Last Bot Result</th>
                <th class="py-3 px-4">Last Run</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-slate-800/70 text-xs sm:text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: TEXT POLLS & CUSTOM IMAGE STUDIO -->
    <section id="tabPanel-content" class="hidden space-y-5">
      <!-- Custom Image Uploader -->
      <div class="glass border border-amber-500/40 rounded-2xl p-5 space-y-4 bg-amber-950/10">
        <div>
          <h3 class="text-sm sm:text-base font-bold text-amber-300">📸 Custom Model Image Uploader &amp; SafeSearch Censor Studio (For Image Mode Accounts)</h3>
          <p class="text-xs text-slate-300 mt-0.5">Upload downloaded model photos from your Phone/PC for accounts set to <b>🖼️ Image Card Mode</b>:</p>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center pt-2">
          <div class="space-y-3">
            <input id="customFileInput" type="file" accept="image/*" onchange="previewCustomCanvas()" class="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 cursor-pointer" />
            <label class="block text-xs font-bold text-slate-300 uppercase pt-1">Blur Intensity: <span id="blurValLabel" class="text-amber-400">10px</span></label>
            <input id="customBlurSlider" type="range" min="0" max="24" value="10" oninput="previewCustomCanvas()" class="w-full accent-amber-500 cursor-pointer" />
            <label class="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
              <input id="chkAddSafeBadge" type="checkbox" checked onchange="previewCustomCanvas()" class="w-4 h-4 accent-rose-500 rounded" />
              <span>Add <b>"🔞 SafeSearch Blur · Tap to View"</b> Badge</span>
            </label>
            <button onclick="uploadCanvasToGitHubVault()" id="btnUploadCustom" class="w-full py-2.5 bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer shadow-lg">📤 Upload to Priority Vault</button>
          </div>
          <div class="lg:col-span-2 flex flex-col items-center justify-center bg-slate-950/90 border border-slate-800 rounded-xl p-3 min-h-[200px]">
            <canvas id="safeSearchCanvas" width="960" height="540" class="w-full max-w-md rounded-lg border border-slate-800 shadow-lg"></canvas>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="glass border border-sky-500/40 rounded-2xl p-4 space-y-2 bg-sky-950/10">
          <div class="flex justify-between items-center">
            <h3 class="text-xs font-bold text-sky-300 uppercase">📊 Vertical Text Polls Pool (100% Zero-Link List Polls)</h3>
            <button onclick="loadDefaultPolls()" class="px-2 py-0.5 rounded bg-sky-600 text-[10px] text-white font-bold cursor-pointer">+ Load Viral Polls</button>
          </div>
          <p class="text-[11px] text-slate-400">Separate multiple multi-line polls with <code class="text-sky-300">---</code> on a new line. Used by accounts in <b>📊 Text Poll Mode</b>.</p>
          <textarea id="txtPolls" rows="8" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>

        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between">
            <h3 class="text-xs font-bold text-white uppercase">🖼️ Image Mode Captions (Spintax)</h3>
            <span id="countCaptions" class="text-xs text-sky-400 font-mono">0</span>
          </div>
          <p class="text-[11px] text-slate-400">Used by accounts in <b>🖼️ Image Card Mode</b>.</p>
          <textarea id="txtCaptions" rows="8" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>

        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-white uppercase">💬 Zero-Link Outreach Reply Comments (Spintax)</h3><span id="countReplies" class="text-xs text-emerald-400 font-mono">0</span></div>
          <textarea id="txtReplies" rows="5" oninput="syncContentFromTextareas()" placeholder="{omg wait till you see my pinned post 😳🔥|can someone rate my profile? be honest 👀}" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>

        <div class="glass border border-amber-500/40 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-amber-300 uppercase">⭐ Priority Custom Image Vault (config.images)</h3><span id="countImages" class="text-xs text-amber-400 font-mono">0</span></div>
          <textarea id="txtImages" rows="5" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: OUTREACH, QUEUE & GUARANTEED 2H CRON -->
    <section id="tabPanel-gallery" class="hidden space-y-5">
      <div class="glass border border-emerald-500/40 rounded-2xl p-5 space-y-3 bg-emerald-950/10">
        <h2 class="text-sm font-bold text-emerald-300 uppercase tracking-wider">⏰ 100% Guaranteed 2-Hour Auto-Run Setup (Fix GitHub Cron Delay)</h2>
        <p class="text-xs text-slate-300">GitHub Actions free cron can sometimes be delayed by GitHub's servers. To force your bot to run <b>every 2 hours on the dot</b> with Email Reports, copy your Direct Cron Webhook URL below and paste it into <a href="https://cron-job.org" target="_blank" class="text-sky-400 underline font-bold">cron-job.org</a> (Free):</p>
        <div class="flex gap-2">
          <input id="cronWebhookInput" type="text" readonly class="w-full h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-emerald-300 font-mono" value="Enter Admin PIN & Sync to generate your webhook URL..." />
          <button onclick="copyWebhookCronUrl()" class="px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold whitespace-nowrap cursor-pointer">📋 Copy Webhook</button>
        </div>
      </div>

      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider">Automation, Zero-Link Hijacking &amp; Pod Controls</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-emerald-400">❤️ Like &amp; Comment on Active Feed Posts (Zero-Link)</div><div class="text-[11px] text-slate-400">Likes &amp; replies to real tweets on Home Feed without any links</div></div>
            <input id="chkEnableOutreach" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-emerald-500 rounded" />
          </label>
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-white">Cross-Account Like &amp; Bookmark (Pod)</div><div class="text-[11px] text-slate-400">Other fleet accounts like &amp; bookmark your new posts</div></div>
            <input id="chkCrossLike" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded" />
          </label>
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-white">Cross-Account Retweet (Pod)</div><div class="text-[11px] text-slate-400">Retweets posts across your fleet</div></div>
            <input id="chkCrossRetweet" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded" />
          </label>
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div><div class="text-xs sm:text-sm font-bold text-white">Accounts Per Run</div><div class="text-[11px] text-slate-400">How many X accounts run per execution</div></div>
            <input id="numMaxAccounts" type="number" min="1" max="20" onchange="syncSettingsFromInputs()" class="w-20 h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono text-center" />
          </div>
        </div>
      </div>

      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-bold text-white">🔞 Image Mode Queue Preview (Next 8 Cards)</h3>
          <div class="flex gap-2">
            <button onclick="instantCloudRefill('mirror selfie girl')" class="px-3 py-1.5 rounded-lg bg-rose-600/80 text-white text-xs font-bold cursor-pointer">☁️ +30 Mirror Cards</button>
            <button onclick="state.mediaQueue=[];renderUI();" class="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-rose-300 cursor-pointer">🧹 Clear Queue</button>
          </div>
        </div>
        <div id="visualGalleryGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"></div>
        <textarea id="txtMediaQueue" rows="4" oninput="syncQueueFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono mt-2"></textarea>
        <textarea id="txtTargets" rows="2" oninput="syncContentFromTextareas()" placeholder="#thirsttrap" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        <textarea id="txtHarvestedUsers" rows="2" oninput="syncQueueFromTextareas()" placeholder="@users" class="w-full p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
      </div>
    </section>

    <!-- TAB 4: DEDICATED META THREADS MULTI-ACCOUNT HUB -->
    <section id="tabPanel-threads" class="hidden space-y-5">
      <div class="glass border border-purple-500/40 rounded-2xl p-5 space-y-4 bg-purple-950/10">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm sm:text-base font-bold text-purple-300">🧵 Meta Threads Multi-Account Auto-Poster Hub</h2>
            <p class="text-xs text-slate-300 mt-0.5">Add unlimited Meta Threads accounts below. Every time your bot runs, it will automatically post your Viral Vertical Text Polls or Images to all active Threads accounts via official Graph API (0% Ban Risk)!</p>
          </div>
        </div>

        <div class="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs text-slate-300 space-y-1 font-mono">
          <div class="text-purple-300 font-bold">🔑 How to get Threads User ID &amp; Access Token (Free in 2 Mins):</div>
          <div>1. Go to <b>developers.facebook.com/apps</b> -> Create App -> Choose <b>"Access the Threads API"</b>.</div>
          <div>2. In left menu click <b>Threads API -> Settings</b> -> Add your Threads account as a "Threads Tester" &amp; accept invite in your Threads App (Settings -> Account -> Website Permissions -> Invites).</div>
          <div>3. Click <b>Generate Access Token</b> -> Copy your <b>User ID</b> and <b>Access Token</b> and add them below!</div>
        </div>

        <form onsubmit="handleAddThreadsAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input id="thUsername" type="text" required placeholder="@threads_handle" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="thUserId" type="text" required placeholder="Threads User ID (e.g. 259182...)" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="thToken" type="text" required placeholder="Threads Access Token (THQVJ...)" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <select id="thMode" class="w-full h-11 px-3 bg-slate-950 border border-purple-500/50 rounded-xl text-xs text-purple-300 font-bold">
            <option value="poll">📊 Text Poll Mode</option>
            <option value="image">🖼️ Image Post Mode</option>
          </select>
          <button type="submit" class="h-11 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl cursor-pointer">+ Add Threads Account</button>
        </form>
      </div>

      <div class="glass border border-slate-800 rounded-2xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Configured Meta Threads Fleet</h3>
          <span id="threadsTableCount" class="text-xs text-purple-400 font-mono">0 accounts</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                <th class="py-3 px-4">Threads Handle</th>
                <th class="py-3 px-4">User ID</th>
                <th class="py-3 px-4">Post Mode</th>
                <th class="py-3 px-4">Last Status</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="threadsTableBody" class="divide-y divide-slate-800/70 text-xs sm:text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

  </div>

  <script>
    let state = {
      accounts: [], threadsAccounts: [], images: [], captions: [], polls: [], replies: [], targets: [],
      mediaQueue: [], usedMedia: [], harvestedUsers: [], activityLog: [],
      settings: {
        globalPostMode: 'per_account',
        enableOutreachLikesAndReplies: true,
        zeroLinksInOutreach: true,
        autoSelfReply: false,
        crossAccountLike: true,
        crossAccountRetweet: true,
        crossAccountBookmark: true,
        maxAccountsPerRun: 2
      }
    };
    let pollTimer = null;
    let loadedImageObj = null;

    const DEFAULT_POLLS_LIST = [
      "Would you kiss me even if I were {38|42} years old?\\n\\n︎\\n◯ Yes\\n︎\\n︎\\n◯ No\\n︎\\n︎\\n◯ Age is just a number ❤️",
      "Be honest... what's the first thing you notice about a girl?\\n\\n︎\\n◯ Eyes & Smile\\n︎\\n︎\\n◯ Curves & Figure 👀\\n︎\\n︎\\n◯ Vibe & Voice",
      "If I texted you \\"I can't sleep, come over\\" at 2 AM, what are you doing?\\n\\n︎\\n◯ On my way in 5 mins 🚗\\n︎\\n︎\\n◯ Asking for a selfie first 🙊\\n︎\\n︎\\n◯ Staying asleep",
      "Sach batana... late night chat ke liye kaunsi vibe best hai?\\n\\n︎\\n◯ Long drive & music 🌙\\n︎\\n︎\\n◯ Room lock & chill 🔒\\n︎\\n︎\\n◯ Video call 📱"
    ];

    const savedPass = sessionStorage.getItem('alcashx_pin');
    if (savedPass) document.getElementById('adminPassword').value = savedPass;

    function getPassword() {
      const val = document.getElementById('adminPassword').value.trim();
      if (val) sessionStorage.setItem('alcashx_pin', val);
      return val;
    }

    function showBanner(msg, isError = false) {
      const el = document.getElementById('toastBanner');
      el.classList.remove('hidden', 'bg-rose-950/90', 'border-rose-700', 'text-rose-200', 'bg-emerald-950/90', 'border-emerald-700', 'text-emerald-200');
      el.classList.add(isError ? 'bg-rose-950/90' : 'bg-emerald-950/90', isError ? 'border-rose-700' : 'border-emerald-700', isError ? 'text-rose-200' : 'text-emerald-200');
      el.textContent = msg;
    }

    function switchTab(tab) {
      ['accounts', 'content', 'gallery', 'threads'].forEach(t => {
        document.getElementById('tabPanel-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tabBtn-' + t).className = t === tab
          ? 'flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-white cursor-pointer whitespace-nowrap shadow'
          : 'flex-1 min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap';
      });
    }

    function copyWebhookCronUrl() {
      const pin = getPassword();
      if (!pin) return showBanner('Enter Admin PIN first!', true);
      const url = window.location.origin + '/api/admin?cron=1&pin=' + encodeURIComponent(pin);
      document.getElementById('cronWebhookInput').value = url;
      navigator.clipboard.writeText(url);
      showBanner('⏰ 2-Hour Cron Webhook URL copied! Paste it into cron-job.org to trigger every 2 hours on the dot.');
    }

    function loadDefaultPolls() {
      state.polls = [...DEFAULT_POLLS_LIST];
      renderUI();
      showBanner('📊 Loaded 4 Viral Vertical Text Polls! Click "💾 Save Changes".');
    }

    function setAllAccountsMode(mode) {
      state.accounts.forEach(a => { a.postMode = mode; });
      renderUI();
      showBanner('✅ Set all X accounts to ' + mode.toUpperCase() + ' mode! Click "💾 Save Changes" to apply.');
    }

    function changeAccountMode(idx, newMode) {
      state.accounts[idx].postMode = newMode;
      renderUI();
    }

    function toggleAccountStatus(idx) {
      state.accounts[idx].status = state.accounts[idx].status === 'active' ? 'paused' : 'active';
      renderUI();
    }

    function toggleThreadsStatus(idx) {
      state.threadsAccounts[idx].status = state.threadsAccounts[idx].status === 'active' ? 'paused' : 'active';
      renderUI();
    }

    function changeThreadsMode(idx, newMode) {
      state.threadsAccounts[idx].postMode = newMode;
      renderUI();
    }

    function handleAddAccount(e) {
      e.preventDefault();
      const username = document.getElementById('accUsername').value.trim();
      state.accounts.push({
        username: username.startsWith('@') ? username : '@' + username,
        auth_token: document.getElementById('accAuthToken').value.trim(),
        ct0: document.getElementById('accCt0').value.trim(),
        postMode: document.getElementById('accPostMode').value || 'poll',
        proxy: document.getElementById('accProxy').value.trim(),
        status: document.getElementById('accStatus').value
      });
      document.getElementById('accUsername').value = '';
      document.getElementById('accAuthToken').value = '';
      document.getElementById('accCt0').value = '';
      document.getElementById('accProxy').value = '';
      renderUI();
      showBanner('X Account added! Click "💾 Save Changes" to sync with GitHub.');
    }

    function handleAddThreadsAccount(e) {
      e.preventDefault();
      const username = document.getElementById('thUsername').value.trim();
      if (!Array.isArray(state.threadsAccounts)) state.threadsAccounts = [];
      state.threadsAccounts.push({
        username: username.startsWith('@') ? username : '@' + username,
        userId: document.getElementById('thUserId').value.trim(),
        accessToken: document.getElementById('thToken').value.trim(),
        postMode: document.getElementById('thMode').value || 'poll',
        status: 'active',
        lastStatus: '✅ Ready'
      });
      document.getElementById('thUsername').value = '';
      document.getElementById('thUserId').value = '';
      document.getElementById('thToken').value = '';
      renderUI();
      showBanner('🧵 Threads Account added! Click "💾 Save Changes" to sync.');
    }

    function initCanvasPlaceholder() {
      const canvas = document.getElementById('safeSearchCanvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Select a Model Photo from Phone/PC to Preview SafeSearch Blur', canvas.width / 2, canvas.height / 2);
    }

    function previewCustomCanvas() {
      const fileInput = document.getElementById('customFileInput');
      const blurPx = parseInt(document.getElementById('customBlurSlider').value || '10', 10);
      const addBadge = document.getElementById('chkAddSafeBadge').checked;
      document.getElementById('blurValLabel').textContent = blurPx + 'px';

      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const img = new Image();
          img.onload = function() {
            loadedImageObj = img;
            drawSafeSearchCanvas(img, blurPx, addBadge);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(fileInput.files[0]);
      } else if (loadedImageObj) {
        drawSafeSearchCanvas(loadedImageObj, blurPx, addBadge);
      }
    }

    function drawSafeSearchCanvas(img, blurPx, addBadge) {
      const canvas = document.getElementById('safeSearchCanvas');
      const ctx = canvas.getContext('2d');
      const cw = canvas.width, ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      ctx.filter = \`blur(\${blurPx}px) brightness(0.92) contrast(1.12)\`;
      const imgRatio = img.width / img.height;
      const canvasRatio = cw / ch;
      let drawW = cw, drawH = ch, offsetX = 0, offsetY = 0;
      if (imgRatio > canvasRatio) { drawW = ch * imgRatio; offsetX = -(drawW - cw) / 2; }
      else { drawH = cw / imgRatio; offsetY = -(drawH - ch) / 2; }
      ctx.drawImage(img, offsetX - 20, offsetY - 20, drawW + 40, drawH + 40);
      ctx.restore();

      if (addBadge) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.fillRect(0, 0, cw, ch);
        const boxW = 460, boxH = 110, bx = (cw - boxW) / 2, by = (ch - boxH) / 2;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.beginPath();
        ctx.roundRect(bx, by, boxW, boxH, 22);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔞 Sensitive Content (SafeSearch)', cw / 2, by + 46);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 20px monospace';
        ctx.fillText('▶ Tap Image to Unblur Full Clip', cw / 2, by + 84);
      }
    }

    async function uploadCanvasToGitHubVault() {
      if (!loadedImageObj) return showBanner('⚠️ Choose a model photo first!', true);
      const btn = document.getElementById('btnUploadCustom');
      btn.textContent = '⏳ Uploading...';
      btn.disabled = true;
      try {
        const canvas = document.getElementById('safeSearchCanvas');
        const base64Image = canvas.toDataURL('image/jpeg', 0.88);
        const data = await apiCall('upload_custom_image', { base64Image });
        if (data.url) {
          state.images = [data.url, ...(state.images || [])];
          state.mediaQueue = [data.url, ...(state.mediaQueue || [])];
          renderUI();
          showBanner(data.message);
        }
      } catch (err) {
        showBanner(err.message, true);
      } finally {
        btn.textContent = '📤 Upload to Priority Vault';
        btn.disabled = false;
      }
    }

    async function instantCloudRefill(niche) {
      showBanner('☁️ Harvesting 30+ SafeSearch Blurred Model Cards...');
      try {
        const data = await apiCall('cloud_scrape', { niche });
        if (Array.isArray(data.urls) && data.urls.length) {
          const usedSet = new Set(state.usedMedia || []);
          const fresh = data.urls.filter(u => !usedSet.has(u));
          state.mediaQueue = [...new Set([...fresh, ...(state.mediaQueue || [])])];
          renderUI();
          showBanner(data.message);
        }
      } catch (err) {
        showBanner(err.message, true);
      }
    }

    function renderRuns(runs) {
      const container = document.getElementById('runsListContainer');
      const statusEl = document.getElementById('statBotStatus');
      if (!Array.isArray(runs) || !runs.length) {
        container.innerHTML = '<div class="text-slate-500 py-2">No runs yet. Click "🚀 RUN BOT NOW" to launch!</div>';
        return;
      }
      const latest = runs[0];
      if (latest.status === 'in_progress' || latest.status === 'queued') {
        statusEl.textContent = '⏳ Running Live...';
        statusEl.className = 'text-sm font-bold text-amber-400 animate-pulse truncate';
      } else if (latest.conclusion === 'success') {
        statusEl.textContent = '✅ Autopilot Active';
        statusEl.className = 'text-sm font-bold text-emerald-400 truncate';
      } else {
        statusEl.textContent = '⚠️ Check Last Log';
        statusEl.className = 'text-sm font-bold text-rose-400 truncate';
      }
      container.innerHTML = runs.map(r => {
        const badge = (r.status === 'in_progress' || r.status === 'queued')
          ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">⏳ RUNNING</span>'
          : (r.conclusion === 'success'
            ? '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✅ SUCCESS</span>'
            : '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">❌ FAILED</span>');
        const dur = Math.max(1, Math.round((new Date(r.updatedAt) - new Date(r.createdAt)) / 1000));
        return \`
          <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div class="flex flex-wrap items-center gap-2">
              \${badge}
              <span class="text-slate-300">\${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span class="text-slate-500">(\${dur}s)</span>
            </div>
            <a href="\${r.url}" target="_blank" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold">📜 Step Logs ↗</a>
          </div>\`;
      }).join('');
    }

    function renderActivityLog() {
      const container = document.getElementById('activityLogContainer');
      const badgeEl = document.getElementById('activityCountBadge');
      const logs = Array.isArray(state.activityLog) ? state.activityLog : [];
      badgeEl.textContent = logs.length + ' actions logged';

      if (logs.length === 0) {
        container.innerHTML = '<div class="text-slate-500 py-2">No verified post/hijack logs yet. Run the bot to see live clickable URLs here!</div>';
        return;
      }

      container.innerHTML = logs.slice(0, 20).map(item => {
        const t = item.type || 'ACTION';
        const isOutreach = t.includes('HIJACK') || t.includes('COMMENT') || t.includes('LIKE');
        const isPoll = t.includes('POLL');
        const tagClass = isOutreach
          ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
          : (isPoll ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40');
        const tStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        return \`
          <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded border text-[10px] font-bold \${tagClass}">\${t}</span>
              <span class="text-white font-bold">\${item.account || ''}</span>
              <span class="text-slate-400 text-[11px]">\${item.detail || ''}</span>
              <span class="text-slate-600 text-[10px]">\${tStr}</span>
            </div>
            \${item.targetUrl ? \`<a href="\${item.targetUrl}" target="_blank" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold">Open Tweet ↗</a>\` : ''}
          </div>\`;
      }).join('');
    }

    function renderUI() {
      const activeAccs = state.accounts.filter(a => a.status === 'active');
      const pollAccs = activeAccs.filter(a => (a.postMode || 'poll') === 'poll').length;
      const imgAccs = activeAccs.filter(a => a.postMode === 'image').length;
      const hybAccs = activeAccs.filter(a => a.postMode === 'hybrid').length;

      document.getElementById('statActiveAccounts').textContent = activeAccs.length;
      document.getElementById('statTotalAccounts').textContent = 'of ' + state.accounts.length;
      document.getElementById('statPollVsImg').textContent = \`\${pollAccs} Poll · \${imgAccs} Img · \${hybAccs} Hyb\`;
      document.getElementById('statMediaQueue').textContent = (state.mediaQueue || []).length;
      document.getElementById('statCustomVault').textContent = (state.images || []).length + ' vault';
      document.getElementById('statThreadsCount').textContent = (state.threadsAccounts || []).filter(t => t.status === 'active').length;

      const pin = getPassword();
      if (pin) {
        document.getElementById('cronWebhookInput').value = window.location.origin + '/api/admin?cron=1&pin=' + encodeURIComponent(pin);
      }

      renderActivityLog();

      // Render X Accounts Table with Per-Account Mode Selector
      const tbody = document.getElementById('accountsTableBody');
      tbody.innerHTML = state.accounts.length === 0
        ? '<tr><td colspan="6" class="py-8 text-center text-slate-500">No X accounts added yet.</td></tr>'
        : state.accounts.map((acc, idx) => {
            const clean = acc.username.replace('@', '').trim();
            const mode = acc.postMode || 'poll';
            const statusText = acc.lastStatus || '✅ Ready';
            const lastTime = acc.lastRunAt ? new Date(acc.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';
            return \`
              <tr class="hover:bg-slate-800/30">
                <td class="py-3 px-4 font-mono font-bold text-white">
                  \${acc.username}
                  <a href="https://x.com/\${clean}" target="_blank" class="ml-2 text-[11px] text-sky-400 hover:underline">↗ Profile</a>
                </td>
                <td class="py-3 px-4">
                  <select onchange="changeAccountMode(\${idx}, this.value)" class="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-sky-300 cursor-pointer">
                    <option value="poll" \${mode === 'poll' ? 'selected' : ''}>📊 Text Poll (No Link)</option>
                    <option value="image" \${mode === 'image' ? 'selected' : ''}>🖼️ Image Card Mode</option>
                    <option value="hybrid" \${mode === 'hybrid' ? 'selected' : ''}>⚡ Hybrid (50/50)</option>
                  </select>
                </td>
                <td class="py-3 px-4"><span class="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200">\${statusText}</span></td>
                <td class="py-3 px-4 font-mono text-xs text-slate-400">\${lastTime}</td>
                <td class="py-3 px-4">
                  <button onclick="toggleAccountStatus(\${idx})" class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer \${acc.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                    \${acc.status === 'active' ? '🟢 ACTIVE' : '⏸️ PAUSED'}
                  </button>
                </td>
                <td class="py-3 px-4 text-right">
                  <button onclick="state.accounts.splice(\${idx},1);renderUI();" class="text-xs text-rose-400 hover:underline cursor-pointer">Delete</button>
                </td>
              </tr>\`;
          }).join('');

      // Render Meta Threads Accounts Table
      const thList = Array.isArray(state.threadsAccounts) ? state.threadsAccounts : [];
      document.getElementById('threadsTableCount').textContent = thList.length + ' accounts';
      const thBody = document.getElementById('threadsTableBody');
      thBody.innerHTML = thList.length === 0
        ? '<tr><td colspan="6" class="py-6 text-center text-slate-500">No Threads accounts added yet. Add one above to auto-post to Meta Threads!</td></tr>'
        : thList.map((th, idx) => \`
            <tr class="hover:bg-slate-800/30">
              <td class="py-3 px-4 font-mono font-bold text-purple-300">\${th.username}</td>
              <td class="py-3 px-4 font-mono text-xs text-slate-400">\${th.userId}</td>
              <td class="py-3 px-4">
                <select onchange="changeThreadsMode(\${idx}, this.value)" class="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-purple-300">
                  <option value="poll" \${(th.postMode || 'poll') === 'poll' ? 'selected' : ''}>📊 Text Poll Mode</option>
                  <option value="image" \${th.postMode === 'image' ? 'selected' : ''}>🖼️ Image Mode</option>
                </select>
              </td>
              <td class="py-3 px-4 font-mono text-xs text-slate-300">\${th.lastStatus || '✅ Ready'}</td>
              <td class="py-3 px-4">
                <button onclick="toggleThreadsStatus(\${idx})" class="px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer \${th.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}">
                  \${th.status === 'active' ? '🟢 ACTIVE' : '⏸️ PAUSED'}
                </button>
              </td>
              <td class="py-3 px-4 text-right">
                <button onclick="state.threadsAccounts.splice(\${idx},1);renderUI();" class="text-xs text-rose-400 hover:underline cursor-pointer">Delete</button>
              </td>
            </tr>\`).join('');

      const gallery = document.getElementById('visualGalleryGrid');
      const nextItems = (state.mediaQueue || []).slice(0, 8);
      gallery.innerHTML = nextItems.length === 0
        ? '<div class="col-span-4 py-6 text-center text-xs text-slate-500">Queue empty! Click "☁️ +30 Image Cards" at top right.</div>'
        : nextItems.map((url, i) => {
            const cleanPreview = url.replace('#noblur', '');
            return \`
              <div class="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-32 flex flex-col justify-between p-2">
                <img src="\${cleanPreview}" class="absolute inset-0 w-full h-full object-cover opacity-85" loading="lazy" />
                <div class="relative flex justify-between items-center z-10">
                  <span class="px-2 py-0.5 rounded bg-black/75 text-[10px] font-mono text-rose-300">#\${i + 1}</span>
                  <a href="\${cleanPreview}" target="_blank" class="px-2 py-0.5 rounded bg-black/75 text-[10px] text-sky-300">Open ↗</a>
                </div>
              </div>\`;
          }).join('');

      const pollsArr = (state.polls && state.polls.length) ? state.polls : DEFAULT_POLLS_LIST;
      document.getElementById('txtPolls').value = pollsArr.join('\\n---\\n');
      document.getElementById('txtImages').value = (state.images || []).join('\\n');
      document.getElementById('txtCaptions').value = (state.captions || []).join('\\n');
      document.getElementById('txtReplies').value = (state.replies || []).join('\\n');
      document.getElementById('txtTargets').value = (state.targets || []).join('\\n');
      document.getElementById('txtMediaQueue').value = (state.mediaQueue || []).join('\\n');
      document.getElementById('txtHarvestedUsers').value = (state.harvestedUsers || []).join('\\n');

      document.getElementById('countImages').textContent = (state.images || []).length + ' vault';
      document.getElementById('countCaptions').textContent = (state.captions || []).length + ' lines';
      document.getElementById('countReplies').textContent = (state.replies || []).length + ' lines';

      document.getElementById('chkEnableOutreach').checked = state.settings.enableOutreachLikesAndReplies !== false;
      document.getElementById('chkCrossLike').checked = Boolean(state.settings.crossAccountLike);
      document.getElementById('chkCrossRetweet').checked = Boolean(state.settings.crossAccountRetweet);
      document.getElementById('numMaxAccounts').value = state.settings.maxAccountsPerRun ?? 2;
    }

    function syncContentFromTextareas() {
      const split = id => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
      state.polls = document.getElementById('txtPolls').value.split(/\\n---\\n/).map(s => s.trim()).filter(Boolean);
      state.images = split('txtImages');
      state.captions = split('txtCaptions');
      state.replies = split('txtReplies');
      state.targets = split('txtTargets');
    }

    function syncQueueFromTextareas() {
      const split = id => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
      state.mediaQueue = split('txtMediaQueue');
      state.harvestedUsers = split('txtHarvestedUsers');
    }

    function syncSettingsFromInputs() {
      state.settings = {
        ...state.settings,
        enableOutreachLikesAndReplies: document.getElementById('chkEnableOutreach').checked,
        crossAccountLike: document.getElementById('chkCrossLike').checked,
        crossAccountRetweet: document.getElementById('chkCrossRetweet').checked,
        maxAccountsPerRun: parseInt(document.getElementById('numMaxAccounts').value || '2', 10)
      };
      renderUI();
    }

    async function apiCall(action, extra = {}) {
      const password = getPassword();
      if (!password) { showBanner('Enter Admin PIN first!', true); throw new Error('No PIN'); }
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password, ...extra })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Request Failed');
      return data;
    }

    async function loadConfigFromGitHub() {
      try {
        const data = await apiCall('load_config');
        state = {
          accounts: data.config.accounts || [],
          threadsAccounts: data.config.threadsAccounts || [],
          images: data.config.images || [],
          captions: data.config.captions || [],
          polls: data.config.polls || DEFAULT_POLLS_LIST,
          replies: data.config.replies || [],
          targets: data.config.targets || [],
          mediaQueue: data.config.mediaQueue || [],
          usedMedia: data.config.usedMedia || [],
          harvestedUsers: data.config.harvestedUsers || [],
          activityLog: data.config.activityLog || [],
          settings: data.config.settings || state.settings
        };
        document.getElementById('connBadge').textContent = '🟢 Live Synced';
        document.getElementById('connBadge').className = 'px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800';
        document.getElementById('connSubtext').textContent = 'Connected to GitHub Repo: ' + data.repo + ' (' + data.branch + ')';
        renderUI();
        renderRuns(data.runs || []);
        showBanner('✅ Synced latest live data from GitHub (' + data.repo + ')!');
        if (!pollTimer) pollTimer = setInterval(pollWorkflowRuns, 15000);
      } catch (err) {
        showBanner(err.message, true);
      }
    }

    async function pollWorkflowRuns() {
      try {
        const data = await apiCall('poll_runs');
        renderRuns(data.runs || []);
      } catch (_) {}
    }

    async function saveConfigToGitHub() {
      syncContentFromTextareas();
      syncQueueFromTextareas();
      syncSettingsFromInputs();
      try {
        const data = await apiCall('save_config', { config: state });
        if (data.config) state = data.config;
        renderUI();
        showBanner(data.message);
      } catch (err) {
        showBanner(err.message, true);
      }
    }

    async function triggerBotNow() {
      const statusEl = document.getElementById('statBotStatus');
      statusEl.textContent = '🚀 Launching...';
      try {
        const data = await apiCall('trigger_bot');
        statusEl.textContent = '⏳ Dispatched!';
        showBanner(data.message);
        setTimeout(pollWorkflowRuns, 3000);
        setTimeout(pollWorkflowRuns, 8000);
      } catch (err) {
        statusEl.textContent = '❌ Dispatch Error';
        showBanner(err.message, true);
      }
    }

    initCanvasPlaceholder();
    renderUI();
    if (getPassword()) loadConfigFromGitHub();
  </script>
</body>
</html>`;
}
