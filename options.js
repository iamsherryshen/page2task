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
      $('disconnectStatus').textContent = 'Disconnected — the next save will ask you to pick an account';
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
        '✓ AI extraction works: “' + (it.title || '—') + '” due ' + (it.dueDate || '—') +
        (it.dueTime ? ' ' + it.dueTime : '');
    } catch (e) {
      out.textContent = '✗ ' + ((e && e.message) || 'Test failed');
    }
  });
});
