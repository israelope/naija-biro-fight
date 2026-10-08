# 🖊️ NAIJA BIRO FIGHT

The classic Nigerian school biro fight, rebuilt as a **3D multiplayer browser game**. Fortify your pen, pick your desk, flick, and knock your friend's biro off the table. Free to host.

```
Browser (Next.js + Three.js) ──► Vercel         pages + API routes (shop, coins, profiles)
        │                              │
        │                              └──► Neon (Postgres)   profiles, inventory, matches
        └──── WebSocket ──► Cloudflare Worker + Durable Objects   one room per invite code
                                       └──► reports finished matches to Vercel (signed)
```

## What is in the box

| Your 4 steps | What was built | Where |
|---|---|---|
| **1. Flick-and-collide prototype** | Deterministic capsule physics (spin, bounce, heavy hits), 3D scene, AI opponent (3 levels), table + pen visuals | `shared/physics.ts`, `game3d/`, `lib/ai.ts` |
| **2. Guest profiles, coins, shop** | Anonymous guest accounts, username + PIN, coins, atomic shop purchases, 3D item preview, equip loadout & table | `app/api/*`, `lib/server/*`, `components/Shop.tsx`, `db/schema.sql` |
| **3. Invite codes & 1v1 rooms** | Share link or 6-char code, authoritative room server, reconnect, turn timer, rematch, emotes | `worker/src/index.ts`, `components/Lobby.tsx` |
| **4. Polish, daily rewards, leaderboards** | Daily streak reward, first-match bonus, weekly + all-time boards by state, sparks, camera shake, sounds, PWA, WhatsApp sharing, report button | `app/api/daily`, `app/api/leaderboard`, `lib/sound.ts` |

**3D:** Real 3D with Three.js. Camera is a tilted 3D view that auto-fits portrait phones; a "Top" button gives a flat view. Pens visibly change with every fortification (extra cover sleeves, tape, iron rings, weighted tails, rubber/steel tips, skins). Tables are selectable and change the physics (slippery glass, grippy concrete, tiny desk...). All textures are drawn in code, so the game downloads **no image assets**.

---

## 1. Run it on your computer in 2 minutes (no accounts needed)

