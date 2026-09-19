const LEGACY_KEY = "theNudgeLog.entries.v1";
const DATA_KEY = "theNudgeLog.data.v2";
const SYNC_KEY = "theNudgeLog.syncKey.v1";

const state = { person:null, type:null, requested:null, keptGoing:null, note:"" };

const els = {
  form:document.getElementById("nudgeForm"),
  note:document.getElementById("note"),
  noteCount:document.getElementById("noteCount"),
  message:document.getElementById("formMessage"),
  range:document.getElementById("rangeFilter"),
  total:document.getElementById("totalCount"),
  unasked:document.getElementById("unaskedCount"),
  kept:document.getElementById("keptGoingCount"),
  personBreakdown:document.getElementById("personBreakdown"),
  typeBreakdown:document.getElementById("typeBreakdown"),
  recent:document.getElementById("recentEntries"),
  clearAll:document.getElementById("clearAllBtn"),
  exportBtn:document.getElementById("exportBtn"),
  clearForm:document.getElementById("clearFormBtn"),
  quickAdd:document.getElementById("quickAddBtn"),
  personRangeLabel:document.getElementById("personRangeLabel"),
  syncStatus:document.getElementById("syncStatus"),
  syncSetup:document.getElementById("syncSetup"),
  syncLinked:document.getElementById("syncLinked"),
  syncKeyInput:document.getElementById("syncKeyInput"),
  generateSyncKey:document.getElementById("generateSyncKeyBtn"),
  linkSync:document.getElementById("linkSyncBtn"),
  syncNow:document.getElementById("syncNowBtn"),
  copySyncKey:document.getElementById("copySyncKeyBtn"),
  unlinkSync:document.getElementById("unlinkSyncBtn"),
  lastSyncText:document.getElementById("lastSyncText")
};

function migrateLegacy(){
  if(localStorage.getItem(DATA_KEY)) return;
  try{
    const entries = JSON.parse(localStorage.getItem(LEGACY_KEY)) || [];
    localStorage.setItem(DATA_KEY, JSON.stringify({entries,deletedIds:[]}));
  }catch{
    localStorage.setItem(DATA_KEY, JSON.stringify({entries:[],deletedIds:[]}));
  }
}

function loadData(){
  migrateLegacy();
  try{
    const data = JSON.parse(localStorage.getItem(DATA_KEY));
    return {
      entries:Array.isArray(data?.entries)?data.entries:[],
      deletedIds:Array.isArray(data?.deletedIds)?data.deletedIds:[]
    };
  }catch{
    return {entries:[],deletedIds:[]};
  }
}

function saveData(data){
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function getSyncKey(){ return localStorage.getItem(SYNC_KEY) || ""; }

function setChoice(field,value,button){
  state[field]=value;
  document.querySelectorAll(`[data-field="${field}"]`).forEach(el=>el.classList.toggle("selected",el===button));
}

document.querySelectorAll("[data-field]").forEach(button=>{
  button.addEventListener("click",()=>setChoice(button.dataset.field,button.dataset.value,button));
});

els.note.addEventListener("input",()=>{
  state.note=els.note.value.trim();
  els.noteCount.textContent=els.note.value.length;
});

function resetForm(){
  Object.assign(state,{person:null,type:null,requested:null,keptGoing:null,note:""});
  document.querySelectorAll("[data-field]").forEach(el=>el.classList.remove("selected"));
  els.note.value="";
  els.noteCount.textContent="0";
  els.message.textContent="";
}
els.clearForm.addEventListener("click",resetForm);

els.form.addEventListener("submit",event=>{
  event.preventDefault();
  const missing=[];
  if(!state.person) missing.push("who");
  if(!state.type) missing.push("what kind");
  if(!state.requested) missing.push("whether input was asked for");
  if(!state.keptGoing) missing.push("whether it kept going");
  if(missing.length){
    els.message.textContent="Almost there. Pick "+missing.join(", ")+".";
    return;
  }
  const data=loadData();
  data.entries.unshift({
    id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),
    person:state.person,
    type:state.type,
    requested:state.requested,
    keptGoing:state.keptGoing,
    note:els.note.value.trim(),
    createdAt:new Date().toISOString()
  });
  saveData(data);
  els.message.textContent="Logged. Tiny data point captured.";
  setTimeout(resetForm,700);
  renderDashboard();
  syncWithServer({quiet:true});
});

