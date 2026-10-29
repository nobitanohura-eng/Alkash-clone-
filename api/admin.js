/**
 * AlcashX Cloud Pro v6.0 — Ultimate Command Center & Serverless Admin API (api/admin.js)
 * Upgraded in v6.0:
 *  1. 100% No-Blur Teaser MP4 Cloud Harvester (Aligned with scraper.js to prevent X Adult Blur)
 *  2. Auto-Purge Junk Filter on Save (Strips aacdn.net, mixkit.co, rule34 & non-MP4 links automatically)
 *  3. Live Bot Activity & Viral Hijack Proof Table (Click to verify exact tweets & hijacked comments!)
 *  4. Zero-Conflict Smart Merge + Pure Dispatch (Never overwrites background scraped queues)
 */

const DEFAULT_CONFIG = {
  accounts: [],
  images: [],
  captions: [],
  replies: [],
  targets: [],
  mediaQueue: [],
  usedMedia: [],
  harvestedUsers: [],
  activityLog: [],
  settings: {
    autoSelfReply: true,
    crossAccountLike: true,
    crossAccountRetweet: true,
    crossAccountBookmark: false,
    maxAccountsPerRun: 2
  },
  updatedAt: null
};

const BANNED_WORDS = [
  'jerkmate', 'chaturbate', 'stripchat', 'bonga', 'cam4', 'ad', 'promo',
  'hentai', 'anime', '3d', 'sfm', 'cartoon', 'animated', 'rule34', 'furry',
  'gay', 'trans', 'shemale', 'femboy', 'cuck', 'compilation',
  'blowjob', 'anal', 'cumshot', 'creampie', 'gangbang', 'penetration', 'hardcore', 'dildo', 'fucked'
];

