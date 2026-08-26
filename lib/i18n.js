// Lightweight UI language layer (English / 中文）.
// Keys ARE the English strings, so t() falls back to English for free and the
// call sites stay readable. Static HTML is marked with data-i18n attributes;
// dynamic strings call I18n.t() at render time. The choice is stored in
// chrome.storage.sync as uiLang; first run follows the browser language.
// 中文文案一律使用全角标点（，：；（）！？），仅 URL、数字单位、产品名保留半角。
(function (root) {
  const ZH = {
    // — popup: header & modes —
    'Settings': '设置',
    'To-do': '待办',
    'Calendar': '日历',
    'Both': '待办及日历',
    'AI is reading…': 'AI 识别中…',

    // — popup: import zone & form —
    'Paste a screenshot or text here, or ': '在这里粘贴截图或文字，或',
    'upload a file': '上传文件',
    'Several deadlines found. Check the ones to add; edit each one below:': '发现多个时间点。勾选要添加的，可在下方逐条修改：',
    'Title': '标题',
    'Task name': '任务名称',
    'Date (optional)': '日期（可选）',
    'Date': '日期',
    'Start time': '开始时间',
    'End time': '结束时间',
    'Clear time': '清除时间',
    'Google Tasks saves only the date (any time goes into the notes). For a calendar event, start & end set its length.': 'Google Tasks 只保存日期（时间会写进备注）；日历事件则由开始和结束时间决定时长。',
    'Location (optional)': '地点（可选）',
    'Notes': '备注',
    'Task list': '任务清单',
    'Item {n}': '第 {n} 项',
    'Include this one when adding': '添加时包含这一条',
    'Detected from: “{s}”': '识别自：“{s}”',

    // — popup: submit button —
    'Add to-do': '添加待办',
    'Add {n} to-dos': '添加 {n} 个待办',
    'Add event': '添加日程',
    'Add {n} events': '添加 {n} 个日程',
    'Add both': '同时添加',
    'Add {n} to both': '添加 {n} 项到两者',
    'Google Tasks + Calendar': 'Google Tasks + 日历',
    'Adding…': '添加中…',

    // — popup: chips & notices —
    'Email': '邮件',
    'Video · ~{n} min long': '视频 · 约 {n} 分钟',
    'Page': '网页',
    'Screenshot': '截图',
    'Pasted text': '粘贴的文字',
    "This page can't be read automatically. Fill in the fields manually.": '这个页面无法自动读取，请手动填写下面的字段。',
    "Chrome's PDF viewer doesn't let extensions read the text. Title taken from the file name.": 'Chrome 的 PDF 查看器不允许插件读取文字，标题已取自文件名。',
    'No upcoming deadline found. The dates in this email may have already passed.': '没有发现将来的时间点，这封邮件里的日期可能已经过去了。',
    'AI is reading this page…': 'AI 正在读取本页…',
    'AI is reading the screenshot…': 'AI 正在识别截图…',
    'AI is reading the text…': 'AI 正在识别文字…',
    'AI unavailable ({err}). Using local rules.': 'AI 暂不可用（{err}），已改用本地规则。',
    'Reading the PDF…': '正在读取 PDF…',
    'AI is reading the PDF…': 'AI 正在读取 PDF…',
    'Could not read this PDF. Try a screenshot of it instead.': '无法读取这份 PDF。请改用它的截图。',
    'Nothing to add was found in this PDF': '这份 PDF 里没有找到可添加的内容',
    'PDF recognition failed': 'PDF 识别失败',
    'Long PDF: only the first 3 pages were read.': 'PDF 较长，只读取了前 3 页。',
    'Nothing to add was found in this screenshot': '截图里没有发现可添加的内容',
    'Nothing to add was found in this text': '这段文字里没有发现可添加的内容',
    'Screenshot recognition failed': '截图识别失败',
    "Couldn't read this text": '无法识别这段文字',
    'Saving to Google account: {email}': '保存到 Google 账号：{email}',

    // — popup: AI setup offers —
    'AI is off (using basic date rules). Click to set up free AI.': 'AI 未开启（仅用基础日期规则）。点击设置免费 AI。',
    'Using the on-device AI model. For better recognition, add your own API key in Settings. Keys stay only on this computer, never visible to the developer or anyone else.': '正在使用本地 AI 模型。想要更好的识别效果，可以在设置里添加你自己的 API key。key 仅存储于本机，开发者与任何第三方均无法获取。',
    'Add your own AI key in Settings. Google Gemini has a free tier (no credit card needed). Your key is stored only on this computer, sent only to the AI provider, and never visible to the developer.': '在设置里填入你自己的 AI key。Google Gemini 有免费额度（无需信用卡）。key 仅存储于本机，且仅用于调用所选服务商的官方接口，开发者无法获取。',
    'Enable free AI (one-time ~2 GB download, runs on your computer)': '启用免费 AI（一次性下载约 2 GB，之后在你电脑上运行）',
    "Chrome's built-in AI model. It runs entirely on your computer: no account, no API key, and nothing you analyze leaves your device. The model is shared by all of Chrome's AI features, so it only ever downloads once.": 'Chrome 内置的 AI 模型，完全在你电脑上运行：不需要账号和 key，识别的内容不会离开设备。这个模型由 Chrome 的所有 AI 功能共用，只需下载一次。',
    'Downloading on-device AI…': '正在下载本地 AI 模型…',
    'Download failed. Click to retry.': '下载失败，点击重试。',
    'AI is one click away. Use the "Enable free AI" line above.': '只差一步：点上方「启用免费 AI」。',
    'AI recognition needs a newer Chrome (built-in AI) or an API key in Settings (the gear icon)': 'AI 识别需要较新的 Chrome（内置 AI），或在设置里（齿轮图标）填一个 API key',

    // — popup: submit results & errors —
    'Please enter a title': '请填写标题',
    'Item {i} has no date. Calendar events need one.': '第 {i} 项没有日期，日历事件必须有日期。',
    'Open Google Tasks': '打开 Google Tasks',
    'View in Calendar': '在日历中查看',
    'Added to Google Tasks ✓': '已添加到 Google Tasks ✓',
    'Added {n} to-dos to Google Tasks ✓': '已添加 {n} 个待办到 Google Tasks ✓',
    'Added to Google Calendar ✓': '已添加到 Google 日历 ✓',
    'Added {n} events to Google Calendar ✓': '已添加 {n} 个日程到 Google 日历 ✓',
    'Added to Google Tasks & Calendar ✓': '已添加到 Google Tasks 和日历 ✓',
    'Added {n} items to Tasks & Calendar ✓': '已添加 {n} 项到 Tasks 和日历 ✓',
    'Item {i} of {total}: ': '第 {i}/{total} 项：',
    ' ({n} already added)': '（前 {n} 项已成功添加）',
    'The to-do was saved, but the calendar event failed: {err}': '待办已保存，但日历事件创建失败：{err}',
    'Something went wrong, please try again': '出错了，请重试',
    'The request is still finishing in the background. Check Google Tasks/Calendar before retrying.': '请求仍在后台完成中，重试前先去 Google Tasks/日历确认一下。',
    'One more step: a one-time Google authorization setup (~10 minutes) is needed.<br>Open <b>SETUP.md</b> in the project folder and follow the steps, or simply ask Claude to do it with you.': '还差一步：需要一次性完成 Google 授权设置（约 10 分钟）。<br>打开项目文件夹里的 <b>SETUP.md</b> 按步骤操作，或者直接让 Claude 陪你完成。',

    // — shared AI error sentences (thrown by lib/ai.js, translated at display) —
    'Invalid API key. Please check it in Settings.': 'API key 无效，请到设置里检查',
    'Network error: could not reach the AI service': '网络错误，无法连接 AI 服务',
    'AI request timed out': 'AI 请求超时',
    'Could not parse the AI response': '无法解析 AI 的返回结果',
    'Gemini rate limit reached. Wait a minute and try again.': 'Gemini 触发限流，等一分钟再试',
    'OpenAI rate limit reached. Wait a minute and try again.': 'OpenAI 触发限流，等一分钟再试',
    'Kimi account has no balance. Top up on the provider site and try again.': 'Kimi 账户余额不足。请到平台充值后再试。',
    'OpenAI account has no balance. Top up on the provider site and try again.': 'OpenAI 账户余额不足。请到平台充值后再试。',
    'Kimi rate limit reached. Wait a minute and try again.': 'Kimi 触发限流，等一分钟再试',
    'This Chrome version has no built-in AI': '这个版本的 Chrome 没有内置 AI',
    "This Chrome version can't read screenshots on-device yet. Pasted text still works, or add an API key in Settings.": '这个版本的 Chrome 还不能在本地识别截图；粘贴文字仍然可用，或在设置里填一个 API key',

    // — options page —
    'Page2Task Settings': 'Page2Task 设置',
    'How to use: click the Page2Task icon on any page, check what it detected, and hit Add.': '使用方法：在任意网页点击 Page2Task 图标，确认识别出的内容，点添加即可。',
    'AI recognition': 'AI 识别',
    'Checking what AI is available…': '正在检查可用的 AI…',
    '✓ You already have a working AI model: {what}. Recognition, including screenshots, is ready.': '✓ 你已经有可用的 AI 模型：{what}。识别功能（含截图）已就绪。',
    "✓ You already have a working AI model: {what}. Text recognition is ready (this Chrome version can't read screenshots on-device yet).": '✓ 你已经有可用的 AI 模型：{what}。文字识别已就绪（这个版本的 Chrome 暂不能在本地识别截图）。',
    'your {p} API key': '你的 {p} API key',
    "Chrome's built-in AI (free, runs on your computer)": 'Chrome 内置 AI（免费，在你电脑上运行）',
    "No AI model is available on this computer yet, so screenshots and page content can't be recognized automatically. To enable one-click recognition, use one of the methods below.": '你本地还没有可用的 AI 模型，产品暂时无法智能识别截图和网页内容。想要一键识别，可以用下面的方法：',
    "Method 1 (recommended, free): enable Chrome's built-in AI with the button below. It downloads once (~2 GB) and runs on your computer.": '方法一（推荐，免费）：点下方按钮启用 Chrome 内置 AI，只需下载一次（约 2 GB），之后在你电脑上运行。',
    'Method 2: paste your own API key below. Google Gemini has a free tier; get a key at aistudio.google.com (no credit card needed).': '方法二：在下方填入你自己的 API key。Google Gemini 有免费额度，去 aistudio.google.com 领取（无需信用卡）。',
    "This computer can't run Chrome's built-in AI, so recognition needs an API key below. Google Gemini has a free tier; get one at aistudio.google.com (no credit card needed).": '这台电脑无法运行 Chrome 内置 AI，需要在下方填一个 API key 才能识别。Google Gemini 有免费额度，去 aistudio.google.com 领取（无需信用卡）。',
    'AI provider': 'AI 服务商',
    'Google Gemini (free tier)': 'Google Gemini（免费额度）',
    'AI source': 'AI 来源',
    "Keys are stored only on this computer and sent only to the selected provider's official API. The developer cannot see them.": 'API key 仅存储于本机，且仅用于调用所选服务商的官方接口，不会同步或提供给包括开发者在内的任何第三方。',
    'Download the on-device model first (use the button above)': '请先用上方的按钮下载本地模型',
    'Choose your AI provider below': '先在下方选择 AI 服务商',
    'Click "How to get an API key" for that provider\'s steps': '点「如何获取 API key」，查看这家的具体步骤',
    'Paste the key in the field and click Save': '把 key 粘贴到输入框，点保存',
    'the free trial ({n} of 30 left)': '免费体验额度（还剩 {n}/30 次）',
    'Free trial': '免费额度',
    'First 30 free': '前 30 次免费',
    'High quality': '高质量',
    'Basic quality': '效果较弱',
    'No setup at all, works the moment it installs.': '无需任何设置，装上就能用。',
    'Used {n}/30.': '已用 {n}/30 次。',
    'Your 30 free reads are used up': '30 次免费体验已用完',
    'Choose how to continue:': '请选择如何继续使用：',
    'Use your own API key (recommended, best quality)': '填入自己的API key（推荐，效果最好）',
    'Switch to the free on-device AI (basic quality, unlimited)': '改用本地免费AI（基础效果，不限次数）',
    'The key button opens Settings, with steps for each provider.': 'key 按钮会打开设置页，附各家key的获取步骤',
    'Free trial: {n} reads left': '免费体验还剩 {n} 次',
    'Google sign-in expired. Reconnect in Settings.': 'Google 登录已过期。请到设置页重新连接。',
    'The free service is busy. Wait a minute and try again.': '免费服务繁忙。请等一分钟再试。',
    'The free service had a problem. Try again in a moment.': '免费服务出了点问题。请稍后再试。',
    'Nothing to add was found on this page': '这个页面上没有找到可添加的内容',
    "Couldn't read this page": '页面读取失败',
    'Connect your Google account first (step above)': '请先连接你的 Google 账号（上方步骤）',
    'On-device model': '本地模型',
    'Free': '免费',
    'No key needed, runs on your computer. Weaker quality. One-time 2 GB download.': '无需 key，在你电脑上运行。能力较弱。需一次性下载约 2 GB。',
    'Your own API key': '自己的 API key',
    'Better quality': '质量更好',
    'Use a key from Gemini, Claude, OpenAI, or Kimi. Gemini has a free tier.': '使用 Gemini、Claude、OpenAI 或 Kimi 的 key。Gemini 有免费额度。',
    'How to get one?': '怎么获取？',
    'How to get an API key': '如何获取 API key',
    'Hide the steps': '收起步骤',
    'Uses Gemini Flash: fast, and free within the Gemini free tier.': '使用 Gemini Flash：速度快，在 Gemini 免费额度内不花钱。',
    'Uses Claude Haiku: the fastest Claude model, well under 1¢ per read.': '使用 Claude Haiku：Claude 家最快的模型，每次识别远低于 1 美分。',
    'Uses GPT-4o mini: fast and cheap, a fraction of a cent per read.': '使用 GPT-4o mini：快且便宜，每次识别不到 1 美分。',
    'Uses Kimi K2.6 with thinking off: fast, reads images, a fraction of a cent per read.': '使用 Kimi K2.6（关闭思考）：速度快，能识图，每次识别不到 1 分钱。',
    'Open aistudio.google.com/apikey': '打开 aistudio.google.com/apikey',
    'Sign in with your Google account': '用你的 Google 账号登录',
    'Click "Create API key", then "Create API key in new project"': '点「Create API key」，再点「Create API key in new project」',
    'Copy the key it shows (starts with AIza or AQ)': '复制它给出的那串 key（以 AIza 或 AQ 开头）',
    'Paste it in the field above and click Save': '粘贴到上方的输入框，点保存',
    'Open console.anthropic.com and sign in': '打开 console.anthropic.com 并登录',
    'Add credit under Billing (Anthropic has no free tier)': '在 Billing 里充值（Anthropic 没有免费额度）',
    'Go to API Keys and click "Create Key"': '进入 API Keys 页，点「Create Key」',
    'Copy the key that starts with sk-ant-': '复制以 sk-ant- 开头的那串 key',
    'Open platform.openai.com/api-keys and sign in': '打开 platform.openai.com/api-keys 并登录',
    'Add a payment method under Billing (OpenAI has no free tier)': '在 Billing 里绑定支付方式（OpenAI 没有免费额度）',
    'Click "Create new secret key"': '点「Create new secret key」',
    'Copy the key that starts with sk-, it is shown only once': '复制以 sk- 开头的那串 key，它只显示这一次',
    'Open platform.moonshot.cn, or platform.moonshot.ai outside mainland China': '打开 platform.moonshot.cn，国内以外用 platform.moonshot.ai',
    'Sign in and top up your balance': '登录并充值',
    'Go to API Keys and create a new key': '进入 API Keys 页，新建一个 key',
    'Copy the key': '复制这串 key',
    'Show': '显示',
    'Hide': '隐藏',
    'Test AI recognition': '测试 AI 识别',
    'Enter the API key for the selected provider first': '请先填写所选服务商的 API key',
    'Testing…': '测试中…',
    '✓ AI extraction works: “{t}” due {d}': '✓ AI 识别正常：“{t}”，截止 {d}',
    'AI returned no items for a sentence with an obvious deadline': 'AI 没能从一句明显带截止时间的话里识别出任何内容',
    'Test failed': '测试失败',
    'Google account': 'Google 账号',
    'Tasks and events are saved to the connected Google account.': '任务和日程会保存到已连接的 Google 账号。',
    '✓ Connected: {email}': '✓ 已连接：{email}',
    'Not connected': '未连接',
    'Connect Google account': '连接 Google 账号',
    'Connecting…': '正在连接…',
    'Disconnect': '断开连接',
    'Disconnecting…': '正在断开…',
    'Authorization failed': '授权失败',
    'checking…': '检查中…',
    'Step 1 of 4: Connect the Google account your tasks and events will be saved to.': '第 1 步（共 4 步）：连接你的 Google 账号，任务和日程将保存到这里。',
    'Step 2 of 4: Choose how recognition runs. Reading pages, screenshots, and text needs an AI model.': '第 2 步（共 4 步）：选择识别方式。读懂网页、截图和文字需要一个 AI 模型。',
    'Step 3 of 4: Pin Page2Task to your toolbar so it is always one click away.': '第 3 步（共 4 步）：把 Page2Task 固定到工具栏，以后一点就能用。',
    'Step 4 of 4: On any page with a date in it, click the icon and it becomes a to-do or an event.': '第 4 步（共 4 步）：在任何带时间的页面上点这个图标，它就会变成待办或日程。',
    'Back': '上一步',
    'Paste your API key first, or switch to the on-device model.': '请先粘贴 API key，或切换到本地模型。',
    'Next': '下一步',
    'Start using Page2Task': '开始使用 Page2Task',
    'All set! Close this page and click the Page2Task icon on any page.': '全部就绪！关闭本页，在任意网页点击 Page2Task 图标即可使用。',
    'Continue without connecting': '暂不连接，继续',
    'connected': '已连接',
    'Default event duration (minutes)': '默认日程时长（分钟）',
    'Save': '保存',
    'Saved ✓': '已保存 ✓',
  };

  let lang = 'en';

  function t(key, vars) {
    let s = (lang === 'zh' && ZH[key]) || key;
    if (vars) {
      for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    }
    return s;
  }

  // Translate everything marked in the static HTML, and keep the toggle's
  // label showing the language you would SWITCH TO (so it reads like a button)
  function apply() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.getAttribute('data-i18n'));
    for (const el of document.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.getAttribute('data-i18n-html'));
    for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.getAttribute('data-i18n-title'));
    const toggle = document.getElementById('langToggle');
    if (toggle) toggle.textContent = lang === 'zh' ? 'EN' : '中文';
  }

  async function init() {
    const cfg = await chrome.storage.sync.get({ uiLang: '' });
    lang = cfg.uiLang === 'zh' || cfg.uiLang === 'en'
      ? cfg.uiLang
      : (String(navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en');
    apply();
    return lang;
  }

  async function setLang(l) {
    lang = l === 'zh' ? 'zh' : 'en';
    await chrome.storage.sync.set({ uiLang: lang });
    apply();
  }

  root.I18n = {
    t,
    init,
    apply,
    setLang,
    toggle: () => setLang(lang === 'zh' ? 'en' : 'zh'),
    get lang() { return lang; },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
