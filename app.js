/* =========================================================================
   Project PTR front-end logic
   Config: edit DISCORD_URL when you have an invite. SUPABASE_KEY is the
   read-only publishable key (safe in the browser). Never put a secret key here.
   ========================================================================= */
const SUPABASE_URL = "https://rbvezddypfpjepofngqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_Tk-w3eZYTevhw8-5jxBOwg_MPaH4778";
const DISCORD_URL  = "https://discord.gg/FCMSzHSAp7"
const PAGE_SIZE    = 50;

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

/* ---------- leaderboard search ---------- */
const lbSearch = $("lb-search");
if(lbSearch){
  let deb;
  const run = () => { searchTerm = lbSearch.value.trim(); currentPage = 0; tickBoard(); };
  lbSearch.addEventListener("input", () => { clearTimeout(deb); deb = setTimeout(run, 250); });
  const lbClear = $("lb-clear");
  if(lbClear) lbClear.addEventListener("click", () => { lbSearch.value = ""; searchTerm = ""; currentPage = 0; lbSearch.focus(); tickBoard(); });
}

/* ---------- mobile menu ---------- */
const topbar = document.querySelector(".topbar");
const navToggle = $("nav-toggle");
function closeMenu(){ if(topbar){ topbar.classList.remove("menu-open"); } if(navToggle){ navToggle.setAttribute("aria-expanded","false"); } }
if(navToggle){
  navToggle.addEventListener("click", e => {
    e.stopPropagation();
    const open = topbar.classList.toggle("menu-open");
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
}
document.querySelectorAll(".tabs .tab-btn").forEach(b => b.addEventListener("click", closeMenu));
document.addEventListener("click", e => { if(topbar && topbar.classList.contains("menu-open") && !topbar.contains(e.target)) closeMenu(); });
if(location.hash.slice(1) && $(location.hash.slice(1))) show(location.hash.slice(1));

/* =========================================================================
   LEADERBOARD  (read-only `leaderboard` view)
   ========================================================================= */
const MEDALS = {1:"🥇",2:"🥈",3:"🥉"};
let prevRatings = {};
let currentPage = 0;
let searchTerm = "";
async function fetchLeaderboard(page){
  const from = page*PAGE_SIZE, to = from+PAGE_SIZE-1;
  let q = sb
    .from("leaderboard")
    .select("id,discord_id,username,rating,games,wins,losses,position", { count:"exact" })
    .order("position", { ascending:true });
  if(searchTerm) q = q.ilike("username", "%" + searchTerm.replace(/[%_]/g, "\\$&") + "%");
  const { data, error, count } = await q.range(from, to);
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
  if(!list.length){
    $("rows").innerHTML = `<div class="lb-empty">${searchTerm ? `No players match "${esc(searchTerm)}".` : "No players yet."}</div>`;
    renderPager(0); return;
  }
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
  sessionStorage.setItem("ptr_login","1");
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
      <button class="btn btn-gold" id="view-profile" style="margin-top:14px">View your profile</button>
      <button class="btn btn-ghost" id="change-name" style="margin-top:10px">Change name</button>`;
    $("view-profile").onclick = () => showProfile(null);
    $("change-name").onclick = () => showChangeName(head, me.username);
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

function showChangeName(head, current){
  panel.innerHTML = head + `
    <div class="acct-linked" style="font-size:16px;color:var(--ink-soft)">Change your linked name</div>
    <div class="field"><input id="ign" type="text" value="${esc(current)}" placeholder="Your in-game name" maxlength="40" autocomplete="off"></div>
    <p class="acct-hint">Enter the exact name you use in The Bazaar. This re-points your account to the new name.</p>
    <div class="acct-err" id="acct-err" style="display:none"></div>
    <div class="acct-actions">
      <button class="btn btn-gold" id="claim-btn">Save</button>
      <button class="btn btn-ghost" id="change-cancel">Cancel</button>
    </div>`;
  const inp = $("ign");
  inp.addEventListener("keydown", e => { if(e.key==="Enter") submitClaim(); });
  $("claim-btn").onclick = submitClaim;
  $("change-cancel").onclick = () => refreshAuth();
  inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
}

async function submitClaim(){
  const name = ($("ign").value||"").trim();
  const errEl = $("acct-err"); errEl.style.display="none";
  const btn = $("claim-btn");
  const label = btn.textContent;
  if(name.length<2){ errEl.textContent="Please enter your in-game name."; errEl.style.display="block"; return; }
  btn.disabled=true; btn.textContent="Saving...";
  let res=null;
  try{ const { data, error } = await sb.rpc("app_set_my_username",{ p_name:name }); if(error) throw error; res=data; }
  catch(e){ errEl.textContent="Something went wrong. Please try again."; errEl.style.display="block"; btn.disabled=false; btn.textContent=label; return; }

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
  btn.disabled=false; btn.textContent=label;
}

async function refreshAuth(){ const { data:{ session } } = await sb.auth.getSession(); renderSlot(session); renderAccount(session); }
sb.auth.onAuthStateChange((event, session) => {
  renderSlot(session); renderAccount(session);
  if(event==="SIGNED_IN" && sessionStorage.getItem("ptr_login")){
    sessionStorage.removeItem("ptr_login");
    show("account");
  }
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
      .select("finish_order, placement, delta, rating_after, is_win, hero, games!inner(id, ended_at, rated, ranked, code, origin, status)")
      .eq("player_id", playerId).eq("games.status","closed")
      .order("ended_at", { foreignTable:"games", ascending:false, nullsFirst:false }).limit(30);
    if(error) throw error;
    return (data || []).slice().sort((x,y) => new Date(y.games?.ended_at||0) - new Date(x.games?.ended_at||0));
  }catch(e){
    const { data: rows } = await sb.from("lobby_final_results")
      .select("finish_order, placement, delta, rating_after, is_win, hero, lobby_id")
      .eq("player_id", playerId).limit(60);
    const ids = [...new Set((rows||[]).map(r => r.lobby_id))];
    let gs = [];
    if(ids.length){ const { data } = await sb.from("games").select("id, ended_at, rated, ranked, code, origin, status").in("id", ids); gs = data || []; }
    const gmap = Object.fromEntries(gs.map(g => [g.id, g]));
    return (rows||[]).map(r => ({ ...r, games: gmap[r.lobby_id] }))
      .filter(r => r.games && r.games.status === "closed")
      .sort((a,b) => new Date(b.games.ended_at) - new Date(a.games.ended_at)).slice(0,30);
  }
}

async function loadProfileByPlayer(player){
  let position = null;
  try{ const { data:lb } = await sb.from("leaderboard").select("position").eq("id", player.id).maybeSingle(); position = lb ? lb.position : null; }catch(e){}
  const history = await loadHistory(player.id);
  async function heroStats(mode){
    try{
      const { data, error } = await sb.rpc("app_user_hero_stats", { p_player_id: player.id, p_mode: mode });
      if(error) throw error;
      return (data || []).filter(h => h.hero && h.hero.toLowerCase() !== "unknown").slice(0, 6).map(h => ({ hero:h.hero, games:h.games, rate: h.top_half_rate }));
    }catch(e){ return []; }
  }
  const [heroesRanked, heroesUnranked] = await Promise.all([heroStats("ranked"), heroStats("normal")]);
  return { player, position, history, heroesRanked, heroesUnranked };
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
    const g = h.games || {};
    const dl = Math.round(h.delta || 0);
    const cls = dl>0 ? "pos" : (dl<0 ? "neg" : "zero");
    const deltaTxt = dl>0 ? ("+"+dl) : (""+dl);
    const isRanked = g.origin ? g.origin==="matchmaking" : !!g.ranked;
    const badge = isRanked ? '<span class="m-badge ranked">Ranked</span>'
                           : '<span class="m-badge unranked">Unranked</span>';
    return `<div class="m-row">
      <span class="m-date">${fmtDate(g.ended_at)}</span>
      <span class="m-place">${ORD(h.placement)}</span>
      <span class="m-hero">${h.hero ? esc(h.hero) : "-"}</span>
      <span class="m-delta ${cls}">${g.rated!==false ? deltaTxt : ""}</span>
      <span class="m-rating">${Math.round(h.rating_after)}${badge}</span>
    </div>`;
  }).join("");

  const heroTable = (list, tag) => {
    if(!list.length) return "";
    const rows = list.map(h => `<div class="hero-row"><span class="hh">${esc(h.hero)}</span><span class="hg">${h.games}</span><span class="hw">${Math.round((h.rate||0)*100)}%</span></div>`).join("");
    return `<h3 class="p-sub">Heroes <span class="p-sub-tag">${tag}</span></h3>
      <div class="p-heroes">
        <div class="hero-row hero-head"><span>Hero</span><span>Games</span><span>Top-half</span></div>
        ${rows}
      </div>`;
  };

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
    ${heroTable(d.heroesRanked, "Ranked")}
    ${heroTable(d.heroesUnranked, "Unranked")}
  `;
}


/* =========================================================================
   HERO STATS  (global, app_hero_stats(mode))
   ========================================================================= */
let heroMode = "ranked";
async function renderHeroes(mode){
  heroMode = mode || heroMode || "ranked";
  const box = $("heroes-panel"); if(!box) return;
  document.querySelectorAll("#hero-mode button").forEach(b => b.classList.toggle("active", b.dataset.mode===heroMode));
  box.innerHTML = `<div class="acct-muted" style="text-align:center">Loading...</div>`;
  let rows = [];
  try{
    const { data, error } = await sb.rpc("app_hero_stats", { p_mode: heroMode });
    if(error) throw error;
    rows = (data || []).filter(h => h.hero && h.hero.toLowerCase() !== "unknown");
  }catch(e){ box.innerHTML = `<p class="acct-muted" style="text-align:center">Couldn't load hero stats.</p>`; return; }
  if(!rows.length){ box.innerHTML = `<p class="acct-muted" style="text-align:center">No ${heroMode==="ranked"?"ranked":"unranked"} hero data yet.</p>`; return; }
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

document.querySelectorAll("#hero-mode button").forEach(b => b.addEventListener("click", () => renderHeroes(b.dataset.mode)));


/* =========================================================================
   FEATURED LIVE MATCH  (read-only `featured_match` view)
   ========================================================================= */
let featStamp = "__init__";
async function renderFeatured(){
  const box = $("featured"); if(!box) return;
  let f = null;
  try{ const { data } = await sb.from("featured_match").select("*").single(); f = data; }
  catch(e){ if(featStamp!==null){ box.innerHTML=""; featStamp=null; } return; }
  if(!f || f.status !== "live"){
    if(featStamp!=="none"){ box.innerHTML = `<div class="feat-idle"><span class="live-dot idle"></span> No live ranked match right now</div>`; featStamp="none"; }
    return;
  }
  if(f.updated_at === featStamp) return;  // unchanged snapshot, skip re-render
  featStamp = f.updated_at;

  const standings = [...(f.standings||[])].sort((x,y)=>{
    const lx = x.place == null, ly = y.place == null;
    if(lx !== ly) return lx ? -1 : 1;                 // still-alive (live) players first
    if(lx){                                            // both live: better match record first
      if((y.wins||0) !== (x.wins||0)) return (y.wins||0) - (x.wins||0);
      return (x.losses||0) - (y.losses||0);
    }
    return (x.place||0) - (y.place||0);                // both placed: by finishing place
  });
  const allPlaced = standings.length && standings.every(s => s.place != null);
  const rows = standings.map(s => {
    const champ = s.is_champion ? ' 🏆' : '';
    const place = s.place != null ? `<span class="f-place">${ORD(s.place)}</span>` : `<span class="f-place live">live</span>`;
    const name = s.player_id
      ? `<a href="#profile" class="f-name" data-name="${esc(s.username)}">${esc(s.username)}${champ}</a>`
      : `<span class="f-name">${esc(s.username)}${champ}</span>`;
    return `<div class="f-row">${place}${name}<span class="f-rating">${s.rating!=null?Math.round(s.rating):"-"}</span><span class="f-wl"><span class="w">${s.wins||0}W</span> <span class="l">${s.losses||0}L</span></span></div>`;
  }).join("");
  const mins = f.started_at ? Math.max(0, Math.round((Date.now()-new Date(f.started_at))/60000)) : null;
  const upd  = f.updated_at ? Math.max(0, Math.round((Date.now()-new Date(f.updated_at))/60000)) : null;
  box.innerHTML = `<div class="feat-card">
    <div class="feat-head">
      <div class="feat-title"><span class="live-dot"></span> ${allPlaced ? "Latest Match" : "Featured Live Match"}</div>
      <div class="feat-meta">Avg ${Math.round(f.avg_rating||0)} · ${f.player_count||standings.length} players${mins!=null?` · live ${mins}m`:""}</div>
    </div>
    <div class="feat-rows">
      <div class="f-row f-head"><span>#</span><span>Player</span><span class="f-rating">Rating</span><span class="f-wl">Match W/L</span></div>
      ${rows}
    </div>
    ${upd!=null ? `<div class="feat-foot">updated ${upd}m ago</div>` : ""}
  </div>`;
  box.querySelectorAll(".f-name[data-name]").forEach(el => el.addEventListener("click", e => { e.preventDefault(); showProfile(el.dataset.name); }));
}

/* =========================================================================
   SITE TOTALS  (read-only `site_totals` view)
   ========================================================================= */
async function renderTotals(){
  const box = $("totals"); if(!box) return;
  let t = null;
  try{ const { data } = await sb.from("site_totals").select("*").single(); t = data; }
  catch(e){ box.innerHTML=""; return; }
  if(!t){ box.innerHTML=""; return; }
  const rel = iso => {
    if(!iso) return "-";
    const m = Math.round((Date.now()-new Date(iso))/60000);
    if(m < 1) return "just now";
    if(m < 60) return m+"m ago";
    const h = Math.round(m/60);
    if(h < 24) return h+"h ago";
    return Math.round(h/24)+"d ago";
  };
  const players      = t.overall_players ?? t.total_players_played ?? t.total_players ?? 0;
  const games        = t.overall_games ?? t.total_games ?? 0;
  const rankedGames  = t.ranked_games ?? 0;
  const rankedPlayers= t.ranked_players ?? t.total_players_played ?? 0;
  const rankedWeek   = t.ranked_games_7d ?? 0;   // ranked 7d is clean; overall_games_7d is inflated
  box.innerHTML = `<div class="tot-tiles">
      <div class="tot"><b>${players}</b><span>Players</span></div>
      <div class="tot"><b>${games}</b><span>Games</span></div>
      <div class="tot"><b>${rankedGames}</b><span>Ranked Games</span></div>
      <div class="tot"><b>${rankedPlayers}</b><span>Ranked Players</span></div>
    </div>
    <div class="tot-strip">${rankedWeek} ranked games this week · last game ${rel(t.last_game_ended_at)}</div>`;
}

renderFeatured(); setInterval(renderFeatured, 60000);
renderTotals();   setInterval(renderTotals, 60000);
