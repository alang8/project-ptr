/* =========================================================================
   Project PTR front-end logic
   Config: edit DISCORD_URL when you have an invite. SUPABASE_KEY is the
   read-only publishable key (safe in the browser). Never put a secret key here.
   ========================================================================= */
const SUPABASE_URL = "https://rbvezddypfpjepofngqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_Tk-w3eZYTevhw8-5jxBOwg_MPaH4778";
const DISCORD_URL  = "https://discord.gg/FCMSzHSAp7";
const PAGE_SIZE    = 1000;

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $  = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

/* ---------- year + discord buttons ---------- */
$("yr") && ($("yr").textContent = new Date().getFullYear());
["discord-top","discord-hero","discord-compete"].forEach(id => { const el=$(id); if(el) el.href=DISCORD_URL; });

/* ---------- tabs ---------- */
const tabBtns = [...document.querySelectorAll(".tab-btn")];
const panels  = [...document.querySelectorAll(".tab")];
function show(name){
  tabBtns.forEach(t => t.classList.toggle("active", t.dataset.tab===name));
  panels.forEach(p => p.classList.toggle("active", p.id===name));
  if(location.hash.slice(1)!==name) history.replaceState(null,"","#"+name);
  window.scrollTo({top:0, behavior:"auto"});
  if(name==="profile") renderProfile();
  if(name==="heroes") renderHeroes();
}
document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => b.dataset.tab==="profile" ? showProfile(null) : show(b.dataset.tab)));
window.addEventListener("hashchange", () => { const h=location.hash.slice(1); if($(h)) show(h); });
if(location.hash.slice(1) && $(location.hash.slice(1))) show(location.hash.slice(1));

/* =========================================================================
   LEADERBOARD  (read-only `leaderboard` view)
   ========================================================================= */
const MEDALS = {1:"🥇",2:"🥈",3:"🥉"};
let prevRatings = {};
let currentPage = 0;
async function fetchLeaderboard(page){
  const from = page*PAGE_SIZE, to = from+PAGE_SIZE-1;
  const { data, error, count } = await sb
    .from("leaderboard")
    .select("id,discord_id,username,rating,games,wins,losses,position", { count:"exact" })
    .order("position", { ascending:true })
    .range(from, to);
  if(error) throw error;
  return {
    total: count ?? data.length,
    rows: data.map(p => ({
      key:p.id||p.username, name:p.username||"Unknown player", uname:p.username||null,
      rating:Math.round(p.rating), games:p.games, wins:p.wins, losses:p.losses, position:p.position
    }))
  };
}
function renderBoard(payload){
  const list = payload.rows || [];
  $("err").style.display = "none";
  $("m-players").textContent = payload.total!=null ? payload.total : list.length;
  $("m-updated").textContent = new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  $("rows").innerHTML = list.map((p,i) => {
    const rank=p.position, games=p.games||0, wr=games?Math.round((p.wins/games)*100):0;
    const rc = MEDALS[rank] ? `<span class="medal">${MEDALS[rank]}</span>` : rank;
    const ch = prevRatings[p.key]!==undefined && prevRatings[p.key]!==p.rating;
    return `<div class="row ${rank<=3?'top':''} ${ch?'flash':''}" ${p.uname?`data-name="${esc(p.uname)}"`:''} style="animation-delay:${i*40}ms">
      <div class="rank">${rc}</div>
      <div class="player"><div class="handle">${esc(p.name)}</div><span class="hero">${games} game${games===1?'':'s'}</span></div>
      <div class="mmr">${p.rating}</div>
      <div class="record"><span class="w">${p.wins}W</span><span class="sep">/</span><span class="l">${p.losses}L</span><span class="wr">${wr}% WR</span></div>
    </div>`;
  }).join("");
  prevRatings = {}; list.forEach(p => prevRatings[p.key]=p.rating);
  renderPager(payload.total||0);
}
async function tickBoard(){
  try{
    const payload = await fetchLeaderboard(currentPage);
    const maxPage = Math.max(0, Math.ceil((payload.total||0)/PAGE_SIZE)-1);
    if(currentPage > maxPage){ currentPage = maxPage; return tickBoard(); }
    renderBoard(payload);
  }catch(e){ console.error(e); $("err").style.display="block"; }
}
function goToPage(p){ currentPage = Math.max(0, p); tickBoard(); window.scrollTo({top:0, behavior:"smooth"}); }
function renderPager(total){
  const pager = $("pager"); if(!pager) return;
  const pages = Math.max(1, Math.ceil(total/PAGE_SIZE));
  if(pages<=1){ pager.innerHTML=""; return; }
  const from = total ? currentPage*PAGE_SIZE+1 : 0;
  const to = Math.min(total, (currentPage+1)*PAGE_SIZE);
  pager.innerHTML = `
    <button class="pg-btn" id="pg-prev" ${currentPage<=0?'disabled':''}>Prev</button>
    <span class="pg-info">${from}-${to} of ${total}</span>
    <button class="pg-btn" id="pg-next" ${currentPage>=pages-1?'disabled':''}>Next</button>`;
  const prev=$("pg-prev"), next=$("pg-next");
  if(prev) prev.onclick = () => goToPage(currentPage-1);
  if(next) next.onclick = () => goToPage(currentPage+1);
}
tickBoard(); setInterval(tickBoard, 30000);
$("rows").addEventListener("click", e => { const r=e.target.closest(".row[data-name]"); if(r) showProfile(r.dataset.name); });

