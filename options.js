// Settings page logic
const $ = (id) => document.getElementById(id);

// One row per provider: which input holds its key, which chrome.storage.local
// field stores it, and the name shown in the "Active: …" tier line
const PROVIDERS = {
  gemini: { input: 'geminiKey', storageKey: 'geminiApiKey', label: 'Gemini' },
  claude: { input: 'apiKey', storageKey: 'anthropicApiKey', label: 'Claude' },
  openai: { input: 'openaiKey', storageKey: 'openaiApiKey', label: 'OpenAI' },
  kimi: { input: 'kimiKey', storageKey: 'kimiApiKey', label: 'Kimi' },
};
const normProvider = (v) => (v === 'builtin' || PROVIDERS[v] ? v : 'gemini');

document.addEventListener('DOMContentLoaded', async () => {
  await I18n.init(); // translates all data-i18n markup and the toggle label
  const t = I18n.t;
  // Re-render closures for transient strings, so a language toggle refreshes them
  let renderTestResult = null;
  let renderAccountMsg = null;
  let renderObText = null;
  let obStep = 0; // first-run onboarding: 0 off, 1 connect Google, 2 choose AI, 3 done
  const cfg = await chrome.storage.sync.get({
    aiProvider: 'gemini',
    defaultEventMinutes: 30,
  });
  const keys = await AiExtract.loadKeys(); // local-only storage; migrates keys old versions kept in sync
  const storedProv = normProvider(cfg.aiProvider);
  const anyKeySaved = Object.values(PROVIDERS).some((p) => keys[p.storageKey]);
  // Default to the on-device model unless the user explicitly runs on a key
  $('srcBuiltin').checked = storedProv === 'builtin' || !anyKeySaved;
  $('srcApi').checked = !$('srcBuiltin').checked;
  $('provider').value = storedProv === 'builtin' ? 'gemini' : storedProv;
  for (const p of Object.values(PROVIDERS)) $(p.input).value = keys[p.storageKey];
  $('eventMinutes').value = cfg.defaultEventMinutes;

  // 'builtin' when the on-device radio is picked, else the dropdown provider
  const currentChoice = () => ($('srcBuiltin').checked ? 'builtin' : normProvider($('provider').value));

  // Per-provider walkthrough, opened by the "How to get an API key" link.
  // Numbered steps beat a wall of prose: the user is mid-task, not reading.
  const KEY_STEPS = {
    gemini: [
      'Open aistudio.google.com/apikey',
      'Sign in with your Google account',
      'Click "Create API key", then "Create API key in new project"',
      'Copy the key that starts with AIza',
      'Paste it in the field above and click Save',
    ],
    claude: [
      'Open console.anthropic.com and sign in',
      'Add credit under Billing (Anthropic has no free tier)',
      'Go to API Keys and click "Create Key"',
      'Copy the key that starts with sk-ant-',
      'Paste it in the field above and click Save',
    ],
    openai: [
      'Open platform.openai.com/api-keys and sign in',
      'Add a payment method under Billing (OpenAI has no free tier)',
      'Click "Create new secret key"',
      'Copy the key that starts with sk-, it is shown only once',
      'Paste it in the field above and click Save',
    ],
    kimi: [
      'Open platform.moonshot.cn, or platform.moonshot.ai outside mainland China',
      'Sign in and top up your balance',
      'Go to API Keys and create a new key',
      'Copy the key',
      'Paste it in the field above and click Save',
    ],
  };
  let keyHelpOpen = false;
  const renderKeyHelp = () => {
    const box = $('keyHelpSteps');
    box.classList.toggle('hidden', !keyHelpOpen);
    $('keyHelpToggle').textContent = t(keyHelpOpen ? 'Hide the steps' : 'How to get an API key');
    if (!keyHelpOpen) return;
    box.textContent = '';
    for (const step of KEY_STEPS[normProvider($('provider').value)] || []) {
      const li = document.createElement('li');
      li.textContent = t(step);
      box.appendChild(li);
    }
  };
  $('keyHelpToggle').addEventListener('click', () => {
    keyHelpOpen = !keyHelpOpen;
    renderKeyHelp();
  });
  // The link sitting on the radio row itself: someone who does not know what an
  // API key is needs something to click right there, before choosing anything.
  $('apiHowLink').addEventListener('click', () => {
    $('srcApi').checked = true;
    syncApiVisibility();
    refreshTier();
    keyHelpOpen = true;
    renderKeyHelp();
    $('keyHelpSteps').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // The API section shows only when "your own key" is picked, and within it
  // only the selected provider's key row — never all four stacked up
  const syncApiVisibility = () => {
    // Selected-tile styling is applied here rather than with :has(input:checked):
    // that selector matches but does not repaint on some Chrome builds.
    $('srcBuiltin').closest('.tile').classList.toggle('on', $('srcBuiltin').checked);
    $('srcApi').closest('.tile').classList.toggle('on', $('srcApi').checked);
    $('apiConfig').classList.toggle('hidden', $('srcBuiltin').checked);
    const chosen = normProvider($('provider').value);
    for (const name of Object.keys(PROVIDERS)) {
      $('row-' + name).classList.toggle('hidden', name !== chosen);
    }
    renderKeyHelp();
  };
  syncApiVisibility();
  ['srcBuiltin', 'srcApi'].forEach((id) =>
    $(id).addEventListener('change', () => { syncApiVisibility(); refreshTier(); })
  );

  // User-first AI status: green "you already have a model" when anything works
  // (a saved key, or Chrome's built-in AI); otherwise say plainly that nothing
  // is set up yet. The on-device/API choice stays visible either way.
  const refreshTier = async () => {
    const el = $('aiTier');
    const k = await AiExtract.loadKeys();
    const chosen = currentChoice();
    el.className = 'tier';
    // Explicitly choosing the on-device model skips the key logic entirely,
    // so a saved key no longer locks the user out of the built-in AI
    if (chosen !== 'builtin') {
      const keyed = k[PROVIDERS[chosen].storageKey]
        ? chosen
        : Object.keys(PROVIDERS).find((p) => k[PROVIDERS[p].storageKey]);
      if (keyed) {
        showHasAI(t('your {p} API key', { p: PROVIDERS[keyed].label }));
        return;
      }
    }
    const avail = await AiExtract.builtinAvailability();
    if (avail === 'available') {
      // Only promise screenshot reading when the on-device model can actually take images
      const imgOK = await AiExtract.builtinImageAvailability();
      showHasAI(t("Chrome's built-in AI (free, runs on your computer)"), imgOK);
      return;
    }
    el.textContent = t("No AI model is available on this computer yet, so screenshots and page content can't be recognized automatically. To enable one-click recognition, use one of the methods below.");
    const dl = avail === 'downloadable' || avail === 'downloading';
    const lines = dl
      ? [
          t("Method 1 (recommended, free): enable Chrome's built-in AI with the button below. It downloads once (~2 GB) and runs on your computer."),
          t('Method 2: paste your own API key below. Google Gemini has a free tier; get a key at aistudio.google.com (no credit card needed).'),
        ]
      : [t("This computer can't run Chrome's built-in AI, so recognition needs an API key below. Google Gemini has a free tier; get one at aistudio.google.com (no credit card needed).")];
    $('aiMethods').innerHTML = lines.join('<br>');
    $('aiMethods').classList.remove('hidden');
    const dlBtn = $('builtinDownloadBtn');
    dlBtn.classList.toggle('hidden', !dl);
    if (dl && !dlBtn.dataset.busy) dlBtn.textContent = t('Enable free AI (one-time ~2 GB download, runs on your computer)');
  };
  const showHasAI = (what, screenshotsOK = true) => {
    const el = $('aiTier');
    el.classList.add('good');
    el.textContent = screenshotsOK
      ? t('✓ You already have a working AI model: {what}. Recognition, including screenshots, is ready.', { what })
      : t("✓ You already have a working AI model: {what}. Text recognition is ready (this Chrome version can't read screenshots on-device yet).", { what });
    $('aiMethods').classList.add('hidden');
    $('builtinDownloadBtn').classList.add('hidden');
  };
  // The one-time on-device download, right here in Settings (a click is the
  // user gesture Chrome requires to start it)
  $('builtinDownloadBtn').addEventListener('click', async () => {
    const btn = $('builtinDownloadBtn');
    btn.disabled = true;
    btn.dataset.busy = '1';
    btn.textContent = t('Downloading on-device AI…');
    try {
      await AiExtract.ensureBuiltinReady((p) => {
        btn.textContent = t('Downloading on-device AI…') + ' ' + Math.round(p * 100) + '%';
      });
      delete btn.dataset.busy;
      btn.disabled = false;
      refreshTier(); // built-in AI is ready — the section turns green
    } catch (e) {
      delete btn.dataset.busy;
      btn.disabled = false;
      btn.textContent = t('Download failed. Click to retry.');
    }
  });
  refreshTier();
  $('provider').addEventListener('change', () => { syncApiVisibility(); refreshTier(); });

  // One-click language switch; dynamic lines re-render in the new language
  $('langToggle').addEventListener('click', async () => {
    await I18n.toggle();
    refreshTier();
    refreshAccount();
    keyToggles.forEach(([b, i]) => syncToggleLabel(b, i)); // keep Show/Hide truthful
    renderKeyHelp(); // re-translate the open key how-to, if any
    if (renderTestResult) renderTestResult();
    if (renderAccountMsg) renderAccountMsg();
    if (renderObText) renderObText();
  });

  // Google account: a plain connected/not-connected status. Connecting is an
  // explicit button that opens Google's own account picker right away.
  const renderAccount = (email) => {
    const st = $('accountStatus');
    st.className = 'tier';
    if (email) {
      st.classList.add('good');
      st.textContent = t('✓ Connected: {email}', { email });
    } else {
      st.textContent = t('Not connected');
    }
    $('connectBtn').classList.toggle('hidden', !!email);
    $('disconnectBtn').classList.toggle('hidden', !email);
    if (obStep === 1 && email) obSetStep(2); // onboarding: account connected, move on
  };
  const refreshAccount = () => {
    chrome.runtime.sendMessage({ action: 'whoami' }, (resp) => {
      void chrome.runtime.lastError;
      renderAccount((resp && resp.ok && resp.data && resp.data.email) || null);
    });
  };
  refreshAccount();

  // Ask for the token from THIS page, not from the background service worker:
  // an interactive consent window can outlive the worker, and when Chrome
  // recycles it the response never arrives and the UI hangs on "Connecting…".
  $('connectBtn').addEventListener('click', () => {
    renderAccountMsg = () => { $('accountMsg').textContent = t('Connecting…'); };
    renderAccountMsg();
    $('connectBtn').disabled = true;
    const failed = (raw) => {
      $('connectBtn').disabled = false;
      renderAccountMsg = () => { $('accountMsg').textContent = '✗ ' + t(raw); };
      renderAccountMsg();
      if (obStep === 1) $('obSkip').classList.remove('hidden'); // offer a way out only now
    };
    try {
      chrome.identity.getAuthToken({ interactive: true }, async (token) => {
        if (chrome.runtime.lastError || !token) {
          failed((chrome.runtime.lastError && chrome.runtime.lastError.message) || 'Authorization failed');
          return;
        }
        $('connectBtn').disabled = false;
        let email = null;
        try {
          const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: { Authorization: 'Bearer ' + token },
          });
          if (res.ok) email = (await res.json()).email || null;
        } catch (e) { /* connected, but the address could not be read */ }
        renderAccountMsg = null;
        $('accountMsg').textContent = '';
        renderAccount(email || t('connected'));
      });
    } catch (e) {
      failed((e && e.message) || 'Authorization failed');
    }
  });

  // —— First-run onboarding: a step-at-a-time wizard on the settings page.
  // Wizard mode hides everything except the current step's card (body.ob-N).
  // It appears whenever setup was never completed, so closing the tab midway
  // just resumes at the unfinished step next time; "Set up later" opts out.
  const obSetStep = async (n) => {
    obStep = n;
    document.body.classList.remove('ob-1', 'ob-2', 'ob-3', 'ob-4', 'ob-5');
    if (n >= 1 && n <= 5) document.body.classList.add('ob-' + n);
    $('obPrimary').classList.toggle('hidden', n === 1 || n === 5);
    // Step 1 has no escape hatch by default: connecting Google is what makes
    // the product do anything. It only appears if an attempt fails.
    $('obSkip').classList.add('hidden');
    $('obActions').classList.toggle('hidden', n === 5);
    $('obDots').classList.toggle('hidden', n === 5);
    Array.from($('obDots').children).forEach((d, i) => d.classList.toggle('on', i === n - 1));
    if (n === 1) {
      renderObText = () => {
        $('obText').textContent = t('Step 1 of 4: Connect the Google account your tasks and events will be saved to.');
      };
    } else if (n === 2) {
      renderObText = () => {
        $('obText').textContent = t('Step 2 of 4: Choose how recognition runs. Reading pages, screenshots, and text needs an AI model.');
        $('obPrimary').textContent = t('Next');
      };
      refreshTier();
    } else if (n === 3) {
      renderObText = () => {
        $('obText').textContent = t('Step 3 of 4: Pin Page2Task to your toolbar so it is always one click away.');
        $('obPrimary').textContent = t('Next');
      };
      fitStages();
    } else if (n === 4) {
      renderObText = () => {
        $('obText').textContent = t('Step 4 of 4: On any page with a date in it, click the icon and it becomes a to-do or an event.');
        $('obPrimary').textContent = t('Start using Page2Task');
      };
      fitStages();
    } else if (n === 5) {
      renderObText = () => {
        $('obText').textContent = t('All set! Close this page and click the Page2Task icon on any page.');
      };
      await chrome.storage.local.set({ onboardingDone: true });
    }
    if (renderObText) renderObText();
  };
  // The animations are fixed 960x600 stages; scale each to its card
  const fitStages = () => {
    document.querySelectorAll('.ob-stage').forEach((st) => {
      if (st.clientWidth) st.style.setProperty('--obs', (st.clientWidth / 960).toFixed(4));
    });
  };
  window.addEventListener('resize', fitStages);
  const obExit = async () => {
    await chrome.storage.local.set({ onboardingDone: true });
    document.body.classList.remove('ob-1', 'ob-2', 'ob-3');
    $('obBanner').classList.add('hidden');
    $('obActions').classList.add('hidden');
    renderObText = null;
    obStep = 0;
  };
  $('obPrimary').addEventListener('click', () => {
    if (obStep === 2) { $('saveBtn').click(); obSetStep(3); return; }
    if (obStep === 3) { obSetStep(4); return; }
    obSetStep(5);
  });
  // Skipping step 1 only skips Google: everyone still passes the AI choice
  $('obSkip').addEventListener('click', () => {
    if (obStep === 1) obSetStep(2);
    else obExit();
  });
  {
    const { onboardingDone } = await chrome.storage.local.get({ onboardingDone: false });
    if (!onboardingDone) {
      const email = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'whoami' }, (resp) => {
          void chrome.runtime.lastError;
          resolve((resp && resp.ok && resp.data && resp.data.email) || null);
        });
      });
      if (email) {
        // Already connected: an existing, configured install — no wizard
        await chrome.storage.local.set({ onboardingDone: true });
      } else {
        $('obBanner').classList.remove('hidden');
        $('obActions').classList.remove('hidden');
        obSetStep(1);
      }
    }
  }

  $('disconnectBtn').addEventListener('click', () => {
    renderAccountMsg = () => { $('accountMsg').textContent = t('Disconnecting…'); };
    renderAccountMsg();
    $('disconnectBtn').disabled = true;
    chrome.runtime.sendMessage({ action: 'disconnect' }, () => {
      void chrome.runtime.lastError;
      $('disconnectBtn').disabled = false;
      renderAccountMsg = null;
      $('accountMsg').textContent = '';
      renderAccount(null);
    });
  });

  // Show/Hide labels are owned by JS (no data-i18n), so a language toggle can
  // re-sync them to the input's REAL visibility instead of resetting to "Show"
  const keyToggles = [];
  const syncToggleLabel = (btnId, inputId) => {
    $(btnId).textContent = t($(inputId).type === 'password' ? 'Show' : 'Hide');
  };
  const wireToggle = (btnId, inputId) => {
    keyToggles.push([btnId, inputId]);
    syncToggleLabel(btnId, inputId);
    $(btnId).addEventListener('click', () => {
      const input = $(inputId);
      input.type = input.type === 'password' ? 'text' : 'password';
      syncToggleLabel(btnId, inputId);
    });
  };
  wireToggle('toggleGeminiKey', 'geminiKey');
  wireToggle('toggleKey', 'apiKey');
  wireToggle('toggleOpenaiKey', 'openaiKey');
  wireToggle('toggleKimiKey', 'kimiKey');

  $('saveBtn').addEventListener('click', async () => {
    // Keys go to LOCAL storage only (this computer); preferences may sync
    const toStore = {};
    for (const p of Object.values(PROVIDERS)) toStore[p.storageKey] = $(p.input).value.trim();
    await chrome.storage.local.set(toStore);
    await chrome.storage.sync.set({
      aiProvider: currentChoice(),
      defaultEventMinutes: Math.min(480, Math.max(5, parseInt($('eventMinutes').value, 10) || 30)),
    });
    $('saveStatus').textContent = t('Saved ✓');
    refreshTier();
    setTimeout(() => { $('saveStatus').textContent = ''; }, 2000);
  });

  $('testBtn').addEventListener('click', async () => {
    const provider = currentChoice();
    const isBuiltin = provider === 'builtin';
    const key = isBuiltin ? null : $(PROVIDERS[provider].input).value.trim();
    const out = $('testResult');
    if (!isBuiltin && !key) {
      renderTestResult = () => { out.textContent = t('Enter the API key for the selected provider first'); };
      renderTestResult();
      return;
    }
    if (isBuiltin && (await AiExtract.builtinAvailability()) !== 'available') {
      renderTestResult = () => { out.textContent = t('Download the on-device model first (use the button above)'); };
      renderTestResult();
      return;
    }
    renderTestResult = () => { out.textContent = t('Testing…'); };
    renderTestResult();
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const iso = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      const r = await AiExtract.extract({
        text: 'Please submit the project report by 3pm next Friday',
        refDateISO: iso,
        apiKey: key,
        provider,
      });
      if (!r.items || !r.items.length) throw new Error('AI returned no items for a sentence with an obvious deadline');
      const it = r.items[0];
      renderTestResult = () => {
        out.textContent = t('✓ AI extraction works: “{t}” due {d}', {
          t: it.title || 'n/a',
          d: (it.dueDate || 'n/a') + (it.dueTime ? ' ' + it.dueTime : ''),
        });
      };
      renderTestResult();
    } catch (e) {
      renderTestResult = () => { out.textContent = '✗ ' + t((e && e.message) || 'Test failed'); };
      renderTestResult();
    }
  });
});
