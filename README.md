# Project PTR

Live leaderboard + info site for **Project PTR**, an independent, community-run
competitive circuit for *The Bazaar*, played on the test realm.

## Structure

```
index.html      page structure + all content
styles.css      all styling
app.js          tabs, leaderboard, live match/queue, profiles, stats, auth
assets/         logos + favicon (gem)
```

Plain static site, no build step. Deploy the folder as-is (Cloudflare Pages,
Netlify, Vercel, or GitHub Pages); `index.html` is the entry point, no build command.

## Pages

- **Home:** masthead, featured live match card, site totals (with Discord/QQ split)
- **Leaderboard:** ranked ladder, 50 per page, searchable by name
- **Spectate:** live matchmaking queue + every match currently in progress
- **Stats:** per-hero performance, with a Ranked/Unranked toggle
- **About / Format / Compete:** what the project is, how rating works, how to play
- **Account:** Discord sign-in, claim or change your in-game name
- **Profile:** career stats, recent games, hero breakdown (ranked + unranked)
- **QQ guide:** Chinese-language guide for the QQ bot

## Configuration (top of `app.js`)

- `DISCORD_URL`: invite link for the "Join Discord" buttons.
- `SUPABASE_URL` / `SUPABASE_KEY`: project URL + **publishable/anon** key (read-only,
  safe in the browser). Never put the `service_role` key here.
- `PAGE_SIZE`: leaderboard rows per page (default 50).

## Backend

The site is a **read-only consumer** of a Supabase backend maintained separately,
alongside the Discord and QQ bots. It reads with the anon key and makes exactly one
write: a signed-in user setting their own in-game name.

Reads: `leaderboard`, `players`, `games`, `lobby_final_results`, `featured_match`,
`live_matches`, `queue_snapshot`, `site_totals`, plus the hero-stats and
player-history RPCs.

Write: `app_set_my_username`, so a signed-in user can claim or change their own name.

Features degrade gracefully when a backend view or RPC isn't available yet, so the
site stays up even if a migration hasn't been applied.

## Discord login

Sign-in uses Supabase Auth with Discord OAuth. The site's origin must be listed
under Supabase Authentication, URL Configuration, Redirect URLs. The login flow needs
a real redirect URL, so test against a local server (`python3 -m http.server 8000`)
or the hosted site, not a `file://` page. The read-only pages work without any of this.

## Note

Independent community event; not affiliated with or endorsed by Tempo or The Bazaar.
The Bazaar name and logos are property of their respective owners, used with permission.