/* =========================================================================
   AUTH + NAME LINKING  (Supabase Auth + app_set_my_username / app_my_player)
   ========================================================================= */
const DISCORD_MARK = '<img class="dico" src="assets/discord.png" alt="">';
const slot  = $("auth-slot");
const panel = $("account-panel");

function accountName(user){ const m=user.user_metadata||{}; return m.full_name||m.name||m.global_name||m.preferred_username||m.user_name||"Signed in"; }
function accountAvatar(user){ const m=user.user_metadata||{}; return m.avatar_url||m.picture||""; }

async function signIn(){
  await sb.auth.signInWithOAuth({ provider:"discord", options:{ redirectTo: location.origin } });
}
async function signOut(){ await sb.auth.signOut(); }

function renderSlot(session){
  if(!slot) return;
  if(!session){ slot.innerHTML = `<button class="btn-discord" id="nav-signin">${DISCORD_MARK} Sign in</button>`; $("nav-signin").onclick=signIn; return; }
  const u=session.user, av=accountAvatar(u);
  slot.innerHTML = `<div class="user-chip">${av?`<img src="${esc(av)}" alt="">`:""}<span class="un">${esc(accountName(u))}</span><button id="nav-signout">Sign out</button></div>`;
  $("nav-signout").onclick=signOut;
}

async function myPlayer(){
  try{ const { data } = await sb.rpc("app_my_player"); return data || null; }catch(e){ return null; }
}

async function renderAccount(session){
  if(!panel) return;
  if(!session){
    panel.innerHTML = `<p class="acct-muted" style="margin-bottom:18px">Sign in to claim your in-game name.</p>
      <button class="btn-discord" id="acct-signin" style="margin:0 auto">${DISCORD_MARK} Sign in with Discord</button>`;
    $("acct-signin").onclick=signIn; return;
  }
  const u=session.user, av=accountAvatar(u);
  const head = `<div class="acct-row">${av?`<img src="${esc(av)}" alt="">`:""}<div class="who"><b>${esc(accountName(u))}</b><span>Signed in</span></div></div>`;

  const me = await myPlayer();
  if(me && me.username){
    panel.innerHTML = head + `<div class="acct-linked">\u2705 Connected to <span class="nm">${esc(me.username)}</span></div>
      <p class="acct-hint">Your results are tracked on the ladder under this name.</p>
      <button class="btn btn-gold" id="view-profile" style="margin-top:14px">View your profile</button>`;
    $("view-profile").onclick = () => showProfile(null);
    return;
  }

  panel.innerHTML = head + `
    <div class="field"><input id="ign" type="text" placeholder="Your in-game name" maxlength="40" autocomplete="off"></div>
    <p class="acct-hint">Enter the exact name you use in The Bazaar to claim it.</p>
    <div class="acct-err" id="acct-err" style="display:none"></div>
    <button class="btn btn-gold" id="claim-btn" style="margin-top:16px">Claim my name</button>`;
  $("ign").addEventListener("keydown", e => { if(e.key==="Enter") submitClaim(); });
  $("claim-btn").onclick = submitClaim;
}

async function submitClaim(){
  const name = ($("ign").value||"").trim();
  const errEl = $("acct-err"); errEl.style.display="none";
  const btn = $("claim-btn");
  if(name.length<2){ errEl.textContent="Please enter your in-game name."; errEl.style.display="block"; return; }
  btn.disabled=true; btn.textContent="Claiming...";
  let res=null;
  try{ const { data, error } = await sb.rpc("app_set_my_username",{ p_name:name }); if(error) throw error; res=data; }
  catch(e){ errEl.textContent="Something went wrong. Please try again."; errEl.style.display="block"; btn.disabled=false; btn.textContent="Claim my name"; return; }

  const status = res && res.status;
  if(status==="ok"){ refreshAuth(); return; }
  if(status==="pending"){
    panel.innerHTML = `<div class="acct-linked" style="color:var(--gold-bright)">Claim recorded</div>
      <p class="acct-hint">We'll connect <b style="color:var(--ink)">${esc(name)}</b> to your account once it's verified in a game. Its existing results stay on the ladder under that name until then.</p>
      <button class="btn btn-ghost" id="claim-again" style="margin-top:16px">Claim a different name</button>`;
    $("claim-again").onclick = () => refreshAuth();
    return;
  }
  const msg = status==="conflict" ? "That name is already linked to another account. Try a different name, or reach out to an organizer."
            : status==="invalid" ? "Please enter a valid in-game name."
            : status==="unauthenticated" ? "Your session expired. Please sign in again."
            : "Couldn't claim that name. Please try again.";
  errEl.textContent=msg; errEl.style.display="block";
  btn.disabled=false; btn.textContent="Claim my name";
}

