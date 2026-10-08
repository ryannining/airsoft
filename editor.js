/* ============================================
   Editor UI 3D - port dari interaktif/script.js (2D)
   Chips aksi, timeline, loop/speed, mode editor, save/load
   (server API dengan fallback localStorage), modal +Aksi,
   dblclick objek -> sisip nama ke script.

   File hasil build-standalone TANPA panel editor: markup
   #scriptPane/#modal/#btnEditor di-strip saat compile, sehingga
   HAS_PANEL=false dan semua wiring panel dilewati — yang tersisa
   player murni (chips + timeline + loop/speed).
   ============================================ */

const $ = (id) => document.getElementById(id);

// --- panel editor: NULL di file standalone (markup di-strip build) ---
const scriptArea = $('scriptArea');
const applyBtn = $('applyBtn');
const addActionBtn = $('addActionBtn');
const saveBtn = $('saveBtn');
const consoleOut = $('consoleOut');
const modeBtn = $('btnEditor');
const closeScriptBtn = $('btnCloseScript');
const modal = $('modal');
const HAS_PANEL = !!(scriptArea && applyBtn && modeBtn);

// --- player: selalu ada (transport bar) ---
const actionList = $('actionList');
const loopToggle = $('loopToggle');
const pauseBtn = $('btnPause');
const stopBtn = $('btnStop');
const speedSlider = $('speedSlider');
const speedValue = $('speedValue');
const textOverlay = $('textOverlay');
const statusEl = $('status');
const timelineProgress = $('timelineProgress');
const timelineCursor = $('timelineCursor');
const timelineLabels = $('timelineLabels');
const lastActionLabel = $('lastActionLabel');
const timelineBar = $('timelineBar');
const testBox = $('testBox');
const testArea = $('testScript');
const testPlayBtn = $('testPlay');
const testCloseBtn = $('testClose');
const testToggleBtn = $('btnTest');

const MODEL_CFG = window.MODEL || {};
const MODEL_ID = window.MODEL_ID || MODEL_CFG.id || 'f03';
const STORE_KEY = 'action_script_3d_' + MODEL_ID;
const API_URL = '/airsoft-order/api/data/' + (MODEL_CFG.animKey || 'action_script_3d');

let player = null;
let actions = new Map();          // name -> { steps, duration }
let currentSpeed = 1;
let lastActionName = null;
let editorOn = false;

const DEFAULT_SCRIPT = `# === Contoh animasi F03 (3D) ===
# G01..G08 = grup (ikut semua anaknya) · angka = objek per ID · selain itu nama
# Duplikat nama (mis. BB) ikut bersama-sama. dblclick baris list -> sisip ID.
# ID = angka di kanan nama objek pada list (mulai 1, urut saat load).
# Grup custom — boleh di mana saja sebelum dipakai; token diproses berurutan:
#   G11=G04,-20,-21,22  = mulai member G04, hapus ID 20 & 21, tambah ID 22
#   pakai juga -G05 (kurangi member grup) atau N / -N (tambah/hapus objek ID N)
# Judul aksi: >nama  atau  >Nama Indonesia,Nama English (koma = pemisah bahasa)
# Compose: blok ">Nama" kosong lalu +aksi1 / +aksi2, ATAU "+aksi" di ekor aksi =
#   gabung aksi itu + ref (mis. aksi "Loading BB" ditutup dgn +Menembak)
# Param gerak: X,Y,Z geser (mm) · R putar Z, RX putar X, RY putar Y (±deg) · O opacity · SX,SY,SZ scale
#   (pivot rotasi default = pusat objek; bisa digeser dgn ,px,py di belakang nilai contoh RX45,0,-10)
# Aksi state & kamera (waktu = ms absolut · @a-b / @a+d = gerak mulus):
#   Waktu relatif: @+N = N ms setelah akhir baris sebelumnya (N boleh negatif,
#     mis. @+-1000+1000). @1000-2000 lalu @+100+200 -> @2100+200 — enak utk menyisipkan step.
#     Tanpa durasi (@+-1000,obj,X5) = set nilai langsung, tanpa animasi
#   @0,T,Teks Indonesia,Teks English  overlay teks 2 bahasa (koma = pemisah bahasa)
#   @7000,S,G04,on         section ON utk semua objek G04 (on/off)
#   @5000+1200,CF,G05,300  pan kamera ke G05, jarak 300mm (tanpa durasi = snap)
#   @4000,P                jeda — tunggu klik ▶ Lanjut (@4000,P,1000 = auto 1s)
# CF hanya mengendalikan kamera SELAMA rangenya (snap: satu saat) — setelah
# itu kontrol kamera lepas lagi. Selesai aksi (tiap putaran loop): section &
# kamera kembali ke kondisi awal sebelum play.

>contoh: geser daleman pompa,Example: move pump internals
@0,T,Daleman pompa maju keluar,Pump internals moving out
@0+800,G05,X-40
@800+800,G05,X0

>contoh: putar picu
@0-400,G01_picu,R-15
@400-800,G01_picu,R0
@0,T,Picu diputar

>contoh: sembunyikan magasin
@0+600,G02_magasin,O0
@600+600,G02_magasin,O1

>contoh: grup custom (G04 minus objek 20,21 plus 22)
G11=G04,-20,-21,22
@0+800,G11,X+40
@800+800,G11,X0

>contoh: compose (gabung dua aksi)
+contoh: geser daleman pompa
+contoh: putar picu
`;

