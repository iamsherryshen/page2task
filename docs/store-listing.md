# Chrome Web Store listing — copy-paste sheet

Everything below is ready to paste into the Chrome Web Store Developer Dashboard.
(This file is for our own use; it ships in the repo but not in the extension zip.)

## Store listing tab

**Name**
```
Page2Task
```

**Summary** (132 chars max)
```
Turn any page, email, or screenshot into a Google Task or Calendar event — deadlines detected automatically, free on-device AI.
```

**Description**
```
Page2Task turns whatever you're looking at into a to-do or calendar event in two clicks.

HOW IT WORKS
1. Open a page, an email, or paste a screenshot / any text into the popup.
2. Page2Task finds the deadline, title, and location for you.
3. Pick To-do, Calendar, or Both — done. It's saved to your own Google account.

WHAT IT READS
• Web pages and articles — the title becomes your task
• Gmail — reads the open email thread and finds the real deadline, even when it's buried in an earlier message
• Screenshots — paste (Cmd+V) a screenshot of a chat, poster, or form
• Any pasted text — a message, an invite, an email draft

SMART DETAILS
• Detects meeting locations and writes them into the Calendar event's location field
• Suggests the right Google Tasks list based on content
• Start/end times for events; date-only for to-dos
• Works in English and Chinese

PRIVATE BY DESIGN
• Free AI runs on your own computer (Chrome's built-in AI) — no account, no API key, nothing leaves your device
• Optionally plug in your own Gemini or Claude API key
• No developer servers, no analytics, no tracking — your data goes only to your own Google account
• Open source: https://github.com/USERNAME/page2task
```

**Category**: Productivity → Workflow & Planning

**Language**: English

## Privacy tab

**Single purpose description**
```
Convert the page, email, screenshot, or text the user provides into a Google Tasks to-do or Google Calendar event in the user's own Google account.
```

**Permission justifications**

- `identity`:
```
Used for Google sign-in so the extension can create tasks and calendar events in the user's own Google account, and show which account is connected.
```
- `activeTab`:
```
Used to read the title, URL, and visible text of the page the user is on — only at the moment the user clicks the extension — so a task title and deadline can be suggested.
```
- `scripting`:
```
Used to run a small read-only analysis function in the current tab (page title, text, video length) when the user opens the popup. No content is injected or modified.
```
- `storage`:
```
Stores the user's settings: preferred mode, default event length, last-used task list, and optional AI API keys.
```
- Host `tasks.googleapis.com`, `www.googleapis.com`, `accounts.google.com`, `openidconnect.googleapis.com`:
```
Official Google endpoints used to create the user's tasks and calendar events, list their task lists, and complete Google sign-in.
```
- Host `generativelanguage.googleapis.com`, `api.anthropic.com`:
```
Optional: only contacted if the user enters their own Gemini or Claude API key in Settings, to extract deadlines from the text/screenshot the user submits. Never contacted otherwise.
```

**Remote code**: No, I am not using remote code. (All code ships in the package; the AI endpoints receive data, not code.)

**Data usage disclosures** — check exactly these:
- ✅ Website content (page title/text, read on user action, processed locally or by the user's chosen AI)
- ✅ Personal communications (the open Gmail thread, same handling)
- ✅ Authentication information (Google OAuth token, kept by Chrome, used only for Google APIs)
- Then certify: data is NOT sold, NOT used for unrelated purposes, NOT used for creditworthiness.

**Privacy policy URL**
```
https://USERNAME.github.io/page2task/privacy.html
```

## Assets needed at submission

- Icon 128×128 — already in the package (`icons/icon128.png`)
- ≥1 screenshot, 1280×800 (or 640×400): open the real popup on a Gmail message, Cmd+Shift+4 a clean shot, we'll pad it to size together
- (Optional, can skip) small promo tile 440×280

## After upload — one thing to verify

The zip keeps the `key` field in manifest.json so the store item should get our existing
extension ID `kmcfginenglmmeeoiekoklnhpahcgeea` (which the Google OAuth client is bound to).
After the first upload, check the item ID in the dashboard:
- Same ID → nothing to do.
- Different ID → in Google Cloud Console, edit the OAuth client's "Item ID" to the new store ID
  (and afterwards adopt the store key into local manifest.json for development).
