# Project PTR

Live leaderboard, player profiles, and account linking for **Project PTR**, an
independent community circuit for *The Bazaar*, played on the test realm.

## Structure

```
index.html      page structure + content (Ladder, About, Format, Compete, Account, Profile)
styles.css      all styling
app.js          tabs, leaderboard (paginated), profiles, Supabase auth + name claim
assets/         logos + favicon + Discord icon
for-your-friend/  backend notes for the Supabase/bot owner
```

Plain static site, no build step. Deploy the folder as-is (Cloudflare Pages,
Netlify, Vercel). `index.html` is the entry point; no build command.

## Configuration (top of `app.js`)

- `DISCORD_URL` - invite link for the "Join Discord" buttons.
- `SUPABASE_URL` / `SUPABASE_KEY` - project URL + publishable/anon key (read-only,
  browser-safe). Never put a secret key here.
- `PAGE_SIZE` - leaderboard rows per page (default 50). Prev/Next appear past one page.

## Data (per website_data_handoff.md)

Reads use the anon key: `leaderboard`, `players`, `lobby_final_results` + `games`,
and the hero-stats RPCs. The one write is a signed-in user claiming their in-game
name via `app_set_my_username`; `app_my_player` reads their own row back. Sign-in is
Supabase Auth (Discord OAuth). See `for-your-friend/BACKEND_NOTES.md`.

Note: the name-claim path needs backend migration 0033 on prod. Reads and hero
stats (through 0032) work without it. Test login against a local server
(`python3 -m http.server 8000`) or the hosted URL, not a `file://` page.

## Note

Independent community event; not affiliated with or endorsed by Tempo or The Bazaar.
The Bazaar name and logos are property of their respective owners, used with permission.