function log(msg, cls = 'log-info') {
  const t = new Date().toTimeString().slice(0, 8);
  if (consoleOut) {
    consoleOut.innerHTML += `<span class="${cls}">[${t}] ${msg}</span>\n`;
    consoleOut.parentElement.scrollTop = consoleOut.parentElement.scrollHeight;
  } else {
    console.log(`[${t}] ${msg}`);
  }
}

function __L(k, fb) { return window.__t ? window.__t(k) : fb; }
function __TF(k, vars, fb) { return window.__tf ? window.__tf(k, vars) : fb; }
/* Label aksi sesuai bahasa aktif (judul boleh 2 bahasa: >namaIND,namaENG) */
function actionLabel(a) {
  if (!a) return '';
  return (window.__lang === 'id' || !a.nameEn) ? a.name : a.nameEn;
}
function setStatus(s) { if (statusEl) statusEl.textContent = s; }

/* ---------- Simpan / muat script ---------- */
async function saveScript() {
  if (!scriptArea) return;
  const payload = { script: scriptArea.value, savedAt: Date.now() };
  try {
    const r = await fetch(API_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    log('Script tersimpan ke server', 'log-ok');
    setStatus(__L('statusSaved', 'Saved'));
  } catch (e) {
    // Fallback: localStorage (mis. dibuka tanpa server / API gagal)
    try {
      localStorage.setItem(STORE_KEY, scriptArea.value);
      log('Server gagal (' + e.message + ') — script tersimpan di localStorage', 'log-info');
      setStatus(__L('statusSavedLocal', 'Saved (lokal)'));
    } catch (e2) {
      log('Gagal simpan: ' + e2.message, 'log-err');
    }
  }
}

async function loadScript() {
  // file:// (dobel-klik) tidak bisa fetch -> langsung pakai script tersemat
  if (location.protocol !== 'file:') {
    try {
      const r = await fetch(API_URL, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && j.data && typeof j.data.script === 'string') {
          log('Script dimuat dari server', 'log-ok');
          return j.data.script;
        }
      }
    } catch (e) { /* server tidak ada — lanjut fallback */ }
  }
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) { log('Script dimuat dari localStorage', 'log-info'); return saved; }
  } catch (e) { /* ignore */ }
  // File hasil build-standalone: script terakhir dari server disematkan di file
  if (typeof window.EMBEDDED_SCRIPT === 'string' && window.EMBEDDED_SCRIPT) {
    log('Script bawaan file (disematkan saat compile)', 'log-info');
    return window.EMBEDDED_SCRIPT;
  }
  log('Script contoh dimuat', 'log-info');
  return DEFAULT_SCRIPT;
}

/* ---------- Apply / validasi / daftar chip ---------- */
function applyScript(textOverride) {
  if (!player || !window.__f03 || !window.__f03.ready()) {
    log('Model belum siap — tunggu pemuatan selesai', 'log-err');
    return;
  }
  const text = textOverride !== undefined
    ? textOverride
    : (scriptArea ? scriptArea.value : '');
  player.stop();
  const result = player.parseScript(text);
  if (result.error) {
    log('Parse error: ' + result.error, 'log-err');
    setStatus(__L('statusParseErr', 'Parse error'));
    return;
  }
  actions = player.actions;

  // validasi semua target ada
  const missing = [];
  const seen = new Set();
  for (const a of actions.values()) {
    for (const s of a.steps) {
      const ref = (s.isSection || s.isCam) ? s.target : s.objId;
      if (s.isText || s.isPause || seen.has(ref)) continue;
      seen.add(ref);
      if (!window.__f03.resolveTarget(ref)) missing.push(ref);
    }
  }
  if (missing.length) log('Objek hilang: ' + missing.join(', '), 'log-err');

  log(`Loaded ${actions.size} aksi: ${[...actions.keys()].join(', ')}`, 'log-ok');
  setStatus(__TF('actions', { n: actions.size }, actions.size + ' aksi'));
  renderActionList();
}

