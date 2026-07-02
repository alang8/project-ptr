# Project PTR

Live leaderboard + info site for **Project PTR**, an independent, community-run
competitive circuit for *The Bazaar*, played on the test realm.

## Structure

```
index.html      page structure + content (4 tabs + Account)
styles.css      all styling
app.js          tabs, leaderboard, Discord login, name-linking
assets/         logos + favicon (gem)
for-your-friend/  Supabase SQL + bot command spec (NOT part of the website)
```

Plain static site, no build step. Deploy the folder as-is (Cloudflare Pages,
Netlify, Vercel, or GitHub Pages); `index.html` is the entry point, no build command.

## Configuration (top of `app.js`)

- `DISCORD_URL`: invite link for the "Join Discord" buttons.
- `SUPABASE_URL` / `SUPABASE_KEY`: project URL + **publishable/anon** key (read-only,
  safe in the browser). Never put the `service_role` key here.

## Discord login + name linking

Lets a player sign in with Discord and connect their in-game name so results are
tracked. Requires one-time setup on the Supabase side (see `for-your-friend/`):

1. **Discord app:** create one at discord.com/developers → OAuth2 → add redirect
   `https://rbvezddypfpjepofngqb.supabase.co/auth/v1/callback` → copy Client ID + Secret.
2. **Supabase:** Authentication → Providers → enable Discord, paste ID + Secret.
3. **Supabase:** Authentication → URL Configuration → add Redirect URLs for
   `http://localhost:8000` (dev) and your production URL.
4. **Database:** run `for-your-friend/supabase_setup.sql`.
5. **Bot:** add the `/link` command per `for-your-friend/bot_link_command.md`.

The full login flow needs a real redirect URL, so test against a local server
(`python3 -m http.server 8000`) or the hosted site, not a `file://` page. The
read-only leaderboard works without any of this.

## Note

Independent community event; not affiliated with or endorsed by Tempo or The Bazaar.
The Bazaar name and logos are property of their respective owners, used with permission.
