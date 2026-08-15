# Chrome Web Store listing: copy-paste sheet

Everything below is ready to paste into the Chrome Web Store Developer Dashboard.
(This file is for our own use; it ships in the repo but not in the extension zip.)

## Store listing tab

**Name**
```
Page2Task
```

**Summary** (132 chars max)
```
Turn any page, email, or screenshot into a Google Task or Calendar event, with deadlines and locations detected for you.
```

**Description**
```
Page2Task adds any page, email, screenshot, or video straight to your Google Calendar or Google Tasks.

HOW IT WORKS
1. Click the Page2Task icon on whatever you are looking at, or paste a screenshot or text.
2. It finds the deadline, title, and location for you.
3. One click saves it to Google Tasks, Google Calendar, or both.

WHAT IT READS
• Web pages and articles: the title becomes your task
• Emails: reads the open email and finds the real deadline, even when it's buried in an earlier message
• Video pages: the video becomes a calendar block with its real length
• Screenshots: paste (Cmd+V) a screenshot of a chat, poster, or form
• Any pasted text: a message, an invite, an email draft

SMART DETAILS
• Detects meeting locations and writes them into the Calendar event's location field
• Suggests the right Google Tasks list based on content
• Start/end times for events; date-only for to-dos
• Works in English and Chinese; interface in both languages, one-click switch

PRIVATE BY DESIGN
• Free AI runs on your own computer (Chrome's built-in AI): no account, no API key, and nothing you analyze leaves your device
• Optionally plug in your own Gemini, Claude, OpenAI, or Kimi API key
• No developer servers, no analytics, no tracking: your data goes only to your own Google account
• Open source: https://github.com/iamsherryshen/page2task
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
Used to read the title, URL, and visible text of the page the user is on, only at the moment the user clicks the extension, so a task title and deadline can be suggested.
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
- Host `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.openai.com`, `api.moonshot.cn`, `api.moonshot.ai`:
```
Optional: only contacted if the user enters their own Gemini, Claude, OpenAI, or Kimi (Moonshot) API key in Settings, to extract deadlines from the text/screenshot the user submits. Never contacted otherwise.
```

**Remote code**: No, I am not using remote code. (All code ships in the package; the AI endpoints receive data, not code.)

**Data usage disclosures**, check exactly these:
- ✅ Website content (page title/text, read on user action, processed locally or by the user's chosen AI)
- ✅ Personal communications (the open Gmail thread, same handling)
- ✅ Authentication information (Google OAuth token, kept by Chrome, used only for Google APIs)
- Then certify: data is NOT sold, NOT used for unrelated purposes, NOT used for creditworthiness.

**Privacy policy URL**
```
https://page2task.sherryshen.world/privacy.html
```

## Assets needed at submission

- Icon 128×128, already in the package (`icons/icon128.png`)
- ≥1 screenshot, 1280×800 (or 640×400): open the real popup on a Gmail message, Cmd+Shift+4 a clean shot, we'll pad it to size together
- (Optional, can skip) small promo tile 440×280

## Extension ID and OAuth: the one tricky step (confirmed against Chrome docs, Aug 2026)

The uploaded zip must NOT contain the manifest `key` field: the store rejects brand-new
items that have one ("key field not allowed in manifest"). So the store WILL assign a new
extension ID, different from the local dev ID `kmcfginenglmmeeoiekoklnhpahcgeea` that the
current Google OAuth client is bound to. The packaged zip in dist/ is already built
without the key.

Do this once, right after the first upload (keep it an unpublished draft):
1. Dashboard → the item → Package tab → "View public key" → copy the key text.
2. Paste it into the LOCAL manifest.json `key` field, replacing the old value. Local dev
   now runs under the same ID as the store item. (The old local install's storage resets
   and Google auth breaks until step 3 — expected, one-time.)
3. Google Cloud Console → Credentials → the "Chrome Extension" OAuth client → change its
   Item ID to the new store ID. If the console forces a new client instead, create one
   and put the new client_id into manifest.json `oauth2.client_id`.
4. Rebuild the zip (still without `key`), upload as an update, then publish.
