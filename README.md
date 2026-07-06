# Page2Task

A Chrome extension that turns whatever you're looking at into a **Google Task** or a **Google Calendar event** — in one click.

## What it does

- **📧 Gmail messages** — reads the open email thread and extracts deadlines and appointments ("please submit by 3pm on July 10", "July 7th at 5pm @GSB Coupa sounds great!"), pre-filling the title, date, time and location;
- **🗂 Multiple deadlines** — if an email mentions several dates (fee tiers, staged deadlines), a picker appears so you choose the one you mean;
- **📺 Video pages** — reads the video length ("~23 min long") and sizes the calendar block to match;
- **📖 Articles** — estimates reading time from word count (English and CJK text counted separately);
- **🖼 Screenshots** — paste (⌘V) or drop a screenshot (a WeChat/Slack chat, a poster, an email) into the popup and the AI reads the to-do out of the image;
- **🔗 Any page** — select some text before clicking the extension and it analyzes the selection first;
- **📄 PDFs** — Chrome's PDF viewer hides the text from extensions, so Page2Task falls back to the file name as the title;
- **🗃 Task lists** — if your Google Tasks has several lists (Family, School work…), the AI suggests the best-fitting one and you can always override it;
- **👤 Account clarity** — the popup always shows which Google account it saves to; switch accounts anytime from Settings.

## How recognition works

Two modes, chosen automatically:

| Mode | Cost | What it does |
|---|---|---|
| **Local rules** (default) | Free, fully offline | chrono-based date parsing (English + Chinese) with deadline-keyword ranking |
| **AI** (optional, bring your own key) | Google Gemini has a free tier; Anthropic Claude costs under 1¢/run | Reads the full text or screenshot; writes proper task titles ("Submit Service Now ticket to cancel housing"), understands appointments, picks locations and task lists |

No key → no AI request is ever made. With a key, only the text/screenshot being analyzed is sent to the provider you chose.

## Install

1. **Clone** this repository (or download it as a ZIP and unzip);
2. **Create your manifest**: copy `manifest.template.json` to `manifest.json`;
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the project folder;
4. **Connect Google** (one-time, ~10 minutes): follow **[SETUP.md](SETUP.md)** (中文版: [SETUP.zh-CN.md](SETUP.zh-CN.md)) to register your own Google Cloud OAuth client and paste its client ID into your `manifest.json`;
5. *(Optional but recommended)* open the extension's **Settings** and add an AI key — Google Gemini keys are free at [aistudio.google.com](https://aistudio.google.com), no credit card needed.

> Why step 4? Each installation authenticates against **your own** (free) Google Cloud project, so nobody else's quota, keys or data are involved. `manifest.json` and `key.pem` are git-ignored on purpose — never commit them.

## Configuration (Settings page)

- **AI provider** — Google Gemini (free tier) or Anthropic Claude, with a key field for each;
- **Google account** — shows the connected account; **Disconnect** to re-pick on the next save;
- **Default event duration** — used when a calendar event has a time but no natural length.

## Privacy

Page content is analyzed locally in your browser. Text or screenshots are sent to an AI provider **only** if you configured a key. Tasks and events are written directly to Google's official APIs using an OAuth token that stays inside Chrome. Nothing is sent anywhere else; there is no backend.

## Project structure

| File | Purpose |
|---|---|
| `manifest.template.json` | Copy to `manifest.json`, then add your own OAuth client ID |
| `popup.html/css/js` | The main popup UI (candidates picker, form, actions) |
| `background.js` | Service worker — performs Google API writes so they survive the popup closing; job replay on interruption |
| `pageAnalyzer.js` | Injected page analyzer: email/video/article/PDF detection, duration estimates |
| `lib/dateparse.js` | Local rule-based date extraction (English + Chinese), multi-candidate |
| `lib/vendor/chrono.js` | Bundled [chrono-node](https://github.com/wanasit/chrono) date parser (MIT) |
| `lib/google.js` | Google Tasks / Calendar API wrapper (401/403 retry, task lists) |
| `lib/ai.js` | AI extraction: Gemini + Claude, text & vision, structured JSON output |
| `options.html/js` | Settings page |
| `test/` | Date-parser test suites — run `node test/dateparse.test.mjs` |

No build step, no framework, no npm install — vanilla JS throughout.

## Development

```bash
node test/dateparse.test.mjs        # 26 cases
node test/dateparse.extra.test.mjs  # 21 tougher cases
```

After editing, hit the reload icon on the extension card in `chrome://extensions`.

## Credits

- [chrono-node](https://github.com/wanasit/chrono) (MIT) — natural-language date parsing, bundled in `lib/vendor/`.

## License

[MIT](LICENSE)
