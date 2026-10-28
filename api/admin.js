/**
 * AlcashX Cloud Pro — Single-File Vercel Serverless Function (api/admin.js)
 * Zero external npm dependencies. Uses native Node 18+ fetch and Buffer.
 */

const DEFAULT_CONFIG = {
  accounts: [],
  images: [],
  captions: [],
  replies: [],
  targets: [],
  settings: {
    autoSelfReply: true,
    crossAccountLike: true,
    crossAccountRetweet: true,
    crossAccountBookmark: false,
    maxAccountsPerRun: 5
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
        return res.status(500).json({ ok: false, error: 'Server configuration error: ADMIN_PASSWORD not set.' });
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

      if (action === 'load_config') {
        const getRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: ghHeaders });
        if (getRes.status === 404) {
          return res.status(200).json({ ok: true, isNew: true, repo: githubRepo, branch, sha: null, config: DEFAULT_CONFIG });
        }
        if (!getRes.ok) {
          const errText = await getRes.text();
          return res.status(getRes.status).json({ ok: false, error: `GitHub API Error: ${errText}` });
        }
        const fileData = await getRes.json();
        const decodedJson = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let parsedConfig = DEFAULT_CONFIG;
        try { parsedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(decodedJson) }; } catch (e) { parsedConfig = DEFAULT_CONFIG; }
        return res.status(200).json({ ok: true, repo: githubRepo, branch, sha: fileData.sha, config: parsedConfig });
      }

      if (action === 'save_config') {
        if (!config || typeof config !== 'object') {
          return res.status(400).json({ ok: false, error: 'Invalid payload: config object required.' });
        }
        let existingSha = null;
        const shaRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, { method: 'GET', headers: ghHeaders });
        if (shaRes.ok) {
          const existingData = await shaRes.json();
          existingSha = existingData.sha;
        }

        const payloadToSave = {
          accounts: Array.isArray(config.accounts) ? config.accounts : [],
          images: Array.isArray(config.images) ? config.images : [],
          captions: Array.isArray(config.captions) ? config.captions : [],
          replies: Array.isArray(config.replies) ? config.replies : [],
          targets: Array.isArray(config.targets) ? config.targets : [],
          settings: {
            autoSelfReply: Boolean(config.settings?.autoSelfReply),
            crossAccountLike: Boolean(config.settings?.crossAccountLike),
            crossAccountRetweet: Boolean(config.settings?.crossAccountRetweet),
            crossAccountBookmark: Boolean(config.settings?.crossAccountBookmark),
            maxAccountsPerRun: Math.max(1, parseInt(config.settings?.maxAccountsPerRun ?? 5, 10) || 5)
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
          message: 'Configuration successfully committed to data/config.json',
          sha: putResult.content?.sha || null,
          config: payloadToSave
        });
      }

      if (action === 'trigger_bot') {
        const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/bot.yml/dispatches`;
        const dispatchRes = await fetch(dispatchUrl, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ ref: branch })
        });
        if (dispatchRes.status === 204 || dispatchRes.ok) {
          return res.status(200).json({ ok: true, message: `Workflow bot.yml dispatched successfully.` });
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
  <title>AlcashX Cloud Pro — Admin Console</title>
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
        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">AlcashX Cloud Pro</h1>
        <p class="text-xs sm:text-sm text-slate-400 mt-0.5">GitHub-Backed Cloud Fleet &amp; Workflow Dispatch Console</p>
      </div>
      <div class="flex flex-wrap items-center gap-2.5">
        <input id="adminPassword" type="password" placeholder="Admin Password / PIN" class="w-full sm:w-auto h-11 px-3.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-sky-500" />
        <button onclick="loadConfigFromGitHub()" id="btnLoad" class="h-11 px-4 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium cursor-pointer">Load Config</button>
        <button onclick="saveConfigToGitHub()" id="btnSave" class="h-11 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold cursor-pointer">Save to GitHub</button>
      </div>
    </header>

    <div id="toastBanner" class="hidden rounded-lg border px-4 py-3 text-sm font-medium transition-all"></div>

    <!-- Stats & Run Bot -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 items-stretch">
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Total Active Accounts</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statActiveAccounts" class="text-2xl sm:text-3xl font-bold text-white font-mono">0</span>
          <span id="statTotalAccounts" class="text-xs text-slate-400 font-mono">of 0 total</span>
        </div>
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Total Image Assets</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statTotalImages" class="text-2xl sm:text-3xl font-bold text-white font-mono">0</span>
          <span id="statCaptionsCount" class="text-xs text-slate-400 font-mono">0 captions</span>
        </div>
      </div>
      <div class="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Bot Status</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statBotStatus" class="text-base sm:text-lg font-semibold text-emerald-400">Ready · Standby</span>
          <span id="statRepoInfo" class="text-xs text-slate-500 font-mono">bot.yml</span>
        </div>
      </div>
      <div class="col-span-2 lg:col-span-1 flex">
        <button onclick="triggerBotNow()" id="btnRunBot" class="w-full min-h-[76px] rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-base sm:text-lg tracking-tight shadow-[0_0_25px_rgba(16,185,129,0.45)] cursor-pointer flex items-center justify-center gap-2.5 px-5">
          <span>🚀 RUN BOT NOW</span>
        </button>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
      <button onclick="switchTab('accounts')" id="tabBtn-accounts" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white cursor-pointer whitespace-nowrap">1. Accounts Manager</button>
      <button onclick="switchTab('content')" id="tabBtn-content" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">2. Content Studio</button>
      <button onclick="switchTab('settings')" id="tabBtn-settings" class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap">3. Engagement &amp; Settings</button>
    </nav>

    <!-- TAB 1: ACCOUNTS -->
    <section id="tabPanel-accounts" class="space-y-6">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
        <h2 class="text-base font-semibold text-white">Add Twitter / X Account</h2>
        <form onsubmit="handleAddAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div><input id="accUsername" type="text" required placeholder="@handle" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
          <div><input id="accAuthToken" type="text" required placeholder="auth_token" class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" /></div>
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
          <h3 class="text-sm font-semibold text-white">Configured Fleet Accounts</h3>
          <span id="accountsTableCount" class="text-xs text-slate-400 font-mono">0 accounts</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800 text-xs text-slate-400 bg-slate-950/40">
                <th class="py-3 px-4">Username</th>
                <th class="py-3 px-4">auth_token</th>
                <th class="py-3 px-4">ct0</th>
                <th class="py-3 px-4">Proxy</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-slate-800 text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: CONTENT STUDIO + AI PACK IMPORTER -->
    <section id="tabPanel-content" class="hidden space-y-6">
      
      <!-- ⚡ SMART AI PACK IMPORTER -->
      <div class="bg-sky-950/30 border border-sky-500/40 rounded-xl p-5 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-sm font-bold text-sky-300">⚡ 1-Click AI Agent Pack Importer</h3>
            <p class="text-xs text-slate-400">Paste JSON or raw output from ChatGPT/Claude/Gemini to auto-fill captions, replies, targets &amp; images.</p>
          </div>
          <button onclick="copyAgentPrompt()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-sky-300 text-xs font-semibold rounded-lg border border-sky-500/30 cursor-pointer">
            📋 Copy Prompt for AI Bot
          </button>
        </div>
        <textarea id="aiRawInput" rows="3" placeholder='Paste AI output here...' class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500"></textarea>
        <button onclick="extractAiPack()" class="w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-lg cursor-pointer">
          ⚡ Auto-Extract &amp; Fill All Boxes Below
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Imgur Image IDs / Direct URLs</h3>
            <span id="countImages" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtImages" rows="6" oninput="syncContentFromTextareas()" placeholder="xYz987A" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Spintax / Unique Captions</h3>
            <span id="countCaptions" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtCaptions" rows="6" oninput="syncContentFromTextareas()" placeholder="{gm|hey} builders! 🔥" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Reply Templates</h3>
            <span id="countReplies" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtReplies" rows="6" oninput="syncContentFromTextareas()" placeholder="Full link in bio: {{LINK}}" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
        <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-white">Target Users &amp; Hashtags</h3>
            <span id="countTargets" class="text-xs text-slate-400 font-mono">0 lines</span>
          </div>
          <textarea id="txtTargets" rows="6" oninput="syncContentFromTextareas()" placeholder="#buildinpublic" class="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono"></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: SETTINGS -->
    <section id="tabPanel-settings" class="hidden space-y-6">
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-6">
        <h2 class="text-base font-semibold text-white">Engagement Pod &amp; Execution Settings</h2>
        <div class="divide-y divide-slate-800">
          <div class="py-4 flex items-center justify-between gap-4">
            <div><div class="text-sm font-medium text-white">Auto-Self-Reply</div><div class="text-xs text-slate-400">Post follow-up reply under newly published tweets.</div></div>
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
          <div class="pt-4 flex items-center justify-between gap-3">
            <div><div class="text-sm font-medium text-white">Max Accounts per Run</div><div class="text-xs text-slate-400">Max accounts processed per workflow run.</div></div>
            <input id="numMaxAccounts" type="number" min="1" max="100" onchange="syncSettingsFromInputs()" class="w-28 h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono" />
          </div>
        </div>
      </div>
    </section>

  </div>

  <script>
    let state = { accounts: [], images: [], captions: [], replies: [], targets: [], settings: { autoSelfReply: true, crossAccountLike: true, crossAccountRetweet: true, maxAccountsPerRun: 5 } };
    
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
        document.getElementById('tabBtn-' + t).className = t === tab ? 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold bg-slate-800 text-white cursor-pointer whitespace-nowrap' : 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-slate-400 hover:text-white cursor-pointer whitespace-nowrap';
      });
    }

    function copyAgentPrompt() {
      const p = \`Generate a high-converting Twitter traffic pack for an 18+ VIP Creator Fanpage. Return ONLY valid JSON block with keys: "images" (array of Imgur IDs if any), "captions" (15 spintax hooks using {word1|word2}), "replies" (10 urgent self-replies with {{LINK}}), and "targets" (15 trending hashtags or handles).\`;
      navigator.clipboard.writeText(p);
      showBanner('📋 AI Agent Prompt copied! Paste it into any chatbot and paste its reply below.');
    }

    function extractAiPack() {
      const raw = document.getElementById('aiRawInput').value.trim();
      if (!raw) return showBanner('Paste AI output first!', true);
      try {
        const jsonMatch = raw.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.images) && parsed.images.length) state.images = [...new Set([...state.images, ...parsed.images])];
          if (Array.isArray(parsed.captions)) state.captions = parsed.captions;
          if (Array.isArray(parsed.replies)) state.replies = parsed.replies;
          if (Array.isArray(parsed.targets)) state.targets = parsed.targets;
        }
        const imgurMatches = [...raw.matchAll(/imgur\\.com\\/(?:a\\/|gallery\\/)?([a-zA-Z0-9]{5,10})/g)].map(m => m[1]);
        if (imgurMatches.length) state.images = [...new Set([...state.images, ...imgurMatches])];
        renderUI();
        showBanner('⚡ AI Pack extracted & filled into Content Studio!');
      } catch (e) {
        showBanner('Could not parse JSON. Ensure AI returned valid JSON.', true);
      }
    }

    function renderUI() {
      document.getElementById('statActiveAccounts').textContent = state.accounts.filter(a => a.status === 'active').length;
      document.getElementById('statTotalAccounts').textContent = 'of ' + state.accounts.length + ' total';
      document.getElementById('statTotalImages').textContent = state.images.length;
      document.getElementById('statCaptionsCount').textContent = state.captions.length + ' captions';
      document.getElementById('accountsTableCount').textContent = state.accounts.length + ' accounts';

      const tbody = document.getElementById('accountsTableBody');
      tbody.innerHTML = state.accounts.length === 0 ? '<tr><td colspan="6" class="py-8 text-center text-slate-500 text-sm">No accounts added yet.</td></tr>' : state.accounts.map((acc, idx) => \`
        <tr class="hover:bg-slate-800/30">
          <td class="py-3 px-4 font-mono text-white">\${acc.username}</td>
          <td class="py-3 px-4 font-mono text-xs text-slate-400">••••••••</td>
          <td class="py-3 px-4 font-mono text-xs text-slate-400">••••••••</td>
          <td class="py-3 px-4 font-mono text-xs text-slate-400">\${acc.proxy || 'Direct'}</td>
          <td class="py-3 px-4 text-xs font-medium \${acc.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}">\${acc.status.toUpperCase()}</td>
          <td class="py-3 px-4 text-right"><button onclick="state.accounts.splice(\${idx},1);renderUI();" class="text-xs text-rose-400 cursor-pointer">Delete</button></td>
        </tr>
      \`).join('');

      document.getElementById('txtImages').value = state.images.join('\\n');
      document.getElementById('txtCaptions').value = state.captions.join('\\n');
      document.getElementById('txtReplies').value = state.replies.join('\\n');
      document.getElementById('txtTargets').value = state.targets.join('\\n');

      document.getElementById('countImages').textContent = state.images.length + ' lines';
      document.getElementById('countCaptions').textContent = state.captions.length + ' lines';
      document.getElementById('countReplies').textContent = state.replies.length + ' lines';
      document.getElementById('countTargets').textContent = state.targets.length + ' lines';

      document.getElementById('chkAutoSelfReply').checked = Boolean(state.settings.autoSelfReply);
      document.getElementById('chkCrossLike').checked = Boolean(state.settings.crossAccountLike);
      document.getElementById('chkCrossRetweet').checked = Boolean(state.settings.crossAccountRetweet);
      document.getElementById('numMaxAccounts').value = state.settings.maxAccountsPerRun ?? 5;
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

    function syncSettingsFromInputs() {
      state.settings = {
        autoSelfReply: document.getElementById('chkAutoSelfReply').checked,
        crossAccountLike: document.getElementById('chkCrossLike').checked,
        crossAccountRetweet: document.getElementById('chkCrossRetweet').checked,
        maxAccountsPerRun: parseInt(document.getElementById('numMaxAccounts').value || '5', 10)
      };
    }

    async function apiCall(action, extra = {}) {
      const password = getPassword();
      if (!password) { showBanner('Enter Admin Password first.', true); throw new Error('No password'); }
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
          settings: data.config.settings || state.settings
        };
        renderUI();
        showBanner('Loaded configuration from GitHub successfully!');
      } catch (err) { showBanner(err.message, true); }
    }

    async function saveConfigToGitHub() {
      syncContentFromTextareas();
      syncSettingsFromInputs();
      try {
        const data = await apiCall('save_config', { config: state });
        showBanner(data.message);
      } catch (err) { showBanner(err.message, true); }
    }

    async function triggerBotNow() {
      const statusEl = document.getElementById('statBotStatus');
      statusEl.textContent = 'Dispatching...';
      try {
        await saveConfigToGitHub();
        const data = await apiCall('trigger_bot');
        statusEl.textContent = 'Running · Dispatched';
        showBanner('🚀 ' + data.message);
      } catch (err) {
        statusEl.textContent = 'Error';
        showBanner(err.message, true);
      }
    }

    renderUI();
    if (getPassword()) loadConfigFromGitHub();
  </script>
</body>
</html>`;
}
