# Project Caravan

Live leaderboard + info site for **Project Caravan**, an independent, community-run
competitive circuit for *The Bazaar*, played on the test realm.

## What this is

A single static page (`index.html`) — no build step, no framework. It has four
tabs (Ladder, About, Format, Compete) and a live leaderboard that reads directly
from a read-only Supabase view. The Discord bot writes the data; the site only reads.

## Run locally

Just open `index.html` in a browser. That's it.

## Configuration

Both settings live at the top of the `<script>` block near the bottom of `index.html`:

- `DISCORD_URL` — the invite link used by the three "Join Discord" buttons.
- `SUPABASE_URL` / `SUPABASE_KEY` — the Supabase project URL and the **publishable /
  anon** key. This key is read-only (RLS is on) and is safe to ship in the browser.
  **Never** put the `service_role` / secret key here.

## Hosting

Deploy straight from this repo to any static host (Cloudflare Pages, Vercel,
Netlify, GitHub Pages). No build command; the output directory is the repo root,
and `index.html` is the entry point.

To keep the live site private during testing, Cloudflare Pages + Cloudflare Access
(free for up to 50 users, email one-time-PIN) is the easiest gated setup.

## Note

Project Caravan is an independent, community event and is not affiliated with or
endorsed by Tempo or The Bazaar. The Bazaar name and logos are property of their
respective owners, used with permission.