function renderActionList() {
  if (!actionList) return;
  actionList.innerHTML = '';
  for (const [name, action] of actions) {
    const chip = document.createElement('span');
    chip.className = 'action-chip';
    chip.dataset.name = name;
    const label = document.createElement('span');
    label.className = 'chip-label';
    label.textContent = '▶ ' + actionLabel(action);
    const count = document.createElement('span');
    count.className = 'step-count';
    count.textContent = action.steps.length;
    chip.appendChild(label);
    chip.appendChild(count);
    chip.title = `Durasi: ${action.duration}ms, ${action.steps.length} steps\nKlik untuk run`;
    chip.addEventListener('click', () => playAction(name));
    actionList.appendChild(chip);
  }
  document.body.classList.toggle('has-actions', actions.size > 0);
  if (actions.size === 0) {
    actionList.innerHTML = '<span class="hint-inline">Tidak ada aksi — klik Terapkan di panel script.</span>';
  }
}
window.__refreshActions = renderActionList;

/* Scale semua waktu step (untuk slider speed) — port dari 2D */
function scaleActionTime(action, factor) {
  return {
    name: action.name,
    nameEn: action.nameEn,
    duration: action.duration * factor,
    steps: action.steps.map(s => ({
      ...s,
      start: s.start * factor,
      end: s.end * factor,
      from: s.from ? { ...s.from } : s.from,
      to: s.to ? { ...s.to } : s.to,
      text: s.text,
      isText: s.isText
    }))
  };
}

function renderTimeline(action) {
  if (!timelineLabels) return;
  timelineLabels.innerHTML = '';
  const total = action.duration || 1;
  const times = [...new Set(action.steps.map(s => s.start))];
  let shown = 0;
  for (const t of times) {
    if (shown >= 12) break;                    // batasi agar tidak menumpuk
    const step = action.steps.find(s => s.start === t);
    const lbl = document.createElement('span');
    lbl.className = 'tl';
    lbl.style.left = Math.min(97, (t / total) * 100).toFixed(1) + '%';
    lbl.textContent = `[${Math.round(t)}] ${step.isText ? 'T' : step.isSection ? 'S' : step.isCam ? 'CF' : step.isPause ? 'P' : step.objId}`;
    timelineLabels.appendChild(lbl);
    shown++;
  }
}

/* Tombol Pause/Stop — dipanggil juga oleh player lewat onPauseState */
function transportUI(paused, autoMs) {
  pauseBtn.textContent = paused ? '▶ Lanjut' : '⏸ Jeda';
  pauseBtn.classList.toggle('on', paused);
  if (paused) setStatus(autoMs > 0 ? __TF('statusPausedAuto', { ms: autoMs }, `Jeda otomatis ${autoMs}ms`) : __L('statusPaused', 'Jeda — klik ▶ Lanjut'));
}

function playAction(name) {
  if (!player) return;
  if (actions.size === 0) {
    log('Belum ada aksi — klik Terapkan dulu', 'log-err');
    return;
  }
  let action = actions.get(name);
  if (!action) {
    // fuzzy match
    for (const [k, a] of actions) {
      if (k.startsWith(name) || k.includes(name) || (a.nameEn && a.nameEn.includes(name))) {
        action = a; name = k; break;
      }
    }
  }
  if (!action) {
    log('Aksi tidak ditemukan: ' + name, 'log-err');
    log('Tersedia: ' + [...actions.keys()].join(', '), 'log-info');
    return;
  }
  lastActionName = name;
  if (lastActionLabel) {
    const lbl = actionLabel(action);
    lastActionLabel.textContent = lbl;
    lastActionLabel.title = __L('lastActionTitle', 'Aksi terakhir') + ': ' + lbl;
  }
  log(`▶ ${name} (${action.duration}ms, ${action.steps.length} steps)`, 'log-info');
  player.loop = loopToggle.checked;

  const scaled = scaleActionTime(action, 1 / currentSpeed);
  player._playScaled = scaled;
  player.onProgress = (frac, t, total) => {
    const pct = (frac * 100).toFixed(1);
    if (timelineProgress) timelineProgress.style.width = pct + '%';
    if (timelineCursor) timelineCursor.style.left = pct + '%';
    if (!player.paused) setStatus(`${name}: ${t.toFixed(0)}ms / ${total.toFixed(0)}ms`);
  };
  player.onTextChange = (text) => {
    if (!textOverlay) return;
    if (text) {
      textOverlay.textContent = text;
      textOverlay.classList.add('show');
    } else {
      textOverlay.classList.remove('show');
    }
  };
  player.onComplete = () => {
    // section cap posisinya basi saat playback -> rebuild saat selesai
    if (window.__f03) window.__f03.secRebuild();
    transportUI(false, 0);
    if (!player.loop) { pauseBtn.disabled = true; stopBtn.disabled = true; }
  };
  renderTimeline(scaled);
  // tandai chip aktif
  if (actionList) {
    for (const c of actionList.children) c.classList.toggle('active', c.dataset.name === name);
  }
  transportUI(false, 0);
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  player.play(name);
}

