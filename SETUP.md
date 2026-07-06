# Google Setup Guide

One-time setup, roughly 10 minutes. This connects Page2Task to **your own** Google account through **your own** (free) Google Cloud project — no shared keys, no third parties.

## Step 1 — Load the extension

1. Copy `manifest.template.json` to `manifest.json` (skip if you already did);
2. Open `chrome://extensions`, turn on **Developer mode** (top right);
3. Click **Load unpacked** and select this project folder;
4. Note the **ID** shown on the Page2Task card (a 32-letter string) — you'll need it in Step 2.

> ⚠️ The ID is derived from the folder path. If you later **move or rename the folder, the ID changes** and your OAuth client stops matching. Either keep the folder where it is, or pin the ID permanently (see *Pinning your extension ID* below).

## Step 2 — Register the extension with Google

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in with the Google account whose Tasks/Calendar you want to write to;
2. Project picker (top bar) → **New project** → any name (e.g. `Page2Task`) → **Create**, then switch to it;
3. Enable two APIs — search in the top bar for:
   - **Google Tasks API** → open → **Enable**;
   - **Google Calendar API** → open → **Enable**;
4. Configure the consent screen:
   - Menu → **APIs & Services** → **OAuth consent screen** (redirects to the new **Google Auth Platform** page);
   - First visit shows a **Get started** wizard: app name (anything), your email as support email, **Audience → External**, agree, **Create**;
   - Then open **Audience** in the left menu, scroll to **Test users**, click **+ Add users**, and add **your own Google email** (skipping this makes Google reject the authorization later);
5. Create the credential:
   - **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID** (or, from Google Auth Platform, **Clients** → **Create client** — same thing);
   - Application type: **Chrome Extension**;
   - Item ID: paste the extension ID from Step 1;
   - **Create**, then copy the generated **Client ID** (ends with `.apps.googleusercontent.com`).

## Step 3 — Put the client ID into the extension

Open `manifest.json` in any text editor and replace

```
"client_id": "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
```

with your real client ID (keep the quotes). Save.

## Step 4 — Reload and authorize

1. Back in `chrome://extensions`, hit the reload icon ⟳ on the Page2Task card;
2. Open any web page, click the Page2Task icon (pin it via the puzzle-piece menu);
3. Click **✓ Set Todo** — a Google authorization window appears once:
   - **The account you pick here is the account everything gets saved to** (it must be in your Test users list);
   - If you see *"Google hasn't verified this app"*, that's expected for a personal app — click **Continue** (sometimes under *Advanced*);
   - Approve **all** requested permissions;
4. The first item is usually saved in the background even if the popup closed — check [tasks.google.com](https://tasks.google.com); if it's not there, click once more.

Done. The popup footer now shows `Saving to Google account: …` so there's never any doubt where things go.

---

## Pinning your extension ID (optional, recommended)

Generating a `key.pem` fixes the extension ID forever (surviving folder moves), so your OAuth client never breaks. In the project folder:

```bash
openssl genrsa -out key.pem 2048
# The value for the "key" field in manifest.json:
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | base64 | tr -d '\n'
# The resulting extension ID (use this in Step 2):
openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | shasum -a 256 | cut -c1-32 | tr '0-9a-f' 'a-p'
```

Add `"key": "<the base64 string>"` to your `manifest.json`, reload the extension, and use the printed ID in Step 2. Keep `key.pem` private — it is git-ignored for a reason.

## FAQ

**"Google authorization failed"?** Check: ① Chrome is signed into a Google account; ② your email is in **Test users**; ③ the client ID was pasted completely.

**Is the "unverified app" warning safe?** Yes — it's your own private app in your own Cloud project. Google's verification process targets publicly distributed apps.

**Tasks/events land in the wrong account?** They go to the account picked during authorization. Settings → **Disconnect Google account**, then save again and pick the right one (add it as a test user first if needed).

**Moving to a new computer?** Copy the whole folder (including your `manifest.json`, and `key.pem` if you pinned the ID), then repeat Steps 1 and 4.
