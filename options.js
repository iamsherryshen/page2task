// Settings page logic
const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', async () => {
  const cfg = await chrome.storage.sync.get({
    aiProvider: 'gemini',
    defaultEventMinutes: 30,
  });
  const keys = await AiExtract.loadKeys(); // local-only storage; migrates keys old versions kept in sync
  $('provider').value = cfg.aiProvider === 'claude' ? 'claude' : 'gemini';
  $('geminiKey').value = keys.geminiApiKey;
  $('apiKey').value = keys.anthropicApiKey;
  $('eventMinutes').value = cfg.defaultEventMinutes;

  // Say plainly which recognition tier is active right now, so nobody has to
  // guess why titles are basic or why a screenshot was not read
  const refreshTier = async () => {
    const el = $('aiTier');
    const k = await AiExtract.loadKeys();
    const chosen = $('provider').value === 'claude' ? 'claude' : 'gemini';
    const key = chosen === 'gemini' ? k.geminiApiKey : k.anthropicApiKey;
    const anyKey = k.geminiApiKey || k.anthropicApiKey;
    el.className = 'tier';
    if (key || anyKey) {
      el.classList.add('good');
      el.textContent = key
        ? 'Active: your ' + (chosen === 'gemini' ? 'Gemini' : 'Claude') + ' API key. Full AI, including screenshots.'
        : 'Active: your saved API key for the other provider. Switch the provider above to match.';
      return;
    }
    const avail = await AiExtract.builtinAvailability();
    if (avail === 'available') {
      el.classList.add('good');
      el.textContent = "Active: Chrome's built-in AI. Free, runs on your computer, nothing leaves the device.";
    } else if (avail === 'downloadable' || avail === 'downloading') {
      el.textContent = "Available: Chrome's built-in AI, after a one-time ~2 GB download. "
        + 'Open the extension popup and click "Enable free AI" to start it. Free, and it runs on your computer.';
    } else {
      el.textContent = 'Active: basic date rules (no AI). This computer cannot run Chrome\'s built-in AI, '
        + 'so dates are detected locally and screenshots cannot be read. Add a key below for full AI.';
    }
  };
  refreshTier();
  $('provider').addEventListener('change', refreshTier);

  const refreshAccount = () => {
    chrome.runtime.sendMessage({ action: 'whoami' }, (resp) => {
      void chrome.runtime.lastError;
      const email = resp && resp.ok && resp.data && resp.data.email;
      $('accountEmail').textContent = email || 'not connected yet (authorize on first save)';
    });
  };
  refreshAccount();

  $('disconnectBtn').addEventListener('click', () => {
    $('disconnectStatus').textContent = 'Disconnecting…';
    chrome.runtime.sendMessage({ action: 'disconnect' }, () => {
      void chrome.runtime.lastError;
      $('disconnectStatus').textContent = 'Disconnected. The next save will ask you to pick an account.';
      refreshAccount();
    });
  });

  const wireToggle = (btnId, inputId) => {
    $(btnId).addEventListener('click', () => {
      const input = $(inputId);
      input.type = input.type === 'password' ? 'text' : 'password';
      $(btnId).textContent = input.type === 'password' ? 'Show' : 'Hide';
    });
  };
  wireToggle('toggleGeminiKey', 'geminiKey');
  wireToggle('toggleKey', 'apiKey');

  $('saveBtn').addEventListener('click', async () => {
    // Keys go to LOCAL storage only (this computer); preferences may sync
    await chrome.storage.local.set({
      geminiApiKey: $('geminiKey').value.trim(),
      anthropicApiKey: $('apiKey').value.trim(),
    });
    await chrome.storage.sync.set({
      aiProvider: $('provider').value === 'claude' ? 'claude' : 'gemini',
      defaultEventMinutes: Math.min(480, Math.max(5, parseInt($('eventMinutes').value, 10) || 30)),
    });
    $('saveStatus').textContent = 'Saved ✓';
    refreshTier();
    setTimeout(() => { $('saveStatus').textContent = ''; }, 2000);
  });

  $('testBtn').addEventListener('click', async () => {
    const provider = $('provider').value === 'claude' ? 'claude' : 'gemini';
    const key = (provider === 'gemini' ? $('geminiKey').value : $('apiKey').value).trim();
    const out = $('testResult');
    if (!key) { out.textContent = 'Enter the API key for the selected provider first'; return; }
    out.textContent = 'Testing…';
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
      out.textContent =
        '✓ AI extraction works: “' + (it.title || 'n/a') + '” due ' + (it.dueDate || 'n/a') +
        (it.dueTime ? ' ' + it.dueTime : '');
    } catch (e) {
      out.textContent = '✗ ' + ((e && e.message) || 'Test failed');
    }
  });
});
