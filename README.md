# Page2Task

A Chrome extension that turns whatever you're looking at into a **Google Task** or a **Google Calendar event**.

Open a page, an email, or paste a screenshot. Page2Task finds the deadline, title, and location, and saves it to your own Google account.

## Install (about 2 minutes)

1. **[Download the latest release](../../releases/latest)** and unzip it (or clone this repo).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (toggle, top right).
4. Click **Load unpacked** and select the unzipped `page2task` folder.

That's it. Click the Page2Task icon in your toolbar to use it.

The first time you save something, Google asks you to authorize the extension.
Because this extension is distributed outside the Chrome Web Store, Google shows a
**"Google hasn't verified this app"** screen — click **Advanced → Continue** to proceed.
Page2Task only ever writes to *your* Google Tasks and Calendar; there is no server behind it.

> **Keep the folder.** Chrome loads an unpacked extension from where it sits, so don't
> delete or move the folder after installing. To update later, download the new release
> and replace the folder's contents, then hit the reload icon on `chrome://extensions`.

## What it does

- **Gmail** — reads the whole open thread and pulls out deadlines and appointments, even when the date is buried in an earlier message
- **Any web page** — event pages, forms, syllabi: the visible text is read and the deadlines extracted
- **Screenshots** — paste one with ⌘V (a chat, a poster, a form) and the AI reads the to-do out of the image
- **Pasted text** — drop in any message or invite and it gets parsed
- **Several deadlines at once** — every deadline found gets a checkbox; tick the ones you want and each becomes its own task or event, with its own date, time, location, and task list
- **To-do / Calendar / Both** — pick at the top; the form shows only the fields that mode needs
- **Locations** go into the calendar event's real location field, not the notes
- **Task lists** — the AI suggests which of your Google Tasks lists each item belongs in; you can change it per item
- **Videos** — reads the video's real length and sizes the calendar block to match

## AI recognition (optional)

Page2Task works with no setup at all: built-in rules detect dates locally, offline and free.

For better titles and screenshot reading, it uses AI when available, in this order:

| Tier | Cost | Setup |
|---|---|---|
| **Chrome's built-in AI** (Gemini Nano) | Free | None, if your Chrome already has the model. Otherwise the popup offers a one-time ~2 GB download; the model runs entirely on your computer and nothing leaves the device |
| **Your own API key** | Google Gemini has a free tier; Claude, OpenAI, Kimi, and DeepSeek are pay per use, well under 1¢ per run | Paste a key in Settings |
| **Local rules** | Free | Always available as the fallback |

**API keys are stored only on the computer you type them on** (never synced to your
Google account) and are sent only to the provider they belong to. The developer never
sees them, and there is no backend to send them to.

## Privacy

- No servers, no analytics, no tracking. See the [privacy policy](docs/privacy.html).
- Page content is read only when you click the extension icon.
- Tasks and events go directly from your browser to Google's official APIs.
- Text or screenshots reach an AI provider **only** if you configured a key; with Chrome's built-in AI, nothing leaves your computer at all.

## Settings

- **AI provider** — the free on-device model, or Gemini, Claude, OpenAI, Kimi, or DeepSeek with a key field for each, plus a test button
- **Google account** — shows the connected account; **Disconnect** to switch
- **Default event duration** — used when an event has a start time but no natural length

## For developers

No build step, no framework, no npm install — vanilla JS throughout.

```bash
node --test test/*.test.mjs
```

After editing, hit the reload icon on the extension card in `chrome://extensions`.

| File | Purpose |
|---|---|
| `popup.html/css/js` | The popup: mode switch, import zone, candidate checkboxes, per-item cards |
| `background.js` | Service worker: Google API writes survive the popup closing, with job replay |
| `pageAnalyzer.js` | Injected page analyzer: email / video / article / PDF detection, page text |
| `lib/dateparse.js` | Local rule-based date extraction (English + Chinese), multi-candidate |
| `lib/vendor/chrono.js` | Bundled [chrono-node](https://github.com/wanasit/chrono) date parser (MIT) |
| `lib/google.js` | Google Tasks / Calendar API wrapper |
| `lib/ai.js` | AI extraction: built-in Gemini Nano, Gemini, Claude, OpenAI, Kimi, DeepSeek; text & vision |
| `options.html/js` | Settings page |

Forking with your own Google Cloud project? Copy `manifest.template.json` over
`manifest.json` and follow **[SETUP.md](SETUP.md)** (中文: [SETUP.zh-CN.md](SETUP.zh-CN.md)).

## Credits

- [chrono-node](https://github.com/wanasit/chrono) (MIT) — natural-language date parsing.

## License

[MIT](LICENSE)
