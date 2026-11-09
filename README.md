# County Hub

A complete community website for an **Emergency Response: Liberty County** private server.
It replaces Discord *and* Melonly: built-in real-time chat, departments with rosters, shift
tracking, punishment logs, live server data from the ER:LC API, applications, sessions, a
CAD/dispatch board, and a customizable dashboard — all behind **Roblox login**.

This guide assumes you have **never built a website before**. Follow it top to bottom.
Total time for first run: about 30–45 minutes.

---

## Table of contents

1. [What you'll end up with](#1-what-youll-end-up-with)
2. [Install the tools (one time)](#2-install-the-tools-one-time)
3. [Open the project and install its packages](#3-open-the-project-and-install-its-packages)
4. [Create your free Supabase project (the database)](#4-create-your-free-supabase-project-the-database)
5. [Create your settings file (`.env.local`)](#5-create-your-settings-file-envlocal)
6. [Create the database tables](#6-create-the-database-tables)
7. [Run the website for the first time](#7-run-the-website-for-the-first-time)
8. [Connect your ER:LC server](#8-connect-your-erlc-server)
9. [Turn on real Roblox login](#9-turn-on-real-roblox-login)
10. [Put it on the internet (Vercel)](#10-put-it-on-the-internet-vercel)
11. [Roles — who can do what](#11-roles--who-can-do-what)
12. [Tour of the code](#12-tour-of-the-code)
13. [Troubleshooting](#13-troubleshooting)
14. [Ideas for what to build next](#14-ideas-for-what-to-build-next)

---

## 1. What you'll end up with

| Area | What it does |
|---|---|
| **Dashboard** | Drag-to-reorder widgets: live server status (players, join code, queue, team split), quick actions, staff-activity chart, department chart, who's on duty, live game events, recent punishments, latest messages, sessions. Layout is saved per user. `Ctrl+K` opens a command palette to jump anywhere. |
| **Messages** | Real-time channels grouped in categories, department-only channels, staff-only channels, announcement channels (staff post only), direct messages, @mentions with autocomplete, reactions, replies, pins, edit/delete, image & file attachments, link embeds, unread badges, full-text search. |
| **Departments** | Unlimited departments (Police, Fire/EMS, DOT, Civilian… pre-made). Rosters with ranks, callsigns and status (Active / LOA / Inactive / Suspended). Department leaders manage their own roster, ranks and channels. Per-department weekly leaderboard and quota. |
| **Staff tools** | Clock in / out with breaks (live timer in the top bar), shift history, punishment logs (warn/kick/ban/note/BOLO) with per-player history, live player list from ER:LC with one-click kick/ban/PM, in-game command console, live event feed with history, staff leaderboard with quota tracking. |
| **Community** | Application forms (build your own questions, review queue, auto-add to roster on accept), sessions (schedule/start/end, announces to chat) with polls, CAD/dispatch board (anyone reports, responders attach, live updates), member directory and profiles. |
| **Settings** | Community name, ER:LC API key (with "Test connection"), Roblox group requirement, weekly quota, who can see the join code, role management, ownership transfer, config health check, audit log. |

**Tech:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui-style components ·
Supabase (Postgres + Auth + Realtime + Storage) · Roblox OAuth 2.0 · ER:LC Private Server API (`api.erlc.gg`) · Recharts.

---

## 2. Install the tools (one time)

You need two free programs on your computer.

### 2a. Node.js (runs the website)

1. Go to <https://nodejs.org>.
2. Click the big green **LTS** button (LTS = the stable version). Download and run the installer.
   Click **Next** through everything; the defaults are fine.
3. **Check it worked:** open a terminal:
   - **Windows:** press the Windows key, type `powershell`, press Enter.
   - **Mac:** press `Cmd+Space`, type `terminal`, press Enter.

   Type this and press Enter:
   ```
   node -v
   ```
   You should see something like `v22.11.0`. Any version **20 or higher** is fine.
   If you see "not recognized" / "command not found", restart your computer and try again.

### 2b. Visual Studio Code (for editing files) — optional but recommended

1. Go to <https://code.visualstudio.com> and install it.
2. Later, you'll open the project folder in it with **File → Open Folder**.

---

## 3. Open the project and install its packages

1. Unzip `erlc-hub.zip` somewhere you'll find it again, e.g. your **Documents** folder.
   You should now have a folder called `erlc-hub` containing files like `package.json`.
2. Open a terminal **inside that folder**:
   - **Windows:** open the `erlc-hub` folder in File Explorer, click in the address bar at the top,
     type `powershell` and press Enter.
   - **Mac:** right-click the `erlc-hub` folder → **New Terminal at Folder**
     (or open Terminal and type `cd ` (with a space) then drag the folder into the window, press Enter).
3. Type this and press Enter. It downloads everything the project needs (takes 1–3 minutes):
   ```
   npm install
   ```
   Lots of text will scroll by. Warnings about "vulnerabilities" or "funding" are normal — ignore them.
   It's done when you get your prompt back without a red `ERR!`.

> **Keep this terminal open.** You'll use it again in step 7.

---

## 4. Create your free Supabase project (the database)

Supabase stores everything: users, messages, shifts, logs. The free plan is plenty for a community.

1. Go to <https://supabase.com> → **Start your project** → sign up (GitHub or email).
2. Click **New project**.
   - **Name:** anything, e.g. `erlc-hub`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe** (you rarely need it, but keep it).
   - **Region:** pick the one closest to most of your members.
   - Click **Create new project**. Wait ~2 minutes while the green bar fills.
3. In the left sidebar click the **gear icon (Project Settings)** → **API** (or **API Keys**, depending on how new your project is).
   Keep this page open — you'll copy three things from it in the next step:
   - **Project URL** — looks like `https://abcdefghijklmnop.supabase.co`
   - **anon public** key *(newer projects call it the **publishable** key, starts with `sb_publishable_`)*
   - **service_role** key *(newer projects call it the **secret** key, starts with `sb_secret_`)* — click **Reveal** to see it.
     **Never share this one or paste it anywhere public.** It bypasses all security rules.

---

## 5. Create your settings file (`.env.local`)

The website reads its secrets from a file called `.env.local` that you create. It is never uploaded anywhere.

1. In the `erlc-hub` folder, find the file **`.env.example`**.
2. Make a copy of it and name the copy **`.env.local`** (yes, starting with a dot).
   - **Windows:** if you can't see file extensions, in File Explorer click **View → Show → File name extensions** first.
     Right-click `.env.example` → **Copy**, then **Paste**, then rename `.env - Copy.example` to `.env.local`.
   - **Mac:** in Finder, select `.env.example`, press `Cmd+D` to duplicate, rename to `.env.local`.
     (Files starting with a dot are hidden; press `Cmd+Shift+.` to show them.)
   - **Easiest:** open the folder in VS Code, right-click `.env.example` → **Copy**, right-click empty space → **Paste**, rename.
3. Open `.env.local` in VS Code (or Notepad / TextEdit) and fill in the Supabase values from step 4:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-the-anon-or-publishable-key-here
   SUPABASE_SERVICE_ROLE_KEY=paste-the-service_role-or-secret-key-here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   DEV_LOGIN_ENABLED=true
   ```
   Leave `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET` and `ERLC_API_KEY` empty for now.
   No spaces around the `=` signs. No quotes needed.
4. Save the file.

---

## 6. Create the database tables

One SQL file sets up every table, security rule, starter channel and starter department.

1. In Supabase, click **SQL Editor** in the left sidebar → **New query** (a blank text box appears).
2. On your computer open the file **`supabase/migrations/0001_init.sql`** (inside the `erlc-hub` folder)
   in VS Code or Notepad. Select **everything** (`Ctrl+A` / `Cmd+A`) and copy it (`Ctrl+C` / `Cmd+C`).
3. Paste it into the Supabase SQL box and click **Run** (bottom right, or `Ctrl+Enter`).
4. After a few seconds you should see **"Success. No rows returned"**. 🎉
   If you see a red error, see [Troubleshooting](#13-troubleshooting).
5. **Check:** click **Table Editor** in the sidebar. You should see tables like `profiles`, `channels`,
   `messages`, `departments`, `shifts`, `punishments`.

> You only ever run this once per Supabase project.

---

## 7. Run the website for the first time

1. Back in your terminal (still inside the `erlc-hub` folder), type:
   ```
   npm run dev
   ```
2. Wait until you see `✓ Ready` and a line like `Local: http://localhost:3000`.
3. Open your web browser and go to **<http://localhost:3000>**.
4. You'll see the sign-in page. Because Roblox login isn't set up yet, use the **Developer login** box:
   type any username (e.g. your Roblox name) and click **Sign in as test user**.

   **The very first account created becomes the Owner automatically.** Make that one yours!
5. You're in! Explore the dashboard, click **Messages** and say hello in `#general`, open **Departments**.

To stop the website, go to the terminal and press `Ctrl+C`. To start it again: `npm run dev`.

**Tip — invite a second test user:** open a *private/incognito* browser window, go to
`http://localhost:3000`, and sign in with a different username. Open the same channel in both
windows and watch messages appear instantly in the other one — that's Supabase Realtime working.

---

## 8. Connect your ER:LC server

This unlocks the live server widget, live players, in-game commands and the event feed.
Your private server needs the **ER:LC API server pack** (bought in-game).

1. Join your private server in Roblox. Open **Server Settings → ER:LC API** and copy the key.
   (Older UI: server icon top-right → Edit Server Settings → scroll to ER:LC API → Edit → copy.)
2. On the website, go to **Settings** (bottom of the sidebar — admins only) → paste the key in
   **ER:LC Private Server API** → click **Test connection**. You should see your server's name.
3. Click **Save settings**. The dashboard's **Live server** widget starts updating every 15 seconds.

Treat the key like a password — anyone with it can run commands on your server. The site only
ever uses it on the server side and never sends it to browsers.

---

## 9. Turn on real Roblox login

Do this before inviting members. Roblox OAuth proves each person owns their Roblox account.

1. Go to <https://create.roblox.com/dashboard/credentials> and sign in with the Roblox account that
   will own the app (it must be at least 13+ and ID-verified in Roblox settings for OAuth apps).
2. Open the **OAuth 2.0 Apps** tab → **Create App**.
   - **Name / description / logo:** your community name etc. (members see this on the consent screen)
   - Accept the terms → **Create**.
3. You are shown a **Client ID** and **Client Secret**. **Copy both now** — the secret is shown only once.
4. Click into the app → **Permissions**: tick **openid** and **profile**. Save.
5. **Redirect URLs:** add exactly
   ```
   http://localhost:3000/api/auth/roblox/callback
   ```
   (Later, when the site is online, add `https://your-domain.com/api/auth/roblox/callback` too.)
   Save.
6. In `.env.local` fill in:
   ```
   ROBLOX_CLIENT_ID=paste-client-id
   ROBLOX_CLIENT_SECRET=paste-client-secret
   ```
7. Restart the website (`Ctrl+C` in the terminal, then `npm run dev` again). The **Continue with Roblox**
   button now works.
8. **Link your Owner account to your real Roblox account:** the dev account and your Roblox account are
   different accounts. Easiest path: sign out, sign in with Roblox, then from your *dev* Owner account go to
   **Settings → Roles** and click **Make owner** on your Roblox account. Then set `DEV_LOGIN_ENABLED=false`.
9. **Optional — require your Roblox group:** Settings → Roblox verification → enter your group ID
   (the number in your group's URL) and switch on **Require group membership**.

> Roblox may limit new OAuth apps to a small number of users until the app is reviewed. If members
> get an error about the app not being available, submit the app for review in the Creator Dashboard.

---

## 10. Put it on the internet (Vercel)

Right now the site only runs on your computer. Vercel hosts Next.js sites for free.

1. **Put the code on GitHub.**
   - Create a free account at <https://github.com>, click **New repository**, name it `erlc-hub`, keep it **Private**, create.
   - Install **GitHub Desktop** (<https://desktop.github.com>), sign in, **File → Add local repository** → choose your `erlc-hub` folder → **Publish repository**.
   - `.env.local` is automatically excluded (it's in `.gitignore`), so your secrets are safe.
2. **Deploy on Vercel.**
   - Go to <https://vercel.com>, sign up with GitHub, click **Add New → Project**, pick `erlc-hub`.
   - Before clicking Deploy, open **Environment Variables** and add every line from your `.env.local`
     (name on the left, value on the right), but change these two:
     - `NEXT_PUBLIC_APP_URL` → your Vercel address, e.g. `https://erlc-hub.vercel.app` (you can edit this after the first deploy once you know it)
     - `DEV_LOGIN_ENABLED` → `false`
   - Click **Deploy**. In ~2 minutes you get a live URL.
3. **Tell Roblox about the new address:** in your Roblox OAuth app add the redirect URL
   `https://YOUR-VERCEL-URL/api/auth/roblox/callback`.
4. Share the URL with your community. Every time you push changes to GitHub, Vercel redeploys automatically.

**Custom domain:** in Vercel → Project → Settings → Domains. Update `NEXT_PUBLIC_APP_URL` and the Roblox redirect URL to match.

---

## 11. Roles — who can do what

| Role | Can do |
|---|---|
| **Owner** | Everything, plus transfer ownership. Exactly one. The first account ever created. |
| **Admin** | Settings, ER:LC key, departments, channels, roles, all logs, delete things. |
| **Staff** | Shifts, punishments, live players, run commands, event feed, pin messages, post announcements, review applications, manage sessions. |
| **Department Leader** | Manage *their* department: roster, ranks, callsigns, status, department channels & application forms. |
| **Member** | Chat, DM, view departments & members, apply, vote in polls, create CAD calls, respond to calls. |

Change roles at **Settings → Roles**. Security is enforced in the **database** (Row Level Security),
not just hidden in the UI, so a member can't see staff channels even by guessing the URL.

Channel visibility: public channels can require a minimum role (e.g. `#staff-chat` is Staff+),
department channels are only visible to that department's roster, private channels only to invited members.

---

## 12. Tour of the code

```
erlc-hub/
├── .env.example                 ← template for your secrets
├── supabase/migrations/
│   └── 0001_init.sql            ← THE database: tables, security rules, realtime, seed data
├── src/
│   ├── proxy.ts                 ← runs on every request: refreshes login, blocks logged-out users
│   ├── app/                     ← pages (folder name = URL)
│   │   ├── login/               ← sign-in page
│   │   ├── setup/               ← friendly checklist shown until Supabase is configured
│   │   ├── api/auth/roblox/     ← Roblox OAuth start + callback
│   │   ├── api/auth/dev/        ← developer login (local only)
│   │   ├── api/erlc/            ← status / command / logs endpoints that talk to api.erlc.gg
│   │   └── (app)/               ← everything behind login (shares the sidebar layout)
│   │       ├── dashboard/  messages/  departments/  members/
│   │       ├── staff/{shifts,punishments,players,events,leaderboard}/
│   │       ├── applications/  sessions/  cad/  settings/
│   │       └── layout.tsx       ← sidebar + top bar wrapper
│   ├── components/
│   │   ├── ui/                  ← buttons, cards, dialogs… (shadcn/ui style)
│   │   ├── layout/              ← sidebar, topbar, command palette, shift controls
│   │   ├── dashboard/           ← widget grid + each widget
│   │   ├── chat/                ← channel sidebar, chat room, composer, message rendering
│   │   ├── departments/ staff/ settings/ members/ applications/ sessions/ cad/
│   │   └── charts/              ← shared Recharts tooltip + colours
│   ├── lib/
│   │   ├── env.ts               ← reads .env.local safely
│   │   ├── supabase/            ← browser client, server client, admin client, proxy helper
│   │   ├── auth/                ← current user helpers + the Roblox→Supabase session bridge
│   │   ├── roblox/oauth.ts      ← PKCE, token exchange, userinfo, group check
│   │   ├── erlc/                ← typed ER:LC API client, event sync
│   │   ├── data/                ← server-side data loaders per page
│   │   ├── permissions.ts       ← role hierarchy helpers
│   │   └── types/database.ts    ← TypeScript types matching the SQL schema
│   └── server/actions/          ← "use server" functions the UI calls to change data
└── README.md                    ← you are here
```

**How login works (the clever bit):** Supabase Auth has no Roblox provider, so after Roblox confirms
who you are, the server creates/updates a Supabase user keyed by your Roblox ID, mints a one-time
magic-link token with the service-role key and immediately redeems it. Result: a normal Supabase
session cookie, so Row Level Security and Realtime "just work". See `src/lib/auth/create-session.ts`.

**How live chat works:** `supabase/migrations/0001_init.sql` adds `messages` to the realtime
publication. `src/components/chat/chat-room.tsx` subscribes to inserts/updates/deletes for the open
channel and patches the list in place. Your own messages appear instantly (optimistic) and de-duplicate
when the realtime echo arrives.

**How ER:LC data flows:** browser → `/api/erlc/status` (checks your role) → `src/lib/erlc/client.ts`
(adds the `server-key` header, caches for 8 s to respect rate limits) → `https://api.erlc.gg/v2/server`.
Logs are copied into the `game_events` table so the event feed keeps history.

### Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the site locally at <http://localhost:3000> (auto-reloads on edits) |
| `npm run build` | Check everything compiles for production |
| `npm start` | Run the production build locally |
| `npm run lint` | Check code style |

---

## 13. Troubleshooting

**The browser shows the "first-time setup" checklist**
→ `.env.local` is missing or a value is wrong. Check the file name is exactly `.env.local`, it sits next to
`package.json`, and restart `npm run dev`. Visit <http://localhost:3000/api/health> to see what the server can read.

**SQL error when running the migration: `type "app_role" already exists`**
→ You ran it twice. That's fine — the tables already exist. If you want a clean slate: Supabase →
SQL Editor → run `drop schema public cascade; create schema public;` **(deletes all your data)** then run the migration again.

**"Dev login is disabled"** → set `DEV_LOGIN_ENABLED=true` in `.env.local` and restart.

**Dev login says `SUPABASE_SERVICE_ROLE_KEY is not set`** → copy the *service_role / secret* key (not the anon key) into `.env.local`.

**Dev login says something about "email" or "invalid"** → In Supabase go to **Authentication → Providers → Email** and make sure **Enable Email provider** is on (it is by default). No emails are ever sent; the app only uses it internally.

**Messages don't appear live in the other window** → In Supabase go to **Database → Publications** and
confirm `supabase_realtime` lists `messages`. The migration does this; if the table is missing, run:
`alter publication supabase_realtime add table public.messages;`

**Live server widget says "ER:LC rejected the API key"** → the key was copied wrong or regenerated in-game. Copy it again. The API requires the ER:LC API server pack.

**Roblox login: `redirect_uri mismatch`** → the Redirect URL in the Roblox app must be *exactly*
`NEXT_PUBLIC_APP_URL` + `/api/auth/roblox/callback`, including `http`/`https` and no trailing slash.

**Images in chat don't upload** → Supabase → **Storage** → confirm a bucket named `attachments` exists (the migration creates it). If not, create it as a **public** bucket.

**`npm install` fails with EACCES / permission errors (Mac)** → run `sudo chown -R $(whoami) ~/.npm` then try again.

**Port 3000 is already in use** → run `npm run dev -- -p 3001` and use <http://localhost:3001> (also update `NEXT_PUBLIC_APP_URL`).

---

## 14. Ideas for what to build next

The foundation is solid; these are natural next steps, roughly in order of value:

1. **Push/browser notifications** for mentions and DMs (Web Push + a `notifications` table).
2. **Typing indicators & online presence** using Supabase Realtime *presence* channels.
3. **Automatic shift logging from the API** — start/stop shifts when a staff member joins/leaves the server (match Roblox IDs in `game_events`).
4. **ER:LC event webhooks** — the API offers webhooks for instant events instead of polling.
5. **Voice channels** via LiveKit or Daily (both have free tiers).
6. **Mobile layout polish** — the chat and dashboard work on tablets; phones could use a bottom nav.
7. **Infinite scroll** in chat (load older than the last 50 messages).
8. **Scheduled reports** — weekly quota summaries posted to `#staff-chat` via a Supabase cron job.

---

*Not affiliated with Police Roleplay Community or Roblox. ER:LC API docs: <https://apidocs.erlc.gg> · Roblox OAuth docs: <https://create.roblox.com/docs/cloud/auth/oauth2-overview>*
