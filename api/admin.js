/**
 * AlcashX Cloud Pro — Single-File Vercel Serverless Function (api/admin.js)
 * Upgraded with:
 *  - Live GitHub Actions Telemetry & Step Logs Link
 *  - Master AI Scraper Prompt & 1-Click Full Queue/Spintax/Users Auto-Extractor
 *  - Account Live Session Health Status (lastStatus & lastRunAt from bot/run.js)
 *  - Safe Queue Preservation (mediaQueue, usedMedia, harvestedUsers)
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
  settings: {
    autoSelfReply: true,
    crossAccountLike: true,
    crossAccountRetweet: true,
    crossAccountBookmark: false,
    maxAccountsPerRun: 1
  },
  updatedAt: null
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(renderAdminHTML());
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, password, config } = body;

      const expectedPassword = process.env.ADMIN_PASSWORD;
      const providedPassword = password || req.headers['x-admin-password'];

      if (!expectedPassword) {
        return res.status(500).json({ ok: false, error: 'Server configuration error: ADMIN_PASSWORD not set in Vercel.' });
      }

      if (!providedPassword || providedPassword !== expectedPassword) {
        return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid Admin Password / PIN.' });
      }

      const githubToken = process.env.GITHUB_TOKEN;
      const githubRepo = process.env.GITHUB_REPO;
      const branch = process.env.GITHUB_BRANCH || 'main';
      const filePath = 'data/config.json';

      if (!githubToken || !githubRepo) {
        return res.status(500).json({ ok: false, error: 'Missing GITHUB_TOKEN or GITHUB_REPO environment variables.' });
      }

      const ghHeaders = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AlcashX-Cloud-Pro-Serverless',
        'Content-Type': 'application/json'
      };

      const contentsUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

      // 1. LOAD CONFIG + LIVE GITHUB DIAGNOSTICS
      if (action === 'load_config') {
        const [getRes, runsRes] = await Promise.all([
          fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: ghHeaders }),
          fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?per_page=5`, { method: 'GET', headers: ghHeaders })
        ]);

        let runs = [];
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          runs = (runsData.workflow_runs || []).map(r => ({
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
        } catch (e) {
          parsedConfig = DEFAULT_CONFIG;
        }

        return res.status(200).json({
          ok: true,
          repo: githubRepo,
          branch,
          sha: fileData.sha,
          config: parsedConfig,
          runs
        });
      }

      // 2. LIVE WORKFLOW RUNS POLLING (LIGHTWEIGHT)
      if (action === 'poll_runs') {
        const runsRes = await fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?per_page=5`, {
          method: 'GET',
          headers: ghHeaders
        });
        let runs = [];
        if (runsRes.ok) {
          const runsData = await runsRes.json();
          runs = (runsData.workflow_runs || []).map(r => ({
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

      // 3. SAVE CONFIG (SAFE MERGE: PRESERVES SCRAPER MEDIA QUEUE & HARVESTED USERS)
      if (action === 'save_config') {
        if (!config || typeof config !== 'object') {
          return res.status(400).json({ ok: false, error: 'Invalid payload: config object required.' });
        }

        let existingSha = null;
        let existingFileConfig = {};

        const shaRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: ghHeaders });
        if (shaRes.ok) {
          const existingData = await shaRes.json();
          existingSha = existingData.sha;
          try {
            existingFileConfig = JSON.parse(Buffer.from(existingData.content, 'base64').toString('utf-8'));
          } catch (_) {}
        }

        const payloadToSave = {
          ...existingFileConfig,
          accounts: Array.isArray(config.accounts) ? config.accounts : [],
          images: Array.isArray(config.images) ? config.images : [],
          captions: Array.isArray(config.captions) ? config.captions : [],
          replies: Array.isArray(config.replies) ? config.replies : [],
          targets: Array.isArray(config.targets) ? config.targets : [],
          mediaQueue: Array.isArray(config.mediaQueue) ? config.mediaQueue : (existingFileConfig.mediaQueue || []),
          usedMedia: Array.isArray(config.usedMedia) ? config.usedMedia : (existingFileConfig.usedMedia || []),
          harvestedUsers: Array.isArray(config.harvestedUsers) ? config.harvestedUsers : (existingFileConfig.harvestedUsers || []),
          settings: {
            autoSelfReply: Boolean(config.settings?.autoSelfReply),
            crossAccountLike: Boolean(config.settings?.crossAccountLike),
            crossAccountRetweet: Boolean(config.settings?.crossAccountRetweet),
            crossAccountBookmark: Boolean(config.settings?.crossAccountBookmark),
            maxAccountsPerRun: Math.max(1, parseInt(config.settings?.maxAccountsPerRun ?? 1, 10) || 1)
          },
          updatedAt: new Date().toISOString()
        };

        const contentBase64 = Buffer.from(JSON.stringify(payloadToSave, null, 2), 'utf-8').toString('base64');
        const putBody = {
          message: `chore(admin): update data/config.json via AlcashX Cloud Pro [${new Date().toISOString()}]`,
          content: contentBase64,
          branch
        };
        if (existingSha) putBody.sha = existingSha;

        const putRes = await fetch(contentsUrl, { method: 'PUT', headers: ghHeaders, body: JSON.stringify(putBody) });
        if (!putRes.ok) {
          const errText = await putRes.text();
          return res.status(putRes.status).json({ ok: false, error: `Failed to save config: ${errText}` });
        }

        const putResult = await putRes.json();
        return res.status(200).json({
          ok: true,
          message: '✅ Configuration saved to GitHub (Scraper queues & users synced!)',
          sha: putResult.content?.sha || null,
          config: payloadToSave
        });
      }

      // 4. TRIGGER BOT NOW
      if (action === 'trigger_bot') {
        const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/bot.yml/dispatches`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ ref: branch })
        });
        if (dispatchRes.status === 204 || dispatchRes.ok) {
          return res.status(200).json({ ok: true, message: `🚀 Workflow bot.yml dispatched! Check Live Monitor below.` });
        }
        const errText = await dispatchRes.text();
        return res.status(dispatchRes.status).json({ ok: false, error: `Workflow Dispatch failed: ${errText}` });
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
  <title>AlcashX Cloud Pro — Live Telemetry & Admin Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = { darkMode: 'class', theme: { extend: { fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'], mono: ['"JetBrains Mono"', 'monospace'] } } } }
  </script>
  <style>
    body { background-color: #0B0F17; color: #F1F5F9; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #0B0F17; }
    ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 3px; }
  </style>
</head>
<body class="min-h-screen bg-[#0B0F17] text-slate-100">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">
    
    <!-- Header -->
    <header class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800/80">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">AlcashX Cloud Pro</h1>
          <span id="connBadge" class="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">⚪ Not Connected</span>
        </div>
        <p id="connSubtext" class="text-xs sm:text-sm text-slate-400 mt-0.5">Enter Admin PIN &amp; click Load / Sync to verify GitHub connection</p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <input id="adminPassword" type="password" placeholder="Admin Password / PIN" class="w-full sm:w-auto h-11 px-3.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500" />
        <button onclick="loadConfigFromGitHub()" id="btnLoad" class="h-11 px-4 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium cursor-pointer">🔄 Load / Sync</button>
        <button onclick="saveConfigToGitHub()" id="btnSave" class="h-11 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold cursor-pointer">💾 Save to GitHub</button>
      </div>
    </header>

    <div id="toastBanner" class="hidden rounded-lg border px-4 py-3 text-sm font-medium transition-all"></div>

    <!-- Real-Time Telemetry Stats & Run Bot -->
    <section class="grid grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4 items-stretch">
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Active Accounts</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statActiveAccounts" class="text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">0</span>
          <span id="statTotalAccounts" class="text-xs text-slate-400 font-mono">of 0 total</span>
        </div>
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Scraped Video Queue</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statMediaQueue" class="text-2xl sm:text-3xl font-bold text-sky-400 font-mono">0</span>
          <span id="statUsedMedia" class="text-xs text-slate-400 font-mono">0 posted</span>
        </div>
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Harvested @Users</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statHarvestedUsers" class="text-2xl sm:text-3xl font-bold text-purple-400 font-mono">0</span>
          <span class="text-xs text-slate-400 font-mono">auto-tags</span>
        </div>
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Live Bot Status</span>
        <div class="mt-2 flex flex-col">
          <span id="statBotStatus" class="text-sm sm:text-base font-bold text-emerald-400 truncate">Ready · Standby</span>
          <span id="statRepoInfo" class="text-[11px] text-slate-500 font-mono truncate">Waiting for sync...</span>
        </div>
      </div>
      <div class="col-span-2 lg:col-span-1 flex">
        <button onclick="triggerBotNow()" id="btnRunBot" class="w-full min-h-[76px] rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-base sm:text-lg tracking-tight shadow-[0_0_25px_rgba(16,185,129,0.45)] cursor-pointer flex items-center justify-center gap-2.5 px-5">
          <span>🚀 RUN BOT NOW</span>
        </button>
      </div>
    </section>

    <!-- 📡 LIVE GITHUB ACTIONS WORKFLOW RUN MONITOR -->
    <section class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <h2 class="text-sm font-bold text-white">Live GitHub Actions Execution History (bot.yml)</h2>
        </div>
        <button onclick="pollWorkflowRuns()" class="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 font-mono cursor-pointer">
          🔄 Check Run Status Now
        </button>
      </div>
      <div id="runsListContainer" class="space-y-2 text-xs font-mono">
        <div class="text-slate-500 py-2">Enter Admin PIN and click "Load / Sync" to see real-time workflow runs and logs...</div>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
      <button onclick="switchTab('accounts')" id="tabBtn-accounts" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white cursor-pointer whitespace-nowrap">1. Accounts Manager</button>
      <button onclick="switchTab('content')" id="tabBtn-content" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">2. AI Scraper &amp; Spintax Studio</button>
      <button onclick="switchTab('settings')" id="tabBtn-settings" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">3. Scraped Queue &amp; Settings</button>
    </nav>

    <!-- TAB 1: ACCOUNTS -->
    <section id="tabPanel-accounts" class="space-y-6">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 class="text-base font-semibold text-white">Add Twitter / X Account</h2>
        <form onsubmit="handleAddAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div><input id="accUsername" type="text" required placeholder="@handle" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
          <div><input id="accAuthToken" type="text" required placeholder="auth_token (40 chars)" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
          <div><input id="accCt0" type="text" required placeholder="ct0 token" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
          <div><input id="accProxy" type="text" placeholder="Proxy (Optional)" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
          <div class="flex gap-2 items-end">
            <select id="accStatus" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white">
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </select>
            <button type="submit" class="h-11 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-lg cursor-pointer whitespace-nowrap">+ Add</button>
          </div>
        </form>
      </div>
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Configured Fleet Accounts (Click status to Toggle Active/Paused)</h3>
          <span id="accountsTableCount" class="text-xs text-slate-400 font-mono">0 accounts</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/40">
                <th class="py-3 px-4">Username</th>
                <th class="py-3 px-4">Token &amp; Last Bot Check</th>
                <th class="py-3 px-4">Proxy</th>
                <th class="py-3 px-4">Status (Click to Toggle)</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-slate-800 text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: CONTENT STUDIO + MASTER AI SCRAPER IMPORTER -->
    <section id="tabPanel-content" class="hidden space-y-6">
      
      <!-- ⚡ MASTER AI AGENT SCRAPER & PACK IMPORTER -->
      <div class="bg-sky-950/30 border border-sky-500/40 rounded-xl p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-sky-300">⚡ Master AI Scraper Prompt &amp; 1-Click Auto-Extractor</h3>
            <p class="text-xs text-slate-300 mt-0.5">1. Click <b>Copy Master Scraper Prompt</b> &amp; give it to any AI agent (ChatGPT/Perplexity/Gemini/Claude).<br/>2. Paste the AI's output (or raw .mp4/.jpg links) below to auto-populate <b>Video Queue, Captions, Replies, Targets &amp; Active @Users</b> in 1 click!</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button onclick="copyAgentPrompt()" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg shadow cursor-pointer">
              📋 Copy Master Scraper Prompt for AI
            </button>
            <button onclick="loadBuiltInViralPack()" class="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg cursor-pointer shadow">
              🔥 Load Built-in Viral Spintax
            </button>
          </div>
        </div>
        <textarea id="aiRawInput" rows="4" placeholder='Paste AI JSON output OR raw .mp4 / .jpg / .gif URLs here...' class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"></textarea>
        <button onclick="extractAiPack()" class="w-full py-2.5 bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white font-bold text-xs rounded-lg cursor-pointer shadow-lg">
          ⚡ Auto-Extract &amp; Fill All Media Queue, Captions, Replies &amp; Targets
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Main Post Spintax Captions (NO LINKS HERE)</h3>
            <span id="countCaptions" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtCaptions" rows="6" oninput="syncContentFromTextareas()" placeholder="{Caught me being|Feeling} {cute|naughty} again ✌️🐆" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Auto-Self-Reply Templates (Must include {{LINK}})</h3>
            <span id="countReplies" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtReplies" rows="6" oninput="syncContentFromTextareas()" placeholder="Full uncensored video here 👇 {{LINK}}" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Target Keywords / Hashtags (For Outreach &amp; Tagging)</h3>
            <span id="countTargets" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtTargets" rows="6" oninput="syncContentFromTextareas()" placeholder="#nsfwtwt" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Fallback Image IDs / Direct MP4 URLs</h3>
            <span id="countImages" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtImages" rows="6" oninput="syncContentFromTextareas()" placeholder="https://..." class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: QUEUE INSPECTOR & SETTINGS -->
    <section id="tabPanel-settings" class="hidden space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-sky-400">🎬 Scraped Video/Image Queue (mediaQueue)</h3>
            <span id="countMediaQueue" class="text-xs text-slate-400 font-mono">0 queued</span>
          </div>
          <p class="text-xs text-slate-400">Filled automatically by <code class="text-sky-300">bot/scraper.js</code> (from getredgifs.com/trending) or AI Importer.</p>
          <textarea id="txtMediaQueue" rows="6" oninput="syncQueueFromTextareas()" placeholder="Auto-filled by scraper.js or AI Importer..." class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>

        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-purple-400">🎯 Auto-Harvested Active @Users (harvestedUsers)</h3>
            <span id="countHarvested" class="text-xs text-slate-400 font-mono">0 users</span>
          </div>
          <p class="text-xs text-slate-400">Real active users scraped from live X feed by <code class="text-purple-300">bot/run.js</code> for automatic tagging.</p>
          <textarea id="txtHarvestedUsers" rows="6" oninput="syncQueueFromTextareas()" placeholder="@user1&#10;@user2" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-6">
        <h2 class="text-base font-semibold text-white">Engagement Pod &amp; Anti-Suspension Settings</h2>
        <div class="divide-y divide-slate-800">
          <div class="py-4 flex items-center justify-between gap-4">
            <div><div class="text-sm font-medium text-white">Auto-Self-Reply (Money Link in Comment + Active User Tags)</div><div class="text-xs text-slate-400">Post Vercel pre-lander link under newly uploaded native videos.</div></div>
            <input id="chkAutoSelfReply" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded cursor-pointer" />
          </div>
          <div class="py-4 flex items-center justify-between gap-4">
            <div><div class="text-sm font-medium text-white">Cross-Account Like (Pod)</div><div class="text-xs text-slate-400">Like tweets across fleet accounts.</div></div>
            <input id="chkCrossLike" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded cursor-pointer" />
          </div>
          <div class="py-4 flex items-center justify-between gap-4">
            <div><div class="text-sm font-medium text-white">Cross-Account Retweet (Pod)</div><div class="text-xs text-slate-400">Retweet posts across fleet accounts.</div></div>
            <input id="chkCrossRetweet" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded cursor-pointer" />
          </div>
          <div class="py-4 flex items-center justify-between gap-4">
            <div><div class="text-sm font-medium text-white">Cross-Account Bookmark (Pod)</div><div class="text-xs text-slate-400">Bookmark posts across fleet accounts (Boosts X algorithm score).</div></div>
            <input id="chkCrossBookmark" type="checkbox" onchange="syncSettingsFromInputs()" class="w-5 h-5 accent-sky-500 rounded cursor-pointer" />
          </div>
          <div class="pt-4 flex items-center justify-between gap-3">
            <div><div class="text-sm font-medium text-white">Max Accounts per Run (Keep at 1 for Zero-Ban IP Safety)</div><div class="text-xs text-slate-400">Bot automatically rotates through accounts one by one on each run.</div></div>
            <input id="numMaxAccounts" type="number" min="1" max="100" onchange="syncSettingsFromInputs()" class="w-28 h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" />
          </div>
        </div>
      </div>
    </section>

  </div>

  <script>
    let state = {
      accounts: [],
      images: [],
      captions: [],
      replies: [],
      targets: [],
      mediaQueue: [],
      usedMedia: [],
      harvestedUsers: [],
      settings: { autoSelfReply: true, crossAccountLike: false, crossAccountRetweet: false, crossAccountBookmark: false, maxAccountsPerRun: 1 }
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
      el.classList.remove('hidden', 'bg-rose-950/80', 'border-rose-800', 'text-rose-200', 'bg-emerald-950/80', 'border-emerald-800', 'text-emerald-200');
      el.classList.add(isError ? 'bg-rose-950/80' : 'bg-emerald-950/80', isError ? 'border-rose-800' : 'border-emerald-800', isError ? 'text-rose-200' : 'text-emerald-200');
      el.textContent = msg;
    }

    function switchTab(tab) {
      ['accounts', 'content', 'settings'].forEach(t => {
        document.getElementById('tabPanel-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tabBtn-' + t).className = t === tab
          ? 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white cursor-pointer whitespace-nowrap'
          : 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap';
      });
    }

    function loadBuiltInViralPack() {
      state.captions = [
        "{Caught me being|Feeling a little|Just being} {cute|naughty|playful|bored} {again ✌️🐆|today 🙊|tonight 😈|👀}",
        "{Wait for the end|Don't pause at 0:01|Did I show too much?|Oops, my hand slipped} {😳|🤫|💦|🔥}",
        "{hiii <3|would you say hi back?|am I your type? be honest 👀|can't sleep, who's up? 🌙}",
        "{Deleting this in 10 mins|Too risky for X?|My camera roll is dangerous} {🙊|😈|🔥|👀}",
        "{Be honest, would you|Could you handle this|Should I post part 2}? {👇|😳|💦}"
      ];
      state.replies = [
        "{Full uncensored video|Watch what happened next|The rest of this clip is too spicy for X} {👇|😈|💦} {{LINK}}",
        "{X deleted the full video|Couldn't post the full 2 min video here}, {watch it on my private page|full leak here}: {{LINK}} {🤫|🔥}",
        "{18+ only! Unblurred full video|Unlock the rest of this video for free} right here 👉 {{LINK}} 💦"
      ];
      state.targets = [
        "#nsfwtwt",
        "#thirsttrap",
        "caught me being cute",
        "rate me",
        "who is up"
      ];
      renderUI();
      showBanner('🔥 Viral Adult Spintax Pack loaded! Click "Save to GitHub" to apply.');
    }

    // 📋 MASTER AI AGENT SCRAPER PROMPT
    function copyAgentPrompt() {
      const p = \`Act as an automated content scraper & viral X (Twitter) marketer for an 18+ Thirst-Trap / Adult Creator Fanpage.
Scrape or generate a complete JSON pack from https://getredgifs.com/trending (or similar viral adult/thirst-trap feeds) and return ONLY a valid JSON object in this exact structure:
{
  "mediaQueue": [
    "https://...direct-video-or-gif-1.mp4",
    "https://...direct-video-or-image-2.jpg"
  ],
  "captions": [
    "{Caught me being|Feeling a little} {cute|naughty|playful} {again ✌️🐆|tonight 😈|🙊}",
    "{Wait for the end|Don't pause at 0:01|Did I show too much?} {😳|🤫|💦}"
  ],
  "replies": [
    "{Full uncensored video|Watch what happened next} {👇|😈|💦} {{LINK}}",
    "{Couldn't post the full 2 min clip on X}, watch it free here 👉 {{LINK}} 🔥"
  ],
  "targets": [
    "#nsfwtwt",
    "#thirsttrap",
    "caught me being cute",
    "who is up"
  ],
  "harvestedUsers": [
    "@active_user1",
    "@active_user2"
  ]
}
Rules:
1. Provide at least 15 direct .mp4/.gif/.jpg URLs in "mediaQueue" (direct media file URLs).
2. Provide 15 lustful/teasing spintax "captions" WITHOUT any links.
3. Provide 10 urgent self-reply templates in "replies" containing {{LINK}}.
4. Output ONLY raw valid JSON so I can paste it directly into my system.\`;

      navigator.clipboard.writeText(p);
      showBanner('📋 Master AI Scraper Prompt copied! Give it to any AI agent and paste its output below.');
    }

    // ⚡ 1-CLICK MULTI-FORMAT AUTO EXTRACTOR (JSON + RAW MEDIA URLS)
    function extractAiPack() {
      const raw = document.getElementById('aiRawInput').value.trim();
      if (!raw) return showBanner('Paste AI output or media links first!', true);

      let extractedAny = false;

      try {
        const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.mediaQueue) && parsed.mediaQueue.length) {
            state.mediaQueue = [...new Set([...(state.mediaQueue || []), ...parsed.mediaQueue])];
            extractedAny = true;
          }
          if (Array.isArray(parsed.images) && parsed.images.length) {
            state.images = [...new Set([...(state.images || []), ...parsed.images])];
            state.mediaQueue = [...new Set([...(state.mediaQueue || []), ...parsed.images])];
            extractedAny = true;
          }
          if (Array.isArray(parsed.captions) && parsed.captions.length) {
            state.captions = [...new Set([...(state.captions || []), ...parsed.captions])];
            extractedAny = true;
          }
          if (Array.isArray(parsed.replies) && parsed.replies.length) {
            state.replies = [...new Set([...(state.replies || []), ...parsed.replies])];
            extractedAny = true;
          }
          if (Array.isArray(parsed.targets) && parsed.targets.length) {
            state.targets = [...new Set([...(state.targets || []), ...parsed.targets])];
            extractedAny = true;
          }
          if (Array.isArray(parsed.harvestedUsers) && parsed.harvestedUsers.length) {
            state.harvestedUsers = [...new Set([...(state.harvestedUsers || []), ...parsed.harvestedUsers])];
            extractedAny = true;
          }
        }
      } catch (_) {}

      // Also extract any direct .mp4/.gif/.jpg/.png URLs even if user pasted plain text
      const rawUrls = raw.match(/https?:\\/\\/[^\\s"'<>\\\\]+\\.(?:mp4|gif|jpg|jpeg|png)/gi) || [];
      if (rawUrls.length > 0) {
        state.mediaQueue = [...new Set([...(state.mediaQueue || []), ...rawUrls])];
        extractedAny = true;
      }

      if (extractedAny) {
        renderUI();
        showBanner('⚡ Extracted! Queue: ' + state.mediaQueue.length + ' media | Captions: ' + state.captions.length + '. Click "💾 Save to GitHub"!');
      } else {
        showBanner('Could not find valid JSON or direct .mp4/.jpg links in pasted text.', true);
      }
    }

    function toggleAccountStatus(idx) {
      state.accounts[idx].status = state.accounts[idx].status === 'active' ? 'paused' : 'active';
      renderUI();
    }

    function renderRuns(runs) {
      const container = document.getElementById('runsListContainer');
      const statusEl = document.getElementById('statBotStatus');

      if (!Array.isArray(runs) || runs.length === 0) {
        container.innerHTML = '<div class="text-slate-500 py-2">No workflow runs found yet. Click "🚀 RUN BOT NOW" to start!</div>';
        return;
      }

      const latest = runs[0];
      if (latest.status === 'in_progress' || latest.status === 'queued') {
        statusEl.textContent = '⏳ Running Live...';
        statusEl.className = 'text-sm sm:text-base font-bold text-amber-400 animate-pulse truncate';
      } else if (latest.conclusion === 'success') {
        statusEl.textContent = '✅ Last Run: Success';
        statusEl.className = 'text-sm sm:text-base font-bold text-emerald-400 truncate';
      } else {
        statusEl.textContent = '❌ Last Run: ' + (latest.conclusion || 'Failed');
        statusEl.className = 'text-sm sm:text-base font-bold text-rose-400 truncate';
      }

      container.innerHTML = runs.map(r => {
        let badge = '';
        if (r.status === 'in_progress' || r.status === 'queued') {
          badge = '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">⏳ ' + r.status.toUpperCase() + '</span>';
        } else if (r.conclusion === 'success') {
          badge = '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✅ SUCCESS</span>';
        } else {
          badge = '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">❌ ' + (r.conclusion || 'FAILED').toUpperCase() + '</span>';
        }

        const start = new Date(r.createdAt);
        const end = new Date(r.updatedAt);
        const durationSec = Math.max(1, Math.round((end - start) / 1000));

        return \`
          <div class="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-slate-950/80 border border-slate-800/80">
            <div class="flex flex-wrap items-center gap-2.5">
              \${badge}
              <span class="text-white font-semibold">\${r.name}</span>
              <span class="text-slate-400">\${start.toLocaleString()}</span>
              <span class="text-slate-500">(\${durationSec}s)</span>
            </div>
            <a href="\${r.url}" target="_blank" class="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold">
              📜 View Live Step Logs ↗
            </a>
          </div>
        \`;
      }).join('');
    }

    function renderUI() {
      document.getElementById('statActiveAccounts').textContent = state.accounts.filter(a => a.status === 'active').length;
      document.getElementById('statTotalAccounts').textContent = 'of ' + state.accounts.length + ' total';
      document.getElementById('statMediaQueue').textContent = (state.mediaQueue || []).length;
      document.getElementById('statUsedMedia').textContent = (state.usedMedia || []).length + ' posted';
      document.getElementById('statHarvestedUsers').textContent = (state.harvestedUsers || []).length;
      document.getElementById('accountsTableCount').textContent = state.accounts.length + ' accounts';

      const tbody = document.getElementById('accountsTableBody');
      tbody.innerHTML = state.accounts.length === 0
        ? '<tr><td colspan="5" class="py-8 text-center text-slate-500 text-sm">No accounts added yet. Add your first account above!</td></tr>'
        : state.accounts.map((acc, idx) => {
            const tokenOk = acc.auth_token && acc.auth_token.length >= 25 && acc.ct0 && acc.ct0.length >= 20;
            const diagBadge = tokenOk
              ? '<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-mono">✅ Tokens Valid</span>'
              : '<span class="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 text-xs font-mono">⚠️ Check Length</span>';

            const lastStatusBadge = acc.lastStatus
              ? \`<span class="ml-2 px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">\${acc.lastStatus}</span>\`
              : '';

            return \`
              <tr class="hover:bg-slate-800/30">
                <td class="py-3 px-4 font-mono text-white font-semibold">\${acc.username}</td>
                <td class="py-3 px-4">\${diagBadge}\${lastStatusBadge}</td>
                <td class="py-3 px-4 font-mono text-xs text-slate-400">\${acc.proxy || 'Direct (GitHub IP)'}</td>
                <td class="py-3 px-4">
                  <button onclick="toggleAccountStatus(\${idx})" class="px-2.5 py-1 rounded text-xs font-bold cursor-pointer \${acc.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'}">
                    \${acc.status === 'active' ? '🟢 ACTIVE' : '⏸️ PAUSED'}
                  </button>
                </td>
                <td class="py-3 px-4 text-right">
                  <button onclick="state.accounts.splice(\${idx},1);renderUI();" class="text-xs text-rose-400 hover:underline cursor-pointer">Delete</button>
                </td>
              </tr>
            \`;
          }).join('');

      document.getElementById('txtImages').value = (state.images || []).join('\\n');
      document.getElementById('txtCaptions').value = (state.captions || []).join('\\n');
      document.getElementById('txtReplies').value = (state.replies || []).join('\\n');
      document.getElementById('txtTargets').value = (state.targets || []).join('\\n');
      document.getElementById('txtMediaQueue').value = (state.mediaQueue || []).join('\\n');
      document.getElementById('txtHarvestedUsers').value = (state.harvestedUsers || []).join('\\n');

      document.getElementById('countImages').textContent = (state.images || []).length + ' lines';
      document.getElementById('countCaptions').textContent = (state.captions || []).length + ' lines';
      document.getElementById('countReplies').textContent = (state.replies || []).length + ' lines';
      document.getElementById('countTargets').textContent = (state.targets || []).length + ' lines';
      document.getElementById('countMediaQueue').textContent = (state.mediaQueue || []).length + ' queued';
      document.getElementById('countHarvested').textContent = (state.harvestedUsers || []).length + ' users';

      document.getElementById('chkAutoSelfReply').checked = Boolean(state.settings.autoSelfReply);
      document.getElementById('chkCrossLike').checked = Boolean(state.settings.crossAccountLike);
      document.getElementById('chkCrossRetweet').checked = Boolean(state.settings.crossAccountRetweet);
      document.getElementById('chkCrossBookmark').checked = Boolean(state.settings.crossAccountBookmark);
      document.getElementById('numMaxAccounts').value = state.settings.maxAccountsPerRun ?? 1;
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
    }

    function syncContentFromTextareas() {
      const splitLines = id => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
      state.images = splitLines('txtImages');
      state.captions = splitLines('txtCaptions');
      state.replies = splitLines('txtReplies');
      state.targets = splitLines('txtTargets');
    }

    function syncQueueFromTextareas() {
      const splitLines = id => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
      state.mediaQueue = splitLines('txtMediaQueue');
      state.harvestedUsers = splitLines('txtHarvestedUsers');
    }

    function syncSettingsFromInputs() {
      state.settings = {
        autoSelfReply: document.getElementById('chkAutoSelfReply').checked,
        crossAccountLike: document.getElementById('chkCrossLike').checked,
        crossAccountRetweet: document.getElementById('chkCrossRetweet').checked,
        crossAccountBookmark: document.getElementById('chkCrossBookmark').checked,
        maxAccountsPerRun: parseInt(document.getElementById('numMaxAccounts').value || '1', 10)
      };
    }

    async function apiCall(action, extra = {}) {
      const password = getPassword();
      if (!password) { showBanner('Enter Admin Password / PIN first.', true); throw new Error('No password'); }
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password, ...extra })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed');
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
          settings: data.config.settings || state.settings
        };

        document.getElementById('connBadge').textContent = '🟢 Connected';
        document.getElementById('connBadge').className = 'px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800';
        document.getElementById('connSubtext').textContent = 'Synced with GitHub Repo: ' + data.repo + ' (' + data.branch + ')';
        document.getElementById('statRepoInfo').textContent = data.repo;

        renderUI();
        renderRuns(data.runs || []);
        showBanner('✅ Connected & Synced with GitHub (' + data.repo + ')!');

        if (!pollTimer) {
          pollTimer = setInterval(pollWorkflowRuns, 15000);
        }
      } catch (err) {
        document.getElementById('connBadge').textContent = '🔴 Disconnected';
        document.getElementById('connBadge').className = 'px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-full bg-rose-950 text-rose-400 border border-rose-800';
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
        showBanner(data.message);
      } catch (err) { showBanner(err.message, true); }
    }

    async function triggerBotNow() {
      const statusEl = document.getElementById('statBotStatus');
      statusEl.textContent = '🚀 Dispatching...';
      try {
        await saveConfigToGitHub();
        const data = await apiCall('trigger_bot');
        statusEl.textContent = '⏳ Queued on GitHub...';
        showBanner(data.message);
        setTimeout(pollWorkflowRuns, 3500);
        setTimeout(pollWorkflowRuns, 9000);
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