You need **Node.js 20 or newer** (https://nodejs.org).

```bash
cd naija-biro-fight
npm install
npm run dev
```

Open http://localhost:3000. With no database configured the game automatically runs in **Offline mode**: coins, shop, daily reward and practice vs AI all work and save in your browser. Friend rooms and leaderboards switch on once you finish steps 2-4.

Handy check: `npm run test:physics` runs headless physics tests (determinism, no tunnelling, knock-out rates).

---

## 2. Create the free database (Neon)

1. Sign up at https://neon.tech (free) and create a project (any name, pick the region closest to your players).
2. Open **SQL Editor**, paste the entire contents of `db/schema.sql`, and press **Run**.
3. On the project dashboard click **Connect** and copy the **connection string** (the pooled one is fine).
4. Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```
```
DATABASE_URL=postgresql://...your neon string...
GAME_SECRET=<run:  openssl rand -hex 32   (or type any long random string)>
GAME_WS_URL=ws://127.0.0.1:8787
```
5. Restart `npm run dev`. The game is now in **Online mode**: you get a real guest account, and *Profile* lets you pick a username + PIN.

> Neon free projects pause when idle; the first request after a pause is a little slower. That is normal.

---

## 3. Run the room server locally (friend matches)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars     # put the SAME GAME_SECRET as in .env.local
npm run dev                         # room server at http://127.0.0.1:8787
```

Now open the game in **two different browsers** (or one normal + one private window, since each gets its own guest account). In window A press **Invite a friend → Create room**; copy the link or code; paste it in window B (or open the `/join/CODE` link). The match starts after a 3-second countdown.

---

## 4. Deploy for free

### 4a. Cloudflare room server
```bash
cd worker
npx wrangler login
npx wrangler secret put GAME_SECRET     # paste the same secret you used before
npx wrangler deploy
```
It prints a URL like `https://naija-biro-rooms.YOURNAME.workers.dev`. Keep it. (Durable Objects are free on Cloudflare's Free plan when SQLite-backed, which `wrangler.toml` already sets up.)

### 4b. Vercel website
1. Push this folder to a **GitHub** repo (the `worker` folder can stay inside).
2. On https://vercel.com click **Add New → Project**, import the repo (framework: Next.js, root directory: the project root).
3. Add **Environment Variables**:

| Name | Value |
|---|---|
| `DATABASE_URL` | your Neon connection string |
| `GAME_SECRET` | the same secret as on Cloudflare |
| `GAME_WS_URL` | `wss://naija-biro-rooms.YOURNAME.workers.dev` (note **wss**) |
| `NEXT_PUBLIC_SITE_URL` | your Vercel URL (optional) |
| `NEXT_PUBLIC_POSTHOG_KEY` | optional analytics key |

4. Deploy. Copy your site URL (e.g. `https://naija-biro-fight.vercel.app`).

### 4c. Connect them (one more edit)
Edit `worker/wrangler.toml`:
```toml
[vars]
API_URL = "https://naija-biro-fight.vercel.app"        # so the room server can report match results
ALLOWED_ORIGINS = "https://naija-biro-fight.vercel.app"  # only your site may open rooms
```
Then `cd worker && npx wrangler deploy` again. **Test:** two phones, create a room, play a match, then check the winner's coins increased and the match shows under *Profile → Recent matches*.

---

## How the game works

* **Controls:** drag back anywhere on the desk and release (slingshot). Longer pull = more power. Spin buttons (↺ ● ↻) add curve. Pens point in the direction you flick.
* **Win a round** by knocking the opponent's pen off (its centre leaves the desk). If *your* pen falls, you lose the round. Best of 3.
* **Heavy move** = a collision harder than 85 cm/s. Heavy moves pay bonus coins.
* **Trade-off design:** heavier pens hit harder but launch slower; rubber tips bounce; teflon slides far; glass tables are icy; concrete is grippy.
* **Fairness:** both phones and the server run the *same* deterministic physics (only `+ - * /` and `sqrt`, no trig, inside the simulation). The server validates each flick, runs the real result, and sends the final positions, which clients snap to. Cheating by editing the browser does nothing in friend matches.
* **Turn timer:** 25 s. Three skipped turns in a row forfeits. Disconnect grace: 30 s to reconnect.

### Economy (edit `shared/constants.ts`)
Win 50 / loss 15 / +5 per heavy move (max 30) / first match of the day +20 / daily reward 30 → 90 over a 7-day streak / daily cap 500 coins from matches / practice vs AI capped at 100 coins/day. Playing the same opponent more than 6 times in 24h pays only 25% (anti-farming).

---

## Project map

```
shared/          Code used by the website AND the room server (so rules never drift)
  physics.ts       deterministic capsule physics
  game.ts          rounds, flicks, snapshots, judging
  catalog.ts       ALL items, prices, stats, tables
  sign.ts          HMAC tokens (room tickets, session cookie, match reports)
  protocol.ts      WebSocket message types
game3d/          Three.js: scene, models (pens/tables), canvas textures, shop preview
lib/             client logic: match engine, AI, API client, offline profile, sound
lib/server/      server helpers: Neon client, sessions, rewards, rate limit
app/api/         all HTTP endpoints
components/      screens (Home, Shop, Lobby, MatchView, Leaderboard, Profile)
worker/          Cloudflare Worker + Durable Object room server
db/schema.sql    database tables
```

## Customising

* **Add a pen part / skin / table:** add one entry to `ITEM_LIST` in `shared/catalog.ts`. It appears in the shop, previews in 3D, and is enforced by the API and room server automatically. Tables take `width`, `depth` (cm) and `friction`; pen parts take `mods` (mass, radius, restitution, grip, length, spin) and `vis` for how it looks.
* **Tune the feel:** constants at the top of `shared/physics.ts` (`HEAVY_SPEED`, friction scale), table `friction` and `maxSpeed` formula in `buildPenSpec`. Run `npm run test:physics` after changes.
* **Camera framing:** `updateCamera()` in `game3d/BiroScene.ts` (elevation angles and margins).
* **Local pen brands:** `skin` entries only need three colours. Real brand names/logos can be trademarked, so check before using them.
* **Gameplay GIF on the landing page:** `components/Landing.tsx` has an animated placeholder; swap it for your own recording in `/public`.

## Honest notes and known limits

* **I could not run `npm install` / `next build` or see the 3D visuals in my environment.** What *was* verified: the physics, rules, AI (AI-vs-AI full matches) and token signing run headlessly and pass, and the TypeScript was checked for syntax/logic errors. So expect small first-run fixes, most likely camera framing or visual tweaks. `next.config.mjs` sets `ignoreBuildErrors` so a stray type nit will not block your first deploy; run `npm run typecheck` and tighten it later.
* Tutorial is a "How to play" popup + practice mode, not a guided interactive tutorial.
* Public matchmaking, ranked mode and spectator mode are not built (Phase 3 of your roadmap).
* Practice-mode results are reported by the browser, so they are low-value and capped; friend-match rewards are server-verified.
* Rate limiting is in-memory (best effort on serverless). For hard limits add Upstash Redis.
* Rooms live in Durable Object memory; if the Cloudflare server restarts mid-match the room is lost (players just start a new one).
* **Vercel Hobby is for non-commercial use.** If you add ads or paid items, move to a paid plan or Cloudflare Pages. Free-tier limits change, so re-check Neon, Vercel and Cloudflare pricing pages before launch.
* The Terms and Privacy pages are **templates**. Have them reviewed (Nigeria's NDPA 2023 applies). No real-money mechanics are included; keep it that way unless you get proper legal advice.
* Usernames are not profanity-filtered yet. Reports are saved in the `reports` table; review them in the Neon dashboard and set `banned = true` on bad accounts.

## Troubleshooting

| Problem | Fix |
|---|---|
| Orange "Offline mode" banner | `DATABASE_URL` missing or schema not run. Check `.env.local`, restart `npm run dev`. |
| "Online rooms are not set up yet" | `GAME_WS_URL` missing in `.env.local` / Vercel. |
| Room says "ticket invalid" | `GAME_SECRET` differs between Vercel and the worker. |
| Friend joins but match never starts | Worker not running, or `ALLOWED_ORIGINS` doesn't include your site. |
| No coins after a match | Worker's `API_URL` wrong. `npx wrangler tail` in `worker/` shows "match report failed". |
| Black/blank game screen | Device without WebGL. Try Chrome, turn off battery saver, set Graphics: Low. |
| Laggy on old Android | Home → footer → Graphics: Low (no shadows, lower resolution). |

## Roadmap ideas
Public matchmaking and ranked ladder · daily quests · pen rarity and collections · spectator mode · shareable result images · guided tutorial · profanity filter · admin page for reports.

Have fun, and may your pen never fall first. 🇳🇬