/* ---------- Test box (dev): quick parse & play 1x ---------- */
function playTest() {
  if (!player || !testArea) return;
  const text = testArea.value.replace(/\r/g, '').trim();
  if (!text) { log('Test masih kosong', 'log-err'); return; }

  // Parse di player terpisah supaya aksi editor (custom group, pivotCache)
  // tidak terganggu. defineCustomGroups dinonaktifkan sementara.
  const F = window.__f03;
  const savedDef = F ? F.defineCustomGroups : null;
  if (F) F.defineCustomGroups = null;
  const tp = new ActionPlayer();
  const res = tp.parseScript('>test\n' + text);
  if (F) F.defineCustomGroups = savedDef;
  if (res && res.error) { log('Test parse error: ' + res.error, 'log-err'); return; }

  const action = tp.actions.get('test');
  if (!action || !action.steps.length) { log('Test tidak menghasilkan step', 'log-err'); return; }

  // pivot dari script test digabung ke player utama -> penanda pivot ikut tampil
  if (!player.pivotCache) player.pivotCache = new Map();
  tp.pivotCache.forEach((v, k) => player.pivotCache.set(k, v));

  player.stop();
  player.loop = false;                     // selalu 1x
  player._playScaled = scaleActionTime(action, 1);
  player.onProgress = (frac, t, total) => {
    const pct = (frac * 100).toFixed(1);
    if (timelineProgress) timelineProgress.style.width = pct + '%';
    if (timelineCursor) timelineCursor.style.left = pct + '%';
    if (!player.paused) setStatus('TEST: ' + t.toFixed(0) + 'ms / ' + total.toFixed(0) + 'ms');
  };
  player.onTextChange = (txt) => {
    if (!textOverlay) return;
    if (txt) { textOverlay.textContent = txt; textOverlay.classList.add('show'); }
    else textOverlay.classList.remove('show');
  };
  player.onComplete = () => {
    if (window.__f03) window.__f03.secRebuild();
    transportUI(false, 0);
    pauseBtn.disabled = true;
    stopBtn.disabled = true;
  };
  transportUI(false, 0);
  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  if (lastActionLabel) lastActionLabel.textContent = 'test';
  log(`▶ TEST (${action.duration}ms, ${action.steps.length} steps)`, 'log-info');
  player.play('test');
}

if (testPlayBtn) testPlayBtn.addEventListener('click', playTest);
if (testCloseBtn) testCloseBtn.addEventListener('click', function () { testBox.style.display = 'none'; });
if (testToggleBtn && testBox) testToggleBtn.addEventListener('click', function () {
  testBox.style.display = (testBox.style.display === 'none') ? 'block' : 'none';
});

/* ---------- Mode editor (hanya bila panel ada) ---------- */
function setEditor(on) {
  if (!HAS_PANEL) return;
  editorOn = on;
  document.body.classList.toggle('editor-on', on);
  if (modeBtn) modeBtn.classList.toggle('on', on);
  if (on) scriptArea.focus();
}

/* Sisip teks ke textarea di posisi kursor (dipanggil dari index.html via bridge) */
function insertAtCursor(text) {
  if (!scriptArea) return;
  const pos = scriptArea.selectionStart;
  const before = scriptArea.value.slice(0, pos);
  const after = scriptArea.value.slice(pos);
  scriptArea.value = before + text + after;
  scriptArea.focus();
  scriptArea.selectionStart = scriptArea.selectionEnd = pos + text.length;
}

