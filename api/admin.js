/**
 * AlcashX Cloud Pro — Single-File Vercel Serverless Function (api/admin.js)
 * Zero external npm dependencies. Uses native Node 18+ fetch and Buffer.
 *
 * Environment Variables required in Vercel:
 *   - ADMIN_PASSWORD : Password / PIN to authorize dashboard actions
 *   - GITHUB_TOKEN   : GitHub Personal Access Token (repo + workflow scopes)
 *   - GITHUB_REPO    : Target GitHub repository in "username/repo" format
 *   - GITHUB_BRANCH  : (Optional) Branch name, defaults to "main"
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
  // CORS headers for iPad / mobile web app flexibility
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ---------------------------------------------------------------------------
  // 1. FRONTEND UI (GET Request -> Serves Complete Dark-Mode Admin Panel)
  // ---------------------------------------------------------------------------
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(renderAdminHTML());
  }

  // ---------------------------------------------------------------------------
  // 2. BACKEND LOGIC (POST Request -> GitHub REST API Integration)
  // ---------------------------------------------------------------------------
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const { action, password, config } = body;

      const expectedPassword = process.env.ADMIN_PASSWORD;
      const providedPassword = password || req.headers['x-admin-password'];

      if (!expectedPassword) {
        return res.status(500).json({
          ok: false,
          error: 'Server configuration error: ADMIN_PASSWORD environment variable is not set.'
        });
      }

      if (!providedPassword || providedPassword !== expectedPassword) {
        return res.status(401).json({
          ok: false,
          error: 'Unauthorized: Invalid Admin Password / PIN.'
        });
      }

      const githubToken = process.env.GITHUB_TOKEN;
      const githubRepo = process.env.GITHUB_REPO; // Format: "username/repo"
      const branch = process.env.GITHUB_BRANCH || 'main';
      const filePath = 'data/config.json';

      if (!githubToken || !githubRepo) {
        return res.status(500).json({
          ok: false,
          error: 'Missing GITHUB_TOKEN or GITHUB_REPO environment variables on server.'
        });
      }

      const ghHeaders = {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AlcashX-Cloud-Pro-Serverless',
        'Content-Type': 'application/json'
      };

      const contentsUrl = `https://api.github.com/repos/${githubRepo}/contents/${filePath}`;

      // -----------------------------------------------------------------------
      // ACTION: load_config
      // Fetch and return the current data/config.json from GitHub
      // -----------------------------------------------------------------------
      if (action === 'load_config') {
        const getRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
          method: 'GET',
          headers: ghHeaders
        });

        if (getRes.status === 404) {
          return res.status(200).json({
            ok: true,
            isNew: true,
            repo: githubRepo,
            branch,
            sha: null,
            config: DEFAULT_CONFIG
          });
        }

        if (!getRes.ok) {
          const errText = await getRes.text();
          return res.status(getRes.status).json({
            ok: false,
            error: `GitHub API Error (${getRes.status}): ${errText}`
          });
        }

        const fileData = await getRes.json();
        const decodedJson = Buffer.from(fileData.content, 'base64').toString('utf-8');
        let parsedConfig = DEFAULT_CONFIG;
        try {
          parsedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(decodedJson) };
        } catch (parseErr) {
          parsedConfig = DEFAULT_CONFIG;
        }

        return res.status(200).json({
          ok: true,
          repo: githubRepo,
          branch,
          sha: fileData.sha,
          config: parsedConfig
        });
      }

      // -----------------------------------------------------------------------
      // ACTION: save_config
      // Read SHA of data/config.json (if exists) and PUT updated JSON payload
      // -----------------------------------------------------------------------
      if (action === 'save_config') {
        if (!config || typeof config !== 'object') {
          return res.status(400).json({
            ok: false,
            error: 'Invalid payload: "config" object is required for save_config.'
          });
        }

        // Step 1: Check if data/config.json already exists to retrieve its SHA
        let existingSha = null;
        const shaRes = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
          method: 'GET',
          headers: ghHeaders
        });

        if (shaRes.ok) {
          const existingData = await shaRes.json();
          existingSha = existingData.sha;
        } else if (shaRes.status !== 404) {
          const errText = await shaRes.text();
          return res.status(shaRes.status).json({
            ok: false,
            error: `Failed to read existing file SHA (${shaRes.status}): ${errText}`
          });
        }

        // Step 2: Sanitize & structure payload
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

        if (existingSha) {
          putBody.sha = existingSha;
        }

        const putRes = await fetch(contentsUrl, {
          method: 'PUT',
          headers: ghHeaders,
          body: JSON.stringify(putBody)
        });

        if (!putRes.ok) {
          const errText = await putRes.text();
          return res.status(putRes.status).json({
            ok: false,
            error: `Failed to save config to GitHub (${putRes.status}): ${errText}`
          });
        }

        const putResult = await putRes.json();
        return res.status(200).json({
          ok: true,
          message: 'Configuration successfully committed to data/config.json',
          sha: putResult.content?.sha || null,
          commitUrl: putResult.commit?.html_url || null,
          config: payloadToSave
        });
      }

      // -----------------------------------------------------------------------
      // ACTION: trigger_bot
      // Dispatch GitHub Actions workflow bot.yml on ref "main"
      // -----------------------------------------------------------------------
      if (action === 'trigger_bot') {
        const dispatchUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/bot.yml/dispatches`;

        const dispatchRes = await fetch(dispatchUrl, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({ ref: branch })
        });

        // GitHub workflow dispatch returns 204 No Content on success
        if (dispatchRes.status === 204 || dispatchRes.ok) {
          return res.status(200).json({
            ok: true,
            message: `Workflow bot.yml dispatched on branch "${branch}".`,
            dispatchedAt: new Date().toISOString(),
            repo: githubRepo
          });
        }

        const errText = await dispatchRes.text();
        return res.status(dispatchRes.status).json({
          ok: false,
          error: `GitHub Workflow Dispatch failed (${dispatchRes.status}): ${errText}`
        });
      }

      return res.status(400).json({
        ok: false,
        error: `Unknown action "${action}". Supported actions: load_config, save_config, trigger_bot.`
      });
    } catch (error) {
      return res.status(500).json({
        ok: false,
        error: error instanceof Error ? error.message : 'Internal Server Error'
      });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}

// -----------------------------------------------------------------------------
// Self-Contained HTML Template for GET /api/admin
// -----------------------------------------------------------------------------
function renderAdminHTML() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>AlcashX Cloud Pro — Admin Console</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace']
          }
        }
      }
    }
  </script>
  <style>
    body {
      background-color: #0B0F17;
      color: #F1F5F9;
      font-family: 'Plus Jakarta Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }
    .tabular-nums {
      font-variant-numeric: tabular-nums;
    }
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #0B0F17;
    }
    ::-webkit-scrollbar-thumb {
      background: #1E293B;
      border-radius: 3px;
    }
  </style>
</head>
<body class="min-h-screen bg-[#0B0F17] text-slate-100 selection:bg-sky-500/30 selection:text-sky-200">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-6">
    
    <!-- Top Header & Auth Bar -->
    <header class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800/80">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">AlcashX Cloud Pro</h1>
          <p class="text-xs sm:text-sm text-slate-400 mt-0.5">GitHub-Backed Cloud Fleet &amp; Workflow Dispatch Console</p>
        </div>
      </div>

      <!-- Password / PIN Authentication & Sync Controls -->
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="relative flex-1 sm:flex-initial min-w-[200px]">
          <input
            id="adminPassword"
            type="password"
            placeholder="Admin Password / PIN"
            class="w-full h-11 px-3.5 bg-slate-900/90 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors font-mono"
          />
        </div>
        <button
          onclick="loadConfigFromGitHub()"
          id="btnLoad"
          class="h-11 px-4 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-200 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Load Config
        </button>
        <button
          onclick="saveConfigToGitHub()"
          id="btnSave"
          class="h-11 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Save to GitHub
        </button>
      </div>
    </header>

    <!-- Status Banner -->
    <div id="toastBanner" class="hidden rounded-lg border px-4 py-3 text-sm font-medium transition-all"></div>

    <!-- Top Stats Bar + Glowing RUN BOT NOW CTA -->
    <section class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 items-stretch">
      <div class="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Total Active Accounts</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statActiveAccounts" class="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">0</span>
          <span id="statTotalAccounts" class="text-xs text-slate-400 font-mono tabular-nums">of 0 total</span>
        </div>
      </div>

      <div class="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Total Image Assets</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statTotalImages" class="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">0</span>
          <span id="statCaptionsCount" class="text-xs text-slate-400 font-mono tabular-nums">0 captions</span>
        </div>
      </div>

      <div class="bg-slate-900/70 border border-slate-800/90 rounded-xl p-4 flex flex-col justify-between">
        <span class="text-xs font-medium text-slate-400">Bot Status</span>
        <div class="mt-2 flex items-baseline justify-between">
          <span id="statBotStatus" class="text-base sm:text-lg font-semibold text-emerald-400 truncate">Ready · Standby</span>
          <span id="statRepoInfo" class="text-xs text-slate-500 font-mono truncate">bot.yml</span>
        </div>
      </div>

      <div class="col-span-2 lg:col-span-1 flex">
        <button
          onclick="triggerBotNow()"
          id="btnRunBot"
          class="w-full min-h-[76px] rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-400 hover:to-sky-400 text-slate-950 font-bold text-base sm:text-lg tracking-tight shadow-[0_0_25px_rgba(16,185,129,0.45)] hover:shadow-[0_0_35px_rgba(56,189,248,0.65)] transition-all flex items-center justify-center gap-2.5 px-5 cursor-pointer active:scale-[0.99]"
        >
          <span>🚀 RUN BOT NOW</span>
        </button>
      </div>
    </section>

    <!-- Navigation Tabs -->
    <nav class="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl overflow-x-auto">
      <button
        onclick="switchTab('accounts')"
        id="tabBtn-accounts"
        class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-slate-800 text-white"
      >
        1. Accounts Manager
      </button>
      <button
        onclick="switchTab('content')"
        id="tabBtn-content"
        class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400 hover:text-white"
      >
        2. Content Studio
      </button>
      <button
        onclick="switchTab('settings')"
        id="tabBtn-settings"
        class="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400 hover:text-white"
      >
        3. Engagement &amp; Settings
      </button>
    </nav>

    <!-- TAB 1: ACCOUNTS MANAGER -->
    <section id="tabPanel-accounts" class="space-y-6">
      <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 class="text-base font-semibold text-white">Add Twitter / X Account</h2>
            <p class="text-xs text-slate-400">Authenticate using session cookies (\`auth_token\` and \`ct0\`) and optional HTTP/SOCKS proxy.</p>
          </div>
        </div>

        <form onsubmit="handleAddAccount(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
            <input
              id="accUsername"
              type="text"
              required
              placeholder="@handle"
              class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">auth_token Cookie</label>
            <input
              id="accAuthToken"
              type="text"
              required
              placeholder="40-char hex auth_token"
              class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">ct0 Cookie (CSRF)</label>
            <input
              id="accCt0"
              type="text"
              required
              placeholder="ct0 token string"
              class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1.5">Proxy (Optional)</label>
            <input
              id="accProxy"
              type="text"
              placeholder="http://user:pass@ip:port"
              class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>
          <div class="flex gap-2 items-end">
            <div class="flex-1">
              <label class="block text-xs font-medium text-slate-300 mb-1.5">Status</label>
              <select
                id="accStatus"
                class="w-full h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-sky-500"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="cooldown">Cooldown</option>
              </select>
            </div>
            <button
              type="submit"
              class="h-11 px-4 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              + Add
            </button>
          </div>
        </form>
      </div>

      <!-- Accounts Table -->
      <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Configured Fleet Accounts</h3>
          <span id="accountsTableCount" class="text-xs text-slate-400 font-mono tabular-nums">0 accounts</span>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-800/80 text-xs text-slate-400 bg-slate-950/40">
                <th class="py-3 px-4 font-medium">Username</th>
                <th class="py-3 px-4 font-medium">auth_token</th>
                <th class="py-3 px-4 font-medium">ct0</th>
                <th class="py-3 px-4 font-medium">Proxy</th>
                <th class="py-3 px-4 font-medium">Status</th>
                <th class="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="accountsTableBody" class="divide-y divide-slate-800/60 text-sm"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- TAB 2: CONTENT STUDIO -->
    <section id="tabPanel-content" class="hidden space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Imgur Image IDs -->
        <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 flex flex-col space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-white">Imgur Image IDs / Direct URLs</h3>
              <p class="text-xs text-slate-400">One Imgur ID (e.g. \`aBc123X\`) or URL per line</p>
            </div>
            <span id="countImages" class="text-xs text-slate-400 font-mono tabular-nums">0 lines</span>
          </div>
          <textarea
            id="txtImages"
            rows="8"
            oninput="syncContentFromTextareas()"
            placeholder="xYz987A&#10;kLm456B&#10;https://i.imgur.com/example.jpg"
            class="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
          ></textarea>
        </div>

        <!-- Spintax / Unique Captions -->
        <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 flex flex-col space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-white">Spintax / Unique Captions</h3>
              <p class="text-xs text-slate-400">One tweet caption or \`{spin|syntax}\` template per line</p>
            </div>
            <span id="countCaptions" class="text-xs text-slate-400 font-mono tabular-nums">0 lines</span>
          </div>
          <textarea
            id="txtCaptions"
            rows="8"
            oninput="syncContentFromTextareas()"
            placeholder="{gm|good morning} builders! {Check this out|New drop live} 🔥&#10;Scaling cloud workflows effortlessy today."
            class="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
          ></textarea>
        </div>

        <!-- Reply Templates -->
        <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 flex flex-col space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-white">Reply Templates</h3>
              <p class="text-xs text-slate-400">Used for auto-self-reply &amp; engagement pod comments (one per line)</p>
            </div>
            <span id="countReplies" class="text-xs text-slate-400 font-mono tabular-nums">0 lines</span>
          </div>
          <textarea
            id="txtReplies"
            rows="7"
            oninput="syncContentFromTextareas()"
            placeholder="Full breakdown in bio link 👇&#10;{Pinned|Check the thread} for more details!"
            class="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
          ></textarea>
        </div>

        <!-- Target Users / Hashtags -->
        <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 flex flex-col space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-white">Target Users &amp; Hashtags</h3>
              <p class="text-xs text-slate-400">Handles or #hashtags to tag/monitor (one per line)</p>
            </div>
            <span id="countTargets" class="text-xs text-slate-400 font-mono tabular-nums">0 lines</span>
          </div>
          <textarea
            id="txtTargets"
            rows="7"
            oninput="syncContentFromTextareas()"
            placeholder="@elonmusk&#10;#buildinpublic&#10;#web3"
            class="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono leading-relaxed"
          ></textarea>
        </div>
      </div>
    </section>

    <!-- TAB 3: ENGAGEMENT & SETTINGS -->
    <section id="tabPanel-settings" class="hidden space-y-6">
      <div class="bg-slate-900/60 border border-slate-800/90 rounded-xl p-5 space-y-6">
        <div>
          <h2 class="text-base font-semibold text-white">Engagement Pod &amp; Execution Settings</h2>
          <p class="text-xs text-slate-400 mt-0.5">Configure automated self-replies, cross-account amplification, and batch concurrency limits.</p>
        </div>

        <div class="divide-y divide-slate-800/80">
          <!-- Auto-Self-Reply -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-white">Auto-Self-Reply</div>
              <div class="text-xs text-slate-400">Automatically post a follow-up reply under newly published tweets using Reply Templates.</div>
            </div>
            <input
              id="chkAutoSelfReply"
              type="checkbox"
              onchange="syncSettingsFromInputs()"
              class="w-5 h-5 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          <!-- Cross-Account Like -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-white">Cross-Account Like (Engagement Pod)</div>
              <div class="text-xs text-slate-400">Have other active fleet accounts automatically like new posts from the pod.</div>
            </div>
            <input
              id="chkCrossLike"
              type="checkbox"
              onchange="syncSettingsFromInputs()"
              class="w-5 h-5 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          <!-- Cross-Account Retweet -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-white">Cross-Account Retweet (Engagement Pod)</div>
              <div class="text-xs text-slate-400">Amplify main posts with staggered retweets across active pod accounts.</div>
            </div>
            <input
              id="chkCrossRetweet"
              type="checkbox"
              onchange="syncSettingsFromInputs()"
              class="w-5 h-5 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          <!-- Cross-Account Bookmark -->
          <div class="py-4 flex items-center justify-between gap-4">
            <div>
              <div class="text-sm font-medium text-white">Cross-Account Bookmark (Engagement Pod)</div>
              <div class="text-xs text-slate-400">Boost algorithmic dwell &amp; bookmark signals from secondary accounts.</div>
            </div>
            <input
              id="chkCrossBookmark"
              type="checkbox"
              onchange="syncSettingsFromInputs()"
              class="w-5 h-5 accent-sky-500 rounded cursor-pointer"
            />
          </div>

          <!-- Max Accounts Per Run -->
          <div class="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div class="text-sm font-medium text-white">Max Accounts per Run</div>
              <div class="text-xs text-slate-400">Maximum number of accounts processed per GitHub Actions workflow execution.</div>
            </div>
            <input
              id="numMaxAccounts"
              type="number"
              min="1"
              max="100"
              onchange="syncSettingsFromInputs()"
              class="w-full sm:w-28 h-11 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono tabular-nums focus:outline-none focus:border-sky-500"
            />
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
      settings: {
        autoSelfReply: true,
        crossAccountLike: true,
        crossAccountRetweet: true,
        crossAccountBookmark: false,
        maxAccountsPerRun: 5
      }
    };

    const savedPass = sessionStorage.getItem('alcashx_pin');
    if (savedPass) {
      document.getElementById('adminPassword').value = savedPass;
    }

    function getPassword() {
      const val = document.getElementById('adminPassword').value.trim();
      if (val) sessionStorage.setItem('alcashx_pin', val);
      return val;
    }

    function showBanner(msg, isError = false) {
      const el = document.getElementById('toastBanner');
      el.classList.remove('hidden', 'bg-rose-950/80', 'border-rose-800', 'text-rose-200', 'bg-emerald-950/80', 'border-emerald-800', 'text-emerald-200');
      if (isError) {
        el.classList.add('bg-rose-950/80', 'border-rose-800', 'text-rose-200');
      } else {
        el.classList.add('bg-emerald-950/80', 'border-emerald-800', 'text-emerald-200');
      }
      el.textContent = msg;
    }

    function switchTab(tab) {
      ['accounts', 'content', 'settings'].forEach((t) => {
        const panel = document.getElementById('tabPanel-' + t);
        const btn = document.getElementById('tabBtn-' + t);
        if (t === tab) {
          panel.classList.remove('hidden');
          btn.className = 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer bg-slate-800 text-white';
        } else {
          panel.classList.add('hidden');
          btn.className = 'flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer text-slate-400 hover:text-white';
        }
      });
    }

    function maskSecret(str) {
      if (!str || str.length <= 8) return '••••••••';
      return str.slice(0, 4) + '••••' + str.slice(-4);
    }

    function escapeHtml(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderUI() {
      const activeCount = state.accounts.filter(a => a.status === 'active').length;
      document.getElementById('statActiveAccounts').textContent = String(activeCount);
      document.getElementById('statTotalAccounts').textContent = 'of ' + state.accounts.length + ' total';
      document.getElementById('statTotalImages').textContent = String(state.images.length);
      document.getElementById('statCaptionsCount').textContent = state.captions.length + ' captions';
      document.getElementById('accountsTableCount').textContent = state.accounts.length + ' accounts';

      const tbody = document.getElementById('accountsTableBody');
      if (state.accounts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500 text-sm">No Twitter accounts added yet. Use the form above or load existing config.</td></tr>';
      } else {
        tbody.innerHTML = state.accounts.map((acc, idx) => \`
          <tr class="hover:bg-slate-800/30 transition-colors">
            <td class="py-3 px-4 font-mono font-medium text-white">\${escapeHtml(acc.username)}</td>
            <td class="py-3 px-4 font-mono text-xs text-slate-400">\${escapeHtml(maskSecret(acc.auth_token))}</td>
            <td class="py-3 px-4 font-mono text-xs text-slate-400">\${escapeHtml(maskSecret(acc.ct0))}</td>
            <td class="py-3 px-4 font-mono text-xs text-slate-400">\${acc.proxy ? escapeHtml(acc.proxy) : '<span class="text-slate-600">Direct</span>'}</td>
            <td class="py-3 px-4">
              <button onclick="toggleAccountStatus(\${idx})" class="text-xs font-medium cursor-pointer \${acc.status === 'active' ? 'text-emerald-400' : acc.status === 'paused' ? 'text-amber-400' : 'text-rose-400'}">
                \${escapeHtml(acc.status.toUpperCase())}
              </button>
            </td>
            <td class="py-3 px-4 text-right">
              <button onclick="removeAccount(\${idx})" class="text-xs text-rose-400 hover:text-rose-300 font-medium cursor-pointer">Delete</button>
            </td>
          </tr>
        \`).join('');
      }

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
      document.getElementById('chkCrossBookmark').checked = Boolean(state.settings.crossAccountBookmark);
      document.getElementById('numMaxAccounts').value = state.settings.maxAccountsPerRun ?? 5;
    }

    function handleAddAccount(e) {
      e.preventDefault();
      const usernameRaw = document.getElementById('accUsername').value.trim();
      const username = usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw;
      const auth_token = document.getElementById('accAuthToken').value.trim();
      const ct0 = document.getElementById('accCt0').value.trim();
      const proxy = document.getElementById('accProxy').value.trim();
      const status = document.getElementById('accStatus').value;

      state.accounts.push({ username, auth_token, ct0, proxy, status });
      document.getElementById('accUsername').value = '';
      document.getElementById('accAuthToken').value = '';
      document.getElementById('accCt0').value = '';
      document.getElementById('accProxy').value = '';
      renderUI();
    }

    function removeAccount(idx) {
      state.accounts.splice(idx, 1);
      renderUI();
    }

    function toggleAccountStatus(idx) {
      const order = ['active', 'paused', 'cooldown'];
      const current = state.accounts[idx].status || 'active';
      state.accounts[idx].status = order[(order.indexOf(current) + 1) % order.length];
      renderUI();
    }

    function syncContentFromTextareas() {
      const splitLines = (id) => document.getElementById(id).value.split('\\n').map(s => s.trim()).filter(Boolean);
      state.images = splitLines('txtImages');
      state.captions = splitLines('txtCaptions');
      state.replies = splitLines('txtReplies');
      state.targets = splitLines('txtTargets');

      document.getElementById('statTotalImages').textContent = String(state.images.length);
      document.getElementById('statCaptionsCount').textContent = state.captions.length + ' captions';
      document.getElementById('countImages').textContent = state.images.length + ' lines';
      document.getElementById('countCaptions').textContent = state.captions.length + ' lines';
      document.getElementById('countReplies').textContent = state.replies.length + ' lines';
      document.getElementById('countTargets').textContent = state.targets.length + ' lines';
    }

    function syncSettingsFromInputs() {
      state.settings = {
        autoSelfReply: document.getElementById('chkAutoSelfReply').checked,
        crossAccountLike: document.getElementById('chkCrossLike').checked,
        crossAccountRetweet: document.getElementById('chkCrossRetweet').checked,
        crossAccountBookmark: document.getElementById('chkCrossBookmark').checked,
        maxAccountsPerRun: Math.max(1, parseInt(document.getElementById('numMaxAccounts').value || '5', 10))
      };
    }

    async function apiCall(action, extra = {}) {
      const password = getPassword();
      if (!password) {
        showBanner('Please enter your Admin Password / PIN in the top bar first.', true);
        throw new Error('Missing password');
      }
      const res = await fetch(window.location.pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, password, ...extra })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Request failed');
      }
      return data;
    }

    async function loadConfigFromGitHub() {
      const btn = document.getElementById('btnLoad');
      btn.textContent = 'Loading...';
      try {
        const data = await apiCall('load_config');
        state = {
          accounts: data.config.accounts || [],
          images: data.config.images || [],
          captions: data.config.captions || [],
          replies: data.config.replies || [],
          targets: data.config.targets || [],
          settings: {
            autoSelfReply: data.config.settings?.autoSelfReply ?? true,
            crossAccountLike: data.config.settings?.crossAccountLike ?? true,
            crossAccountRetweet: data.config.settings?.crossAccountRetweet ?? true,
            crossAccountBookmark: data.config.settings?.crossAccountBookmark ?? false,
            maxAccountsPerRun: data.config.settings?.maxAccountsPerRun ?? 5
          }
        };
        renderUI();
        document.getElementById('statRepoInfo').textContent = data.repo || 'bot.yml';
        showBanner('Loaded configuration from ' + (data.repo || 'GitHub') + (data.sha ? ' (SHA: ' + data.sha.slice(0, 7) + ')' : ''));
      } catch (err) {
        showBanner(err.message, true);
      } finally {
        btn.textContent = 'Load Config';
      }
    }

    async function saveConfigToGitHub() {
      syncContentFromTextareas();
      syncSettingsFromInputs();
      const btn = document.getElementById('btnSave');
      btn.textContent = 'Saving...';
      try {
        const data = await apiCall('save_config', { config: state });
        showBanner(data.message + (data.sha ? ' (SHA: ' + data.sha.slice(0, 7) + ')' : ''));
      } catch (err) {
        showBanner(err.message, true);
      } finally {
        btn.textContent = 'Save to GitHub';
      }
    }

    async function triggerBotNow() {
      const btn = document.getElementById('btnRunBot');
      const statusEl = document.getElementById('statBotStatus');
      btn.disabled = true;
      statusEl.textContent = 'Dispatching...';
      try {
        await saveConfigToGitHub();
        const data = await apiCall('trigger_bot');
        statusEl.textContent = 'Running · Dispatched';
        showBanner('🚀 ' + data.message);
      } catch (err) {
        statusEl.textContent = 'Dispatch Error';
        showBanner(err.message, true);
      } finally {
        btn.disabled = false;
      }
    }

    renderUI();
    if (getPassword()) {
      loadConfigFromGitHub();
    }
  </script>
</body>
</html>`;
}