async function refreshAuth(){ const { data:{ session } } = await sb.auth.getSession(); renderSlot(session); renderAccount(session); }
let authReady = false;
sb.auth.onAuthStateChange((event, session) => {
  renderSlot(session);
  renderAccount(session);
  if(authReady && event === "SIGNED_IN" && location.hash.slice(1) !== "account") show("account");
  authReady = true;
});
refreshAuth();

/* =========================================================================
   PROFILE / STATS
   ========================================================================= */
let profileTarget = null;
function showProfile(name){ profileTarget = name || null; show("profile"); }
const ORD = n => { const s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); };
function fmtDate(iso){ if(!iso) return ""; return new Date(iso).toLocaleDateString([], {month:"short", day:"numeric"}); }

async function loadHistory(playerId){
  try{
    const { data, error } = await sb.from("lobby_final_results")
      .select("finish_order, placement, delta, rating_after, is_win, hero, games!inner(id, ended_at, rated, ranked, code, status)")
      .eq("player_id", playerId).eq("games.status","closed").eq("games.ranked", true)
      .order("ended_at", { foreignTable:"games", ascending:false }).limit(30);
    if(error) throw error;
    return data || [];
  }catch(e){
    const { data: rows } = await sb.from("lobby_final_results")
      .select("finish_order, placement, delta, rating_after, is_win, hero, lobby_id")
      .eq("player_id", playerId).limit(60);
    const ids = [...new Set((rows||[]).map(r => r.lobby_id))];
    let gs = [];
    if(ids.length){ const { data } = await sb.from("games").select("id, ended_at, rated, ranked, code, status").in("id", ids); gs = data || []; }
    const gmap = Object.fromEntries(gs.map(g => [g.id, g]));
    return (rows||[]).map(r => ({ ...r, games: gmap[r.lobby_id] }))
      .filter(r => r.games && r.games.status === "closed" && r.games.ranked === true)
      .sort((a,b) => new Date(b.games.ended_at) - new Date(a.games.ended_at)).slice(0,30);
  }
}

async function loadProfileByPlayer(player){
  let position = null;
  try{ const { data:lb } = await sb.from("leaderboard").select("position").eq("id", player.id).maybeSingle(); position = lb ? lb.position : null; }catch(e){}
  const history = await loadHistory(player.id);
  let heroes = [];
  try{
    const { data, error } = await sb.rpc("app_user_hero_stats", { p_player_id: player.id, p_mode: "ranked" });
    if(error) throw error;
    heroes = (data || []).slice(0, 6).map(h => ({ hero:h.hero, games:h.games, rate: h.top_half_rate }));
  }catch(e){
    const H = {};
    history.forEach(h => { if(h.hero){ (H[h.hero] = H[h.hero] || {g:0,w:0}); H[h.hero].g++; if(h.is_win) H[h.hero].w++; } });
    heroes = Object.entries(H).sort((a,b)=>b[1].g-a[1].g).slice(0,6).map(([hero,s]) => ({ hero, games:s.g, rate:s.w/s.g }));
  }
  return { player, position, history, heroes };
}

async function loadProfileData(name){
  const { data: player } = await sb.from("players")
    .select("id, discord_id, username, rating, games, wins, losses").eq("username", name).maybeSingle();
  if(!player) return null;
  return loadProfileByPlayer(player);
}