/* ---------- Wiring panel editor (dilewati di standalone) ---------- */
function wirePanel() {
  applyBtn.addEventListener('click', () => {
    applyScript();
    // mode player (editor tertutup) -> auto-play aksi pertama (paritas 2D)
    if (!editorOn && actions.size > 0) {
      playAction([...actions.keys()][0]);
    }
  });
  saveBtn.addEventListener('click', saveScript);
  modeBtn.addEventListener('click', () => setEditor(!editorOn));
  closeScriptBtn.addEventListener('click', () => setEditor(false));

  addActionBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
    $('modalName').value = '';
    $('modalName').focus();
  });
  $('modalCancel').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  $('modalOk').addEventListener('click', () => {
    const name = $('modalName').value.trim();
    const type = $('modalType').value;
    if (!name) return;
    const insertion = type === 'steps'
      ? `\n\n>${name}\n@500,G05,X+30\n`
      : `\n\n>${name}\n+existing_action\n`;
    scriptArea.value = scriptArea.value.trimEnd() + insertion;
    modal.style.display = 'none';
    log('Aksi baru ditambahkan: ' + name, 'log-info');
  });
}

/* ---------- Wiring player (selalu ada) ---------- */
speedSlider.addEventListener('input', e => {
  currentSpeed = parseFloat(e.target.value);
  speedValue.textContent = currentSpeed + 'x';
});

// Pause / Stop: pause membekukan waktu, stop = reset penuh (rest + env awal)
pauseBtn.addEventListener('click', () => { player.togglePause(); });
stopBtn.addEventListener('click', () => {
  player.reset();
  transportUI(false, 0);
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  if (timelineProgress) timelineProgress.style.width = '0%';
  if (timelineCursor) timelineCursor.style.left = '0%';
  setStatus(__L('statusStopped', 'Dihentikan'));
});

// timeline: klik/geser untuk seek — langsung pause, dan tetap bisa digeser
// lagi selama paused (untuk mencari posisi).
let scrubbing = false;
function seekFromPointer(e) {
  if (!player || !player.running) return;
  const action = player._playScaled || player.actions.get(player.currentAction);
  if (!action || !action.duration) return;
  const bar = timelineBar.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (e.clientX - bar.left) / bar.width));
  player.seek(frac * action.duration);
}
timelineBar.addEventListener('pointerdown', (e) => {
  if (!player || !player.running) return;
  scrubbing = true;
  try { if (timelineBar.setPointerCapture) timelineBar.setPointerCapture(e.pointerId); } catch (err) {}
  seekFromPointer(e);
  e.preventDefault();
});
timelineBar.addEventListener('pointermove', (e) => { if (scrubbing) seekFromPointer(e); });
function endScrub(e) {
  if (!scrubbing) return;
  scrubbing = false;
  try { if (e && timelineBar.releasePointerCapture) timelineBar.releasePointerCapture(e.pointerId); } catch (err) {}
}
timelineBar.addEventListener('pointerup', endScrub);
timelineBar.addEventListener('pointercancel', endScrub);

// Ctrl+S = save + apply (hanya dgn panel); E = toggle mode editor
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    if (!scriptArea) return;                  // standalone: biarkan perilaku default
    e.preventDefault();
    saveScript();
    applyScript();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  if (HAS_PANEL && e.key && e.key.toLowerCase() === 'e') setEditor(!editorOn);
});

/* ---------- Init ---------- */
async function init() {
  player = new ActionPlayer();
  window.__player = player;             // dibaca viewer (penanda pivot rotasi)
  player.onPauseState = transportUI;
  if (HAS_PANEL) window.__f03.onInsertScript = insertAtCursor;
  // default: loop OFF
  loopToggle.checked = false;
  player.loop = false;

  const text = await loadScript();
  if (scriptArea) scriptArea.value = text;

  // tunggu model siap
  const wait = setInterval(() => {
    if (window.__viewerReady && window.__f03.ready()) {
      clearInterval(wait);
      applyScript(text);
      if (HAS_PANEL && !window.STANDALONE) setEditor(true);
      log(HAS_PANEL
        ? 'Siap — klik chip aksi untuk memutar, dblclick objek di list untuk menyisip nama'
        : 'Siap — klik chip aksi untuk memutar', 'log-ok');
      setStatus(__L('statusReady', 'Siap'));
    }
  }, 150);
}

if (HAS_PANEL) wirePanel();
init();