// Built-in Serverless RedGifs Official API Harvester (Strictly Unblurred Teaser MP4s — No Posters!)
async function fetchFreshAdultMediaServerless(nicheQuery = 'tiktok tease') {
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
          'caught on camera',
          'shirt lift tease',
          'mirror bounce',
          'girlfriend tease',
          'desi saree tease',
          'bikini try on'
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
            if (g?.duration && (g.duration < 3.5 || g.duration > 18)) continue;
            const tags = (g?.tags || []).map((t) => String(t).toLowerCase());
            const desc = String(g?.description || '').toLowerCase();
            if (BANNED_WORDS.some((b) => tags.some((t) => t.includes(b)) || desc.includes(b))) {
              continue;
            }
            // ONLY push direct .mp4 video streams (Never push .jpg poster thumbnails!)
            const mp4Url = g?.urls?.sd || g?.urls?.hd;
            if (mp4Url && mp4Url.split('?')[0].toLowerCase().endsWith('.mp4')) {
              urls.push(mp4Url);
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

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(renderAdminHTML());
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, password, config, niche } = body;

      const expectedPassword = process.env.ADMIN_PASSWORD;
      const providedPassword = password || req.headers['x-admin-password'];

      if (!expectedPassword) {
        return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD not configured in Vercel Environment Variables.' });
      }
      if (!providedPassword || providedPassword !== expectedPassword) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin PIN.' });
      }

      const githubToken = process.env.GITHUB_TOKEN;
      const githubRepo = process.env.GITHUB_REPO;
      const branch = process.env.GITHUB_BRANCH || 'main';
      const filePath = 'data/config.json';

      if (!githubToken || !githubRepo) {
        return res.status(500).json({ ok: false, error: 'Missing GITHUB_TOKEN or GITHUB_REPO in Vercel.' });
      }

      const ghHeaders = {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AlcashX-Cloud-Pro-v6.0',
        'Content-Type': 'application/json'
      };

      const contentsUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

      // 1. LOAD CONFIG + LIVE GITHUB DIAGNOSTICS (WITH NO-CACHE GUARANTEE)
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

      // 3. INSTANT SERVERLESS CLOUD SCRAPER (1-CLICK PURE NO-BLUR MP4 QUEUE REFILL)
      if (action === 'cloud_scrape') {
        const freshUrls = await fetchFreshAdultMediaServerless(niche || 'tiktok tease');
        return res.status(200).json({
          ok: true,
          urls: freshUrls,
          message: `☁️ Pulled ${freshUrls.length} No-Blur Teaser MP4 videos! Click "💾 Save Changes" to lock them in.`
        });
      }

      // 4. SAVE CONFIG (WITH AUTO-RETRY ON 409 CONFLICT & JUNK PURGE FILTER)
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

          // Merge remote + local mediaQueue & strictly purge Rule34 (aacdn), Mixkit, and non-MP4s!
          const mergedQueue = [
            ...new Set([
              ...(Array.isArray(config.mediaQueue) ? config.mediaQueue : []),
              ...(Array.isArray(existingFileConfig.mediaQueue) ? existingFileConfig.mediaQueue : [])
            ])
          ].filter((u) => {
            if (!u || typeof u !== 'string') return false;
            const clean = u.toLowerCase().split('?')[0];
            if (u.includes('aacdn.net') || u.includes('rule34') || u.includes('mixkit.co')) return false;
            if (!clean.endsWith('.mp4')) return false;
            return !usedSet.has(u);
          });

          const mergedUsers = [
            ...new Set([
              ...(Array.isArray(config.harvestedUsers) ? config.harvestedUsers : []),
              ...(Array.isArray(existingFileConfig.harvestedUsers) ? existingFileConfig.harvestedUsers : [])
            ])
          ].filter((u) => !u.includes('simp_account') && !u.includes('active_user') && !u.includes('user1'));

          // Preserve bot's lastRunAt & lastStatus for accounts
          const remoteAccMap = new Map(
            (existingFileConfig.accounts || []).map((a) => [a.username, a])
          );
          const mergedAccounts = (Array.isArray(config.accounts) ? config.accounts : []).map((acc) => {
            const rem = remoteAccMap.get(acc.username);
            return {
              ...acc,
              lastRunAt: acc.lastRunAt || rem?.lastRunAt || null,
              lastStatus: acc.lastStatus || rem?.lastStatus || null
            };
          });

          const cleanImages = (Array.isArray(config.images) ? config.images : []).filter(
            (u) => u && !u.includes('mixkit.co') && !u.includes('aacdn.net')
          );

          const payloadToSave = {
            ...existingFileConfig,
            accounts: mergedAccounts,
            images: cleanImages,
            captions: Array.isArray(config.captions) ? config.captions : [],
            replies: Array.isArray(config.replies) ? config.replies : [],
            targets: Array.isArray(config.targets) ? config.targets : [],
            mediaQueue: mergedQueue.slice(0, 400),
            usedMedia: [...usedSet].slice(-2500),
            harvestedUsers: mergedUsers.slice(-200),
            activityLog: Array.isArray(existingFileConfig.activityLog)
              ? existingFileConfig.activityLog.slice(0, 60)
              : [],
            settings: {
              autoSelfReply: Boolean(config.settings?.autoSelfReply),
              crossAccountLike: Boolean(config.settings?.crossAccountLike),
              crossAccountRetweet: Boolean(config.settings?.crossAccountRetweet),
              crossAccountBookmark: Boolean(config.settings?.crossAccountBookmark),
              maxAccountsPerRun: Math.max(1, parseInt(config.settings?.maxAccountsPerRun ?? 2, 10) || 2)
            },
            updatedAt: new Date().toISOString()
          };

          const contentBase64 = Buffer.from(JSON.stringify(payloadToSave, null, 2), 'utf-8').toString('base64');
          const putBody = {
            message: `⚡ Sync config via AlcashX Command Center v6.0 [${new Date().toISOString()}]`,
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

          if (putRes.status === 409 && attempt === 1) {
            continue;
          }

          if (!putRes.ok) {
            const errText = await putRes.text();
            return res.status(putRes.status).json({ ok: false, error: `GitHub Save Error: ${errText}` });
          }

          const putResult = await putRes.json();
          return res.status(200).json({
            ok: true,
            message: `✅ Saved & Cleaned! Pure MP4 Queue: ${payloadToSave.mediaQueue.length} | Harvested Users: ${payloadToSave.harvestedUsers.length}`,
            sha: putResult.content?.sha || null,
            config: payloadToSave
          });
        }
      }

      // 5. TRIGGER BOT NOW (PURE DISPATCH)
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
            message: `🚀 Autonomous Bot v6.0 Dispatched! Watch Live Monitor & Check Gmail after completion.`
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
  <title>AlcashX Cloud Pro v6.0 — Autonomous Traffic & Revenue Center</title>
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
          <span class="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md bg-gradient-to-r from-emerald-500/20 to-sky-500/20 text-emerald-300 border border-emerald-500/30">v6.0 ANTI-BLUR + EMAIL</span>
          <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-white">AlcashX Command Center</h1>
          <span id="connBadge" class="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">⚪ Standby</span>
        </div>
        <p id="connSubtext" class="text-xs text-slate-400 mt-1">No-Blur Micro-Video Engine · Pinned-Safe Linker · Automated Gmail Telemetry</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <input id="adminPassword" type="password" placeholder="Admin PIN" class="w-full sm:w-40 h-10 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500" />
        <button onclick="loadConfigFromGitHub()" class="h-10 px-3.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer">🔄 Sync GitHub</button>
        <button onclick="instantCloudRefill('tiktok tease')" class="h-10 px-3.5 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer shadow">☁️ +30 Trap MP4s</button>
        <button onclick="saveConfigToGitHub()" class="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer shadow-lg">💾 Save Changes</button>
      </div>
    </header>

    <div id="toastBanner" class="hidden rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold transition-all"></div>

    <!-- Real-Time KPI & Revenue Estimator Grid -->
    <section class="grid grid-cols-2 lg:grid-cols-6 gap-3.5 items-stretch">
      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Active Fleet</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statActiveAccounts" class="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">0</span>
          <span id="statTotalAccounts" class="text-xs text-slate-400 font-mono">of 0</span>
        </div>
      </div>

      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pure MP4 Queue</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statMediaQueue" class="text-2xl sm:text-3xl font-extrabold text-sky-400 font-mono">0</span>
          <span id="statUsedMedia" class="text-xs text-slate-400 font-mono">0 posted</span>
        </div>
      </div>

      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Harvested @Users</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statHarvestedUsers" class="text-2xl sm:text-3xl font-extrabold text-purple-400 font-mono">0</span>
          <span class="text-xs text-slate-400 font-mono">real users</span>
        </div>
      </div>

      <div class="glass border border-emerald-500/30 rounded-2xl p-4 flex flex-col justify-between bg-emerald-950/10">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Est. Daily Output</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statDailyPosts" class="text-xl sm:text-2xl font-extrabold text-amber-400 font-mono">24 posts</span>
          <span id="statEstClicks" class="text-[11px] text-emerald-400 font-mono">~12 runs/day</span>
        </div>
      </div>

      <div class="glass border border-slate-800/90 rounded-2xl p-4 flex flex-col justify-between">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Engine State</span>
        <div class="mt-2 flex flex-col">
          <span id="statBotStatus" class="text-sm font-bold text-emerald-400 truncate">Ready · Autopilot</span>
          <span id="statRepoInfo" class="text-[10px] text-slate-500 font-mono truncate">Every 2h Cron Active</span>
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
      <!-- Workflow Runs -->
      <section class="glass border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <h2 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">GitHub Actions Stream (bot.yml)</h2>
          </div>
          <div class="flex items-center gap-2">
            <a href="https://fan-page-orpin-mu.vercel.app" target="_blank" class="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[11px] font-mono hover:bg-rose-500/30">🔞 Pre-Lander ↗</a>
            <button onclick="pollWorkflowRuns()" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-sky-400 font-mono cursor-pointer">🔄 Refresh</button>
          </div>
        </div>
        <div id="runsListContainer" class="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
          <div class="text-slate-500 py-2">Enter Admin PIN and click "Sync GitHub" to view live cloud runs...</div>
        </div>
      </section>

      <!-- Live Bot Activity & Viral Hijack Proof Table -->
      <section class="glass border border-slate-800/90 rounded-2xl p-4 sm:p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-sm">🎯</span>
            <h2 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Verified Posts &amp; Viral Hijack Proof Log</h2>
          </div>
          <span id="activityCountBadge" class="text-[11px] font-mono text-emerald-400">0 actions logged</span>
        </div>
        <div id="activityLogContainer" class="space-y-2 text-xs font-mono max-h-60 overflow-y-auto">
          <div class="text-slate-500 py-2">No verified post/hijack logs yet. Run the bot to see exact clickable tweet &amp; comment URLs here!</div>
        </div>
      </section>
    </div>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1.5 p-1.5 glass border border-slate-800 rounded-2xl overflow-x-auto">
      <button onclick="switchTab('accounts')" id="tabBtn-accounts" class="flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-white cursor-pointer whitespace-nowrap">👥 1. Fleet Accounts</button>
      <button onclick="switchTab('content')" id="tabBtn-content" class="flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">🔥 2. High-CPM Viral Studio</button>
      <button onclick="switchTab('gallery')" id="tabBtn-gallery" class="flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">🎬 3. Visual Queue &amp; Pod Settings</button>
    </nav>

    <!-- TAB 1: ACCOUNTS MANAGER -->
    <section id="tabPanel-accounts" class="space-y-5">
      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm sm:text-base font-bold text-white">Add X (Twitter) Account to Autonomous Fleet</h2>
          <span class="text-xs text-amber-300 font-mono">💡 Tip: Our v6.0 scraper uses No-Blur Teasers + 32-Byte Hash Mutation for smooth auto-play!</span>
        </div>
        <form onsubmit="handleAddAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input id="accUsername" type="text" required placeholder="@handle" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="accAuthToken" type="text" required placeholder="auth_token (40 hex chars)" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="accCt0" type="text" required placeholder="ct0 token" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <input id="accProxy" type="text" placeholder="Proxy (Optional)" class="w-full h-11 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono" />
          <div class="flex gap-2">
            <select id="accStatus" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
            <button type="submit" class="h-11 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl cursor-pointer whitespace-nowrap">+ Add</button>
          </div>
        </form>
      </div>

      <div class="glass border border-slate-800 rounded-2xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Configured Accounts (Auto-Rotates by Oldest Run)</h3>
          <span id="accountsTableCount" class="text-xs text-slate-400 font-mono">0 accounts</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-[11px] uppercase text-slate-400 bg-slate-950/60">
                <th class="py-3 px-4">Account &amp; Profile Link</th>
                <th class="py-3 px-4">Health &amp; Last Bot Status</th>
                <th class="py-3 px-4">Last Run Time</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-slate-800/70 text-xs sm:text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: HIGH-CPM VIRAL STUDIO -->
    <section id="tabPanel-content" class="hidden space-y-5">
      <div class="glass border border-sky-500/30 rounded-2xl p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-bold text-sky-300">💰 1-Click High-Converting Niche Packs &amp; Cloud MP4 Puller</h3>
            <p class="text-xs text-slate-400 mt-0.5">Select a high-converting niche preset below or pull 30+ fresh amateur trap MP4s directly from the cloud:</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="loadNichePreset('tier1')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow">🇺🇸 Tier-1 AmateurGF / Solo Trap Pack</button>
            <button onclick="loadNichePreset('desi')" class="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow">🇮🇳 Desi Bhabhi / Room MMS Pack</button>
            <button onclick="loadNichePreset('hookup')" class="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow">🔥 Late-Night Hookup Bait Pack</button>
            <button onclick="copyAgentPrompt()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs rounded-xl border border-slate-700 cursor-pointer">📋 Copy AI Scraper Prompt</button>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-800/80 space-y-2">
          <textarea id="aiRawInput" rows="3" placeholder="Paste AI JSON output OR raw .mp4 URLs here to bulk-import..." class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"></textarea>
          <button onclick="extractAiPack()" class="w-full py-2.5 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-xs rounded-xl cursor-pointer shadow">⚡ Auto-Extract &amp; Merge into MP4 Queue</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-white uppercase">Main Post Spintax Captions (Clean)</h3><span id="countCaptions" class="text-xs text-sky-400 font-mono">0</span></div>
          <textarea id="txtCaptions" rows="6" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-white uppercase">Self-Reply Comment Templates (With {{LINK}})</h3><span id="countReplies" class="text-xs text-emerald-400 font-mono">0</span></div>
          <textarea id="txtReplies" rows="6" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-white uppercase">Target Hashtags &amp; Search Queries</h3><span id="countTargets" class="text-xs text-purple-400 font-mono">0</span></div>
          <textarea id="txtTargets" rows="5" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-white uppercase">Custom Direct MP4 URLs</h3><span id="countImages" class="text-xs text-amber-400 font-mono">0</span></div>
          <textarea id="txtImages" rows="5" oninput="syncContentFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: VISUAL QUEUE & POD SETTINGS -->
    <section id="tabPanel-gallery" class="hidden space-y-5">
      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-white">🎬 Visual MP4 Queue Inspector (Next 8 Videos to Post)</h3>
            <p class="text-xs text-slate-400">Strictly pure <code class="text-sky-400">.mp4</code> videos. Rule34/Mixkit/Posters are automatically purged.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="instantCloudRefill('mirror bounce')" class="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer">☁️ +30 TikTok Tease MP4s</button>
            <button onclick="instantCloudRefill('desi saree tease')" class="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer">☁️ +30 Desi Tease MP4s</button>
            <button onclick="state.mediaQueue=[];renderUI();showBanner('🧹 Queue cleared! Click +30 Trap MP4s then Save Changes.');" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-rose-300 cursor-pointer">🧹 Clear Queue</button>
          </div>
        </div>
        <div id="visualGalleryGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2"></div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-sky-400 uppercase">Raw Scraped MP4 Queue (mediaQueue)</h3><span id="countMediaQueue" class="text-xs text-slate-400 font-mono">0</span></div>
          <textarea id="txtMediaQueue" rows="6" oninput="syncQueueFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="glass border border-slate-800 rounded-2xl p-4 space-y-2">
          <div class="flex justify-between"><h3 class="text-xs font-bold text-purple-400 uppercase">Harvested Real @Users (harvestedUsers)</h3><span id="countHarvested" class="text-xs text-slate-400 font-mono">0</span></div>
          <textarea id="txtHarvestedUsers" rows="6" oninput="syncQueueFromTextareas()" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>

      <div class="glass border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 class="text-sm font-bold text-white uppercase tracking-wider">Automation &amp; Anti-Ban Controls</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-white">Auto-Self-Reply Money Link + Card</div><div class="text-[11px] text-slate-400">Posts clickable Fanpage Card comment under every video</div></div>
            <input id="chkAutoSelfReply" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-emerald-500 rounded" />
          </label>
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-white">Cross-Account Like (Pod)</div><div class="text-[11px] text-slate-400">Boost engagement across your accounts</div></div>
            <input id="chkCrossLike" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded" />
          </label>
          <label class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer">
            <div><div class="text-xs sm:text-sm font-bold text-white">Cross-Account Retweet (Pod)</div><div class="text-[11px] text-slate-400">Retweets posts across fleet</div></div>
            <input id="chkCrossRetweet" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded" />
          </label>
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div><div class="text-xs sm:text-sm font-bold text-white">Accounts Per Run (2h Cron)</div><div class="text-[11px] text-slate-400">Recommended: 2 or 3 for safe rotation</div></div>
            <input id="numMaxAccounts" type="number" min="1" max="20" onchange="syncSettingsFromInputs()" class="w-20 h-10 px-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-mono text-center" />
          </div>
        </div>
      </div>
    </section>

  </div>

  <script>
    let state = {
      accounts: [], images: [], captions: [], replies: [], targets: [],
      mediaQueue: [], usedMedia: [], harvestedUsers: [], activityLog: [],
      settings: { autoSelfReply: true, crossAccountLike: true, crossAccountRetweet: true, crossAccountBookmark: false, maxAccountsPerRun: 2 }
    };
    let pollTimer = null;

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
      ['accounts', 'content', 'gallery'].forEach(t => {
        document.getElementById('tabPanel-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tabBtn-' + t).className = t === tab
          ? 'flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-slate-800 text-white cursor-pointer whitespace-nowrap shadow'
          : 'flex-1 min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap';
      });
    }

    function loadNichePreset(type) {
      if (type === 'tier1') {
        state.captions = [
          "{Caught me being|Feeling so|Just being} {naughty alone|playful in bed|horny tonight} {🙊💦|😈🔥|👀|✌️🐆}",
          "{Wait till 0:03 😳|Don't pause this|Did I show too much?|Deleting this in 10 mins} {😳💦|🤫🔥|😈}",
          "{can't sleep in my dorm, who wants the full video? 🌙|my camera roll is dangerous tonight 🙊🔥|am I your type? be honest 👀💦}",
          "{My camera roll is dangerous|Too risky for X?|Should I post part 2?} {🙊|😈|🔥|👇}"
        ];
        state.replies = [
          "{Full 3 min uncut video|Watch what happened next without censor|The rest of this clip is too spicy for X} right here 👇🔞 {{LINK}}",
          "{Couldn't post the full 2 min video here}, watch the uncut version free on my VIP page 👉 {{LINK}} 🔥"
        ];
        state.targets = ["#thirsttrap", "#nsfwtwt", "#egirl"];
      } else if (type === 'desi') {
        state.captions = [
          "{Late night mood|No one is home tonight|Feeling so bored alone in bed} {🙊💦|😈🔥|👀}",
          "{Wait till the end 😳|Deleting this room video in 15 mins|Did I cross the limit?} {🤫|💦|🔥}",
          "{Anyone awake right now? 🌙|Desi curves hit different, agree? 👀|Should I upload the full uncut MMS? 🙊}"
        ];
        state.replies = [
          "{Full 3 min uncut room video|Watch the full leaked clip before I delete} right here 👇🔞 {{LINK}}",
          "{Too hot to post on X}, watch my private uncensored video free here 👉 {{LINK}} 💦🔥"
        ];
        state.targets = ["#desimms", "#indianbhabhi", "#thirsttrap"];
      } else {
        state.captions = [
          "{Be honest, would you help me finish|Could you handle all this|If I sent you my private link, would you watch}? {😳|😈|💦}",
          "{18+ only! Don't open my replies if you're in public 🤫|My ex hated when I posted videos like this 👀🔥}"
        ];
        state.replies = [
          "18+ Only! Unlock my full private uncensored archive for free right here 👇🔞 {{LINK}} 💦"
        ];
        state.targets = ["#thirsttrap", "#nsfwtwt", "#GFMode"];
      }
      renderUI();
      showBanner('🔥 Loaded ' + type.toUpperCase() + ' High-Converting Preset! Click "💾 Save Changes" to apply.');
    }

    async function instantCloudRefill(niche) {
      showBanner('☁️ Fetching 30+ No-Blur Teaser MP4 videos from RedGifs Cloud API...');
      try {
        const data = await apiCall('cloud_scrape', { niche });
        if (Array.isArray(data.urls) && data.urls.length) {
          const usedSet = new Set(state.usedMedia || []);
          const fresh = data.urls.filter(u => !usedSet.has(u) && u.split('?')[0].toLowerCase().endsWith('.mp4'));
          state.mediaQueue = [...new Set([...fresh, ...(state.mediaQueue || [])])];
          renderUI();
          showBanner(data.message);
        } else {
          showBanner('⚠️ Cloud API returned 0 items right now. Try again in a moment.', true);
        }
      } catch (err) {
        showBanner(err.message, true);
      }
    }

    function copyAgentPrompt() {
      const p = \`Return ONLY a valid JSON object with 15 direct .mp4 video URLs (from RedGifs/amateur feeds) in "mediaQueue", 10 lustful/teasing spintax "captions" (no links), 10 urgent self-reply templates in "replies" containing {{LINK}}, and 5 hashtags in "targets".\`;
      navigator.clipboard.writeText(p);
      showBanner('📋 Master AI Scraper Prompt copied to clipboard!');
    }

    function extractAiPack() {
      const raw = document.getElementById('aiRawInput').value.trim();
      if (!raw) return showBanner('Paste JSON or MP4 links first!', true);
      let ok = false;
      try {
        const m = raw.match(/\\{[\\s\\S]*\\}/);
        if (m) {
          const p = JSON.parse(m[0]);
          if (Array.isArray(p.mediaQueue)) { state.mediaQueue = [...new Set([...p.mediaQueue, ...state.mediaQueue])]; ok = true; }
          if (Array.isArray(p.captions)) { state.captions = [...new Set([...state.captions, ...p.captions])]; ok = true; }
          if (Array.isArray(p.replies)) { state.replies = [...new Set([...state.replies, ...p.replies])]; ok = true; }
          if (Array.isArray(p.targets)) { state.targets = [...new Set([...state.targets, ...p.targets])]; ok = true; }
        }
      } catch (_) {}
      const urls = raw.match(/https?:\\/\\/[^\\s"'<>\\\\]+\\.mp4/gi) || [];
      if (urls.length) { state.mediaQueue = [...new Set([...urls, ...state.mediaQueue])]; ok = true; }
      if (ok) { renderUI(); showBanner('⚡ Extracted into MP4 Queue! Click "💾 Save Changes".'); }
      else showBanner('No valid JSON or direct .mp4 links found.', true);
    }

    function toggleAccountStatus(idx) {
      state.accounts[idx].status = state.accounts[idx].status === 'active' ? 'paused' : 'active';
      renderUI();
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
        container.innerHTML = '<div class="text-slate-500 py-2">No verified post/hijack logs yet. Run the bot to see live clickable tweet &amp; comment URLs here!</div>';
        return;
      }

      container.innerHTML = logs.slice(0, 15).map(item => {
        const isHijack = (item.type || '').includes('HIJACK');
        const isPod = (item.type || '').includes('POD');
        const isAlert = (item.type || '').includes('LOCKED');
        const tagClass = isAlert
          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
          : (isHijack
            ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
            : (isPod ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'));
        const tStr = item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        return \`
          <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-0.5 rounded border text-[10px] font-bold \${tagClass}">\${item.type || 'ACTION'}</span>
              <span class="text-white font-bold">\${item.account || ''}</span>
              <span class="text-slate-400 text-[11px]">\${item.detail || ''}</span>
              <span class="text-slate-600 text-[10px]">\${tStr}</span>
            </div>
            \${item.targetUrl ? \`<a href="\${item.targetUrl}" target="_blank" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold">Open Tweet ↗</a>\` : ''}
          </div>\`;
      }).join('');
    }

    function renderUI() {
      const activeCount = state.accounts.filter(a => a.status === 'active').length;
      const maxPerRun = Math.max(1, parseInt(state.settings.maxAccountsPerRun || 2, 10));
      const dailyPosts = Math.min(activeCount, maxPerRun) * 12;

      document.getElementById('statActiveAccounts').textContent = activeCount;
      document.getElementById('statTotalAccounts').textContent = 'of ' + state.accounts.length;
      document.getElementById('statMediaQueue').textContent = (state.mediaQueue || []).length;
      document.getElementById('statUsedMedia').textContent = (state.usedMedia || []).length + ' posted';
      document.getElementById('statHarvestedUsers').textContent = (state.harvestedUsers || []).length;
      document.getElementById('statDailyPosts').textContent = dailyPosts + ' posts/d';
      document.getElementById('accountsTableCount').textContent = state.accounts.length + ' accounts';

      renderActivityLog();

      const tbody = document.getElementById('accountsTableBody');
      tbody.innerHTML = state.accounts.length === 0
        ? '<tr><td colspan="5" class="py-8 text-center text-slate-500">No accounts added yet.</td></tr>'
        : state.accounts.map((acc, idx) => {
            const clean = acc.username.replace('@', '').trim();
            const statusText = acc.lastStatus || '✅ Ready for Next Run';
            const lastTime = acc.lastRunAt ? new Date(acc.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending';
            return \`
              <tr class="hover:bg-slate-800/30">
                <td class="py-3 px-4 font-mono font-bold text-white">
                  \${acc.username}
                  <a href="https://x.com/\${clean}" target="_blank" class="ml-2 text-[11px] text-sky-400 hover:underline">↗ Profile</a>
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

      const gallery = document.getElementById('visualGalleryGrid');
      const nextItems = (state.mediaQueue || []).slice(0, 8);
      gallery.innerHTML = nextItems.length === 0
        ? '<div class="col-span-4 py-6 text-center text-xs text-slate-500">Queue empty! Click "☁️ +30 Trap MP4s" at top right to refill immediately.</div>'
        : nextItems.map((url, i) => {
            return \`
              <div class="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 h-28 flex flex-col justify-between p-2.5">
                <div class="flex justify-between items-center z-10">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-mono text-emerald-300">#\${i + 1} 🎬 MP4</span>
                  <a href="\${url}" target="_blank" class="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-sky-300 hover:bg-slate-700">Preview ↗</a>
                </div>
                <div class="text-[10px] font-mono text-slate-400 truncate bg-black/60 p-1.5 rounded z-10">\${url}</div>
              </div>\`;
          }).join('');

      document.getElementById('txtImages').value = (state.images || []).join('\\n');
      document.getElementById('txtCaptions').value = (state.captions || []).join('\\n');
      document.getElementById('txtReplies').value = (state.replies || []).join('\\n');
      document.getElementById('txtTargets').value = (state.targets || []).join('\\n');
      document.getElementById('txtMediaQueue').value = (state.mediaQueue || []).join('\\n');
      document.getElementById('txtHarvestedUsers').value = (state.harvestedUsers || []).join('\\n');

      document.getElementById('countImages').textContent = (state.images || []).length + ' items';
      document.getElementById('countCaptions').textContent = (state.captions || []).length + ' lines';
      document.getElementById('countReplies').textContent = (state.replies || []).length + ' lines';
      document.getElementById('countTargets').textContent = (state.targets || []).length + ' lines';
      document.getElementById('countMediaQueue').textContent = (state.mediaQueue || []).length + ' queued';
      document.getElementById('countHarvested').textContent = (state.harvestedUsers || []).length + ' users';

      document.getElementById('chkAutoSelfReply').checked = Boolean(state.settings.autoSelfReply);
      document.getElementById('chkCrossLike').checked = Boolean(state.settings.crossAccountLike);
      document.getElementById('chkCrossRetweet').checked = Boolean(state.settings.crossAccountRetweet);
      document.getElementById('numMaxAccounts').value = state.settings.maxAccountsPerRun ?? 2;
    }

    function handleAddAccount(e) {
      e.preventDefault();
      const username = document.getElementById('accUsername').value.trim();
      state.accounts.push({
        username: username.startsWith('@') ? username : '@' + username,
        auth_token: document.getElementById('accAuthToken').value.trim(),
        ct0: document.getElementById('accCt0').value.trim(),
        proxy: document.getElementById('accProxy').value.trim(),
        status: document.getElementById('accStatus').value
      });
      document.getElementById('accUsername').value = '';
      document.getElementById('accAuthToken').value = '';
      document.getElementById('accCt0').value = '';
      document.getElementById('accProxy').value = '';
      renderUI();
      showBanner('Account added! Click "💾 Save Changes" to sync with GitHub.');
    }

    function syncContentFromTextareas() {
      const split = id => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
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
        autoSelfReply: document.getElementById('chkAutoSelfReply').checked,
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
          images: data.config.images || [],
          captions: data.config.captions || [],
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

    renderUI();
    if (getPassword()) loadConfigFromGitHub();
  </script>
</body>
</html>`;
}