function filteredEntries(){
  const all=loadData().entries;
  const value=els.range.value;
  if(value==="all") return all;
  const cutoff=new Date();
  cutoff.setDate(cutoff.getDate()-Number(value));
  return all.filter(entry=>new Date(entry.createdAt)>=cutoff);
}

function countBy(entries,key){
  return entries.reduce((acc,entry)=>{
    const value=entry[key];
    acc[value]=(acc[value]||0)+1;
    return acc;
  },{});
}

function renderBreakdown(target,counts,order){
  const total=Object.values(counts).reduce((sum,n)=>sum+n,0);
  if(!total){
    target.className="breakdown-list empty-state";
    target.textContent="No entries yet.";
    return;
  }
  target.className="breakdown-list";
  target.innerHTML=order.filter(label=>counts[label]).map(label=>{
    const count=counts[label];
    const pct=Math.round((count/total)*100);
    return `<div class="breakdown-row">
      <div class="breakdown-label">${label}</div>
      <div class="bar-track" aria-label="${label}: ${count}"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="breakdown-count">${count}</div>
    </div>`;
  }).join("");
}

function formatTime(iso){
  return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(iso));
}

function escapeHtml(value){
  return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function renderRecent(entries){
  const recent=entries.slice(0,12);
  if(!recent.length){
    els.recent.className="entry-list empty-state";
    els.recent.textContent="Nothing logged yet.";
    return;
  }
  els.recent.className="entry-list";
  els.recent.innerHTML=recent.map(entry=>`
    <article class="entry">
      <div>
        <div class="entry-title">${escapeHtml(entry.person)} · ${escapeHtml(entry.type)}</div>
        <div class="entry-meta">${formatTime(entry.createdAt)} · input asked for: ${entry.requested} · kept going: ${entry.keptGoing}</div>
        ${entry.note?`<div class="entry-note">${escapeHtml(entry.note)}</div>`:""}
      </div>
      <button class="entry-delete" type="button" data-delete-id="${entry.id}" aria-label="Delete entry">×</button>
    </article>`).join("");

  els.recent.querySelectorAll("[data-delete-id]").forEach(button=>{
    button.addEventListener("click",()=>{
      const data=loadData();
      const id=button.dataset.deleteId;
      data.entries=data.entries.filter(entry=>entry.id!==id);
      if(!data.deletedIds.includes(id)) data.deletedIds.push(id);
      saveData(data);
      renderDashboard();
      syncWithServer({quiet:true});
    });
  });
}

function renderDashboard(){
  const entries=filteredEntries();
  els.total.textContent=entries.length;
  els.unasked.textContent=entries.filter(entry=>entry.requested==="no").length;
  els.kept.textContent=entries.filter(entry=>entry.keptGoing==="yes").length;
  renderBreakdown(els.personBreakdown,countBy(entries,"person"),["Jen","Blake","Porter"]);
  renderBreakdown(els.typeBreakdown,countBy(entries,"type"),["Direct","Correct","Justify","Monitor","Handoff"]);
  renderRecent(entries);
  els.personRangeLabel.textContent=els.range.options[els.range.selectedIndex].text;
}
els.range.addEventListener("change",renderDashboard);

els.clearAll.addEventListener("click",()=>{
  const data=loadData();
  if(!data.entries.length) return;
  if(!window.confirm("Clear every Nudge Log entry? Linked devices will also clear after sync.")) return;
  data.deletedIds=[...new Set([...data.deletedIds,...data.entries.map(entry=>entry.id)])];
  data.entries=[];
  saveData(data);
  renderDashboard();
  syncWithServer({quiet:true});
});

els.exportBtn.addEventListener("click",()=>{
  const entries=loadData().entries;
  if(!entries.length){ window.alert("Nothing to export yet."); return; }
  const rows=[
    ["date_time","person","type","input_asked_for","kept_going","note"],
    ...entries.map(entry=>[entry.createdAt,entry.person,entry.type,entry.requested,entry.keptGoing,entry.note||""])
  ];
  const csv=rows.map(row=>row.map(csvCell).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download=`nudge-log-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();link.remove();URL.revokeObjectURL(url);
});

function csvCell(value){ return `"${String(value??"").replaceAll('"','""')}"`; }

function generateSyncKey(){
  const bytes=new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}

function renderSyncState(){
  const linked=Boolean(getSyncKey());
  els.syncSetup.hidden=linked;
  els.syncLinked.hidden=!linked;
  els.syncStatus.textContent=linked?"Linked":"Not linked";
  els.syncStatus.classList.toggle("linked",linked);
  if(!linked) els.lastSyncText.textContent="";
}

els.generateSyncKey.addEventListener("click",()=>{
  els.syncKeyInput.value=generateSyncKey();
  els.syncKeyInput.type="text";
});

els.linkSync.addEventListener("click",async()=>{
  const key=els.syncKeyInput.value.trim();
  if(key.length<24){
    window.alert("Use the generated key or enter a private key at least 24 characters long.");
    return;
  }
  localStorage.setItem(SYNC_KEY,key);
  els.syncKeyInput.value="";
  renderSyncState();
  await syncWithServer({quiet:false});
});

els.unlinkSync.addEventListener("click",()=>{
  if(!window.confirm("Unlink this device? Your local data will stay here.")) return;
  localStorage.removeItem(SYNC_KEY);
  renderSyncState();
});

els.copySyncKey.addEventListener("click",async()=>{
  const key=getSyncKey();
  if(!key) return;
  try{
    await navigator.clipboard.writeText(key);
    els.lastSyncText.textContent="Sync key copied. Paste it into The Nudge Log on your other device.";
  }catch{
    window.prompt("Copy this sync key:",key);
  }
});

els.syncNow.addEventListener("click",()=>syncWithServer({quiet:false}));

async function syncWithServer({quiet=false}={}){
  const syncKey=getSyncKey();
  if(!syncKey) return;
  els.syncStatus.textContent="Syncing…";
  els.syncStatus.classList.add("linked");
  try{
    const local=loadData();
    const response=await fetch("/api/sync",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({syncKey,entries:local.entries,deletedIds:local.deletedIds})
    });
    if(!response.ok) throw new Error("Sync failed");
    const merged=await response.json();
    saveData({entries:merged.entries||[],deletedIds:merged.deletedIds||[]});
    renderDashboard();
    els.syncStatus.textContent="Synced";
    els.lastSyncText.textContent="Last synced "+new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date());
    if(!quiet) els.lastSyncText.textContent+=" · both devices can now use the same key.";
  }catch(error){
    els.syncStatus.textContent="Sync issue";
    els.lastSyncText.textContent="Could not reach sync right now. Local logging still works.";
  }
}

function switchTab(tabId){
  document.querySelectorAll(".tab-panel").forEach(panel=>panel.classList.toggle("active",panel.id===tabId));
  document.querySelectorAll(".nav-button").forEach(button=>button.classList.toggle("active",button.dataset.tab===tabId));
  if(tabId==="dashboardTab") renderDashboard();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".nav-button").forEach(button=>button.addEventListener("click",()=>switchTab(button.dataset.tab)));
els.quickAdd.addEventListener("click",()=>switchTab("logTab"));

document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") syncWithServer({quiet:true}); });
window.addEventListener("focus",()=>syncWithServer({quiet:true}));

renderSyncState();
renderDashboard();
syncWithServer({quiet:true});
