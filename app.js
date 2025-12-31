
let db;
let SQL;
let currentEditId = null;

async function initDB() {
  SQL = await initSqlJs({ locateFile: f => f });

  const saved = await loadFromIndexedDB();
  if (saved) db = new SQL.Database(saved);
  else {
    db = new SQL.Database();
    createTables();
    saveToIndexedDB();
  }
  renderProfiles();
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      status TEXT,
      created_at TEXT,
      websites TEXT,
      payments TEXT,
      logs TEXT
    );
  `);
}

function addProfile() {
  const name = prompt("Profile name?");
  if (!name) return;
  const stmt = db.prepare(`
    INSERT INTO profiles (name,status,created_at,websites,payments,logs)
    VALUES (?, 'live', datetime('now'), '[]', '{}', '[]');
  `);
  stmt.run([name]);
  stmt.free();
  saveToIndexedDB();
  renderProfiles();
}

function deleteProfile(id) {
  db.run("DELETE FROM profiles WHERE id=" + id);
  saveToIndexedDB();
  renderProfiles();
}

function renderProfiles() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const list = document.getElementById('profileList');
  list.innerHTML = "";
  const res = db.exec("SELECT * FROM profiles ORDER BY id DESC");
  if (res.length===0){ list.innerHTML="<i>No profiles.</i>"; return; }
  const rows = res[0].values;

  rows.filter(r=>r[1].toLowerCase().includes(q)).forEach(r=>{
    const [id,name,status] = r;
    const div=document.createElement("div");
    div.className="profile";
    div.innerHTML=`
      <b>${name}</b> (ID: ${id})<br>
      Status: ${status}<br><br>
      <button onclick="openProfile(${id})">Open</button>
      <button onclick="deleteProfile(${id})">Delete</button>
      <button onclick="editProfile(${id})">Edit</button>
    `;
    list.appendChild(div);
  });
}

function openProfile(id){ alert("Call Firefox with profile: "+id); }

function editProfile(id){
  currentEditId = id;
  const res = db.exec("SELECT * FROM profiles WHERE id="+id)[0].values[0];
  const [pid,name,status,created,websites,payments,logs] = res;

  const body = `
    <label>Name</label><br>
    <input id="editName" value="${name}"><br><br>

    <label>Status</label><br>
    <select id="editStatus">
      <option value="live" ${status==='live'?'selected':''}>live</option>
      <option value="lock" ${status==='lock'?'selected':''}>lock</option>
    </select><br><br>

    <label>Websites (JSON array)</label><br>
    <textarea id="editWebsites">${websites}</textarea><br><br>

    <label>Payment (JSON object)</label><br>
    <textarea id="editPayments">${payments}</textarea><br><br>

    <label>Logs (JSON array)</label><br>
    <textarea id="editLogs">${logs}</textarea>
  `;
  document.getElementById("modalBody").innerHTML = body;
  document.getElementById("editModal").style.display="block";
}

function closeModal(){
  document.getElementById("editModal").style.display="none";
}

function saveProfile(){
  const name = document.getElementById("editName").value;
  const status = document.getElementById("editStatus").value;
  const websites = document.getElementById("editWebsites").value;
  const payments = document.getElementById("editPayments").value;
  const logs = document.getElementById("editLogs").value;

  const stmt = db.prepare(`
    UPDATE profiles
    SET name=?, status=?, websites=?, payments=?, logs=?
    WHERE id=?
  `);

  stmt.run([name,status,websites,payments,logs,currentEditId]);
  stmt.free();
  saveToIndexedDB();
  closeModal();
  renderProfiles();
}

document.getElementById("searchInput").addEventListener("input", renderProfiles);

function exportDB(){
  const data=db.export();
  const blob=new Blob([data],{type:"application/octet-stream"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="profiles.sqlite";
  a.click();
}

async function importDB(e){
  const buf=await e.target.files[0].arrayBuffer();
  db=new SQL.Database(new Uint8Array(buf));
  saveToIndexedDB();
  renderProfiles();
}

function saveToIndexedDB(){
  const data=db.export();
  const req=indexedDB.open("profileDB3",1);
  req.onupgradeneeded=()=>req.result.createObjectStore("files");
  req.onsuccess=()=>{
    const tx=req.result.transaction("files","readwrite");
    tx.objectStore("files").put(data,"profiles");
  };
}

function loadFromIndexedDB(){
  return new Promise(resolve=>{
    const req=indexedDB.open("profileDB3",1);
    req.onupgradeneeded=()=>req.result.createObjectStore("files");
    req.onsuccess=()=>{
      const tx=req.result.transaction("files","readonly");
      const get=tx.objectStore("files").get("profiles");
      get.onsuccess=()=>resolve(get.result||null);
    };
  });
}

initDB();