async function renderProfile(){
  const box = $("profile-panel"); if(!box) return;
  let d = null, isSelf = false;

  if(!profileTarget){
    const { data:{ session } } = await sb.auth.getSession();
    if(!session){
      box.innerHTML = `<p class="acct-muted" style="margin-bottom:16px">Sign in to see your own profile, or tap any player on the ladder.</p>
        <button class="btn-discord" id="prof-signin" style="margin:0 auto">${DISCORD_MARK} Sign in with Discord</button>`;
      $("prof-signin").onclick = signIn; return;
    }
    const me = await myPlayer();
    if(!me || !me.username){
      box.innerHTML = `<p class="acct-muted" style="margin-bottom:16px">You haven't claimed an in-game name yet.</p>
        <button class="btn btn-gold" id="prof-link" style="margin:0 auto">Claim your name</button>`;
      $("prof-link").onclick = () => show("account"); return;
    }
    isSelf = true;
    box.innerHTML = `<div class="acct-muted">Loading profile...</div>`;
    d = await loadProfileByPlayer(me);
  } else {
    box.innerHTML = `<div class="acct-muted">Loading profile...</div>`;
    d = await loadProfileData(profileTarget);
  }

  if(!d){ box.innerHTML = `<p class="acct-muted">No player found for "${esc(profileTarget||"")}".</p>`; return; }

  const p = d.player, games = p.games || 0, wr = games ? Math.round((p.wins/games)*100) : 0;

  const matches = d.history.slice(0,15).map(h => {
    const dl = Math.round(h.delta || 0);
    const cls = dl>0 ? "pos" : (dl<0 ? "neg" : "zero");
    const deltaTxt = dl>0 ? ("+"+dl) : (""+dl);
    const unrated = (h.games && h.games.rated === false) ? `<span class="unrated">unrated</span>` : "";
    return `<div class="m-row">
      <span class="m-date">${fmtDate(h.games && h.games.ended_at)}</span>
      <span class="m-place">${ORD(h.placement)}</span>
      <span class="m-hero">${h.hero ? esc(h.hero) : "-"}</span>
      <span class="m-delta ${cls}">${deltaTxt}</span>
      <span class="m-rating">${Math.round(h.rating_after)}${unrated}</span>
    </div>`;
  }).join("");

  const heroRows = d.heroes.map(h => `<div class="hero-row"><span class="hh">${esc(h.hero)}</span><span class="hg">${h.games}g</span><span class="hw">${Math.round((h.rate||0)*100)}%</span></div>`).join("");

  box.innerHTML = `
    <div class="profile-head">
      <div>
        <div class="p-name">${esc(p.username || "")}${isSelf ? ' <span class="you">you</span>' : ''}</div>
        <div class="p-sub2">${games ? (games + " ranked game" + (games===1?"":"s")) : "No ranked games yet"}</div>
      </div>
      <div class="p-rank">${d.position ? ("#"+d.position) : "Unranked"}</div>
    </div>
    <div class="p-tiles">
      <div class="p-tile"><b>${Math.round(p.rating)}</b><span>Rating</span></div>
      <div class="p-tile"><b>${p.wins}-${p.losses}</b><span>Record</span></div>
      <div class="p-tile"><b>${wr}%</b><span>Top-half</span></div>
      <div class="p-tile"><b>${games}</b><span>Games</span></div>
    </div>
    <p class="p-foot">A "win" is a top-half finish, so wins + losses = games.</p>
    ${matches ? `<h3 class="p-sub">Recent games</h3>
      <div class="p-matches">
        <div class="m-row m-head"><span>Date</span><span>Place</span><span>Hero</span><span class="m-delta">Change</span><span class="m-rating">Rating</span></div>
        ${matches}
      </div>` : ""}
    ${heroRows ? `<h3 class="p-sub">Heroes</h3>
      <div class="p-heroes">${heroRows}</div>` : ""}
  `;
}


/* =========================================================================
   HERO STATS  (global, app_hero_stats(mode))
   ========================================================================= */
async function renderHeroes(){
  const box = $("heroes-panel"); if(!box) return;
  box.innerHTML = `<div class="acct-muted" style="text-align:center">Loading...</div>`;
  let rows = [];
  try{
    const { data, error } = await sb.rpc("app_hero_stats", { p_mode: "ranked" });
    if(error) throw error;
    rows = data || [];
  }catch(e){ box.innerHTML = `<p class="acct-muted" style="text-align:center">Couldn't load hero stats.</p>`; return; }
  if(!rows.length){ box.innerHTML = `<p class="acct-muted" style="text-align:center">No ranked hero data yet.</p>`; return; }
  const pct = x => Math.round((x||0)*100)+"%";
  const avg = x => (x!=null ? Number(x).toFixed(1) : "-");
  box.innerHTML = `<div class="htable">
    <div class="ht-row ht-head"><span>Hero</span><span>G</span><span>Top-half</span><span>Win</span><span>Avg</span><span>Pick</span></div>
    ${rows.map(h => `<div class="ht-row">
      <span class="ht-hero">${esc(h.hero)}</span>
      <span class="ht-num">${h.games}</span>
      <span class="ht-num gold">${pct(h.top_half_rate)}</span>
      <span class="ht-num">${pct(h.win_rate)}</span>
      <span class="ht-num">${avg(h.avg_place)}</span>
      <span class="ht-num">${pct(h.play_rate)}</span>
    </div>`).join("")}
  </div>`;
}
