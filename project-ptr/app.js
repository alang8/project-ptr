/* =========================================================================
   Project PTR front-end logic
   Config: edit DISCORD_URL when you have an invite. SUPABASE_KEY is the
   read-only publishable key (safe in the browser). Never put a secret key here.
   ========================================================================= */
const SUPABASE_URL = "https://rbvezddypfpjepofngqb.supabase.co";
const SUPABASE_KEY = "sb_publishable_Tk-w3eZYTevhw8-5jxBOwg_MPaH4778";
const DISCORD_URL  = "#";          // <-- paste your Discord invite link
const TOP_N        = 100;          // ranks to display

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
}
document.querySelectorAll("[data-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));
window.addEventListener("hashchange", () => { const h=location.hash.slice(1); if($(h)) show(h); });
if(location.hash.slice(1) && $(location.hash.slice(1))) show(location.hash.slice(1));

/* =========================================================================
   LEADERBOARD  (read-only `leaderboard` view)
   ========================================================================= */
const MEDALS = {1:"🥇",2:"🥈",3:"🥉"};
let prevRatings = {};
async function fetchLeaderboard(){
  const { data, error, count } = await sb
    .from("leaderboard")
    .select("id,discord_id,username,rating,games,wins,losses,position", { count:"exact" })
    .order("position", { ascending:true })
    .range(0, TOP_N-1);
  if(error) throw error;
  return {
    total: count ?? data.length,
    rows: data.map(p => ({
      key:p.id||p.username, name:p.username||"Unknown player",
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
    return `<div class="row ${rank<=3?'top':''} ${ch?'flash':''}" style="animation-delay:${i*40}ms">
      <div class="rank">${rc}</div>
      <div class="player"><div class="handle">${esc(p.name)}</div><span class="hero">${games} game${games===1?'':'s'}</span></div>
      <div class="mmr">${p.rating}</div>
      <div class="record"><span class="w">${p.wins}W</span><span class="sep">/</span><span class="l">${p.losses}L</span><span class="wr">${wr}% WR</span></div>
    </div>`;
  }).join("");
  prevRatings = {}; list.forEach(p => prevRatings[p.key]=p.rating);
}
async function tickBoard(){ try{ renderBoard(await fetchLeaderboard()); }catch(e){ console.error(e); $("err").style.display="block"; } }
tickBoard(); setInterval(tickBoard, 30000);

/* =========================================================================
   AUTH + NAME LINKING
   ========================================================================= */
const DISCORD_MARK = '<img class="dico" src="assets/discord.png" alt="">';
const slot  = $("auth-slot");
const panel = $("account-panel");
let pollTimer = null;

function genCode(){ const a="ABCDEFGHJKMNPQRSTUVWXYZ23456789"; return Array.from({length:6},()=>a[Math.floor(Math.random()*a.length)]).join(""); }
function discordName(user){ const m=user.user_metadata||{}; return m.full_name||m.name||m.global_name||m.preferred_username||m.user_name||"Discord user"; }
function discordAvatar(user){ const m=user.user_metadata||{}; return m.avatar_url||m.picture||""; }

async function signIn(){
  await sb.auth.signInWithOAuth({ provider:"discord", options:{ redirectTo: location.origin } });
}
async function signOut(){ stopPolling(); await sb.auth.signOut(); }

function renderSlot(session){
  if(!slot) return;
  if(!session){ slot.innerHTML = `<button class="btn-discord" id="nav-signin">${DISCORD_MARK} Sign in</button>`; $("nav-signin").onclick=signIn; return; }
  const u=session.user, av=discordAvatar(u);
  slot.innerHTML = `<div class="user-chip">${av?`<img src="${esc(av)}" alt="">`:""}<span class="un">${esc(discordName(u))}</span><button id="nav-signout">Sign out</button></div>`;
  $("nav-signout").onclick=signOut;
}

async function renderAccount(session){
  if(!panel) return;
  if(!session){
    panel.innerHTML = `<p class="acct-muted" style="margin-bottom:18px">Sign in with Discord to get started.</p>
      <button class="btn-discord" id="acct-signin" style="margin:0 auto">${DISCORD_MARK} Sign in with Discord</button>`;
    $("acct-signin").onclick=signIn; return;
  }
  const u=session.user, av=discordAvatar(u);
  const head = `<div class="acct-row">${av?`<img src="${esc(av)}" alt="">`:""}<div class="who"><b>${esc(discordName(u))}</b><span>Signed in with Discord</span></div></div>`;

  // already linked?
  let linked=null;
  try{ const { data } = await sb.rpc("get_my_link"); linked = data || null; }catch(e){ /* rpc may not exist yet */ }
  if(linked){
    panel.innerHTML = head + `<div class="acct-linked">✅ Connected to <span class="nm">${esc(linked)}</span></div>
      <p class="acct-hint">Your results are tracked on the ladder under this name.</p>`;
    return;
  }

  // pending request?
  const { data:reqs } = await sb.from("link_requests").select("*").order("created_at",{ascending:false}).limit(1);
  const pending = reqs && reqs[0] && reqs[0].status==="pending" ? reqs[0] : null;
  if(pending){ renderPending(head, pending); startPolling(pending.id); return; }

  // claim form
  panel.innerHTML = head + `
    <div class="field"><input id="ign" type="text" placeholder="Your in-game name" maxlength="40" autocomplete="off"></div>
    <p class="acct-hint">Enter the exact name you use in The Bazaar, then confirm it in Discord.</p>
    <div class="acct-err" id="acct-err" style="display:none"></div>
    <button class="btn btn-gold" id="gen-code" style="margin-top:16px">Get my link code</button>`;
  $("gen-code").onclick = submitClaim;
}

function renderPending(head, req){
  panel.innerHTML = head + `
    <p class="acct-hint" style="margin-bottom:2px">To finish linking <b style="color:var(--ink)">${esc(req.requested_name)}</b>, run this in the Project PTR Discord:</p>
    <div class="codebox">
      <div class="lbl">Your one-time code</div>
      <div class="code">${esc(req.code)}</div>
      <div class="cmd"><b>/link</b> ${esc(req.code)}</div>
    </div>
    <div class="acct-status"><span class="spinner"></span> Waiting for confirmation in Discord...</div>
    <button class="btn btn-ghost" id="cancel-link" style="margin-top:16px">Cancel</button>`;
  $("cancel-link").onclick = async () => { stopPolling(); await sb.from("link_requests").delete().eq("id", req.id); refreshAuth(); };
}

async function submitClaim(){
  const name = ($("ign").value||"").trim();
  const errEl = $("acct-err");
  if(name.length<2){ errEl.textContent="Please enter your in-game name."; errEl.style.display="block"; return; }
  const { data:{ user } } = await sb.auth.getUser();
  await sb.from("link_requests").delete().eq("user_id", user.id).eq("status","pending");
  const code = genCode();
  const { error } = await sb.from("link_requests").insert({ user_id:user.id, requested_name:name, code, status:"pending" });
  if(error){ errEl.textContent="Couldn't start the request: "+error.message; errEl.style.display="block"; return; }
  refreshAuth();
}

function startPolling(reqId){
  stopPolling();
  pollTimer = setInterval(async () => {
    const { data } = await sb.from("link_requests").select("status,requested_name").eq("id", reqId).maybeSingle();
    if(!data) return;
    if(data.status==="linked"){ stopPolling(); refreshAuth(); }
    else if(data.status==="rejected" || data.status==="needs_review"){ stopPolling(); showRejected(data.requested_name, data.status); }
  }, 4000);
}
function stopPolling(){ if(pollTimer){ clearInterval(pollTimer); pollTimer=null; } }
function showRejected(name, status){
  const s = panel.querySelector(".acct-status");
  const msg = status==="needs_review"
    ? "This claim needs an organizer to review it. Hang tight or reach out in Discord."
    : "That name couldn't be verified for your account. Double-check the name or ask an organizer.";
  if(s) s.innerHTML = `<span class="acct-err">${msg}</span>`;
}

async function refreshAuth(){ const { data:{ session } } = await sb.auth.getSession(); renderSlot(session); renderAccount(session); }

sb.auth.onAuthStateChange((event, session) => {
  renderSlot(session); renderAccount(session);
  if(event==="SIGNED_IN" && location.hash.slice(1)!=="account") show("account");
});
refreshAuth();
