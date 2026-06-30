/* ============================================
   Editor UI v2 - tree, viewer (pan/zoom), action list
   ============================================ */

const svgObj = document.getElementById('svgObj');
const svgContainer = document.getElementById('svgContainer');
const viewerWrap = document.getElementById('viewerWrap');
const unitSelect = document.getElementById('unitSelect');
const loopToggle = document.getElementById('loopToggle');
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const modeToggle = document.getElementById('modeToggle');
const textOverlay = document.getElementById('textOverlay');
let currentSpeed = 1;
const scriptArea = document.getElementById('scriptArea');
const applyBtn = document.getElementById('applyBtn');
const addActionBtn = document.getElementById('addActionBtn');
const saveBtn = document.getElementById('saveBtn');

const getStorageKey = () => 'action_script_' + currentUnit.id;

/* Unit registry - add new units here */
const UNITS = [
  {
    id: 'F04',
    label: 'F04 (Pompa Belakang)',
    file: 'serif04.svg',
    defaultScript: `# === Aksi dasar ===
>proses menembak
@0,T,Posisi default
@0-10,trigger,R-20,2.4,-7.9
@0-10,sear,R+10,-9,2
@0-10,pompa,X+15
@0-10,tekanan,O0

@10,T,Majukan valve
@10-1000,pompa,X0
@500,T,Picu akan maju, siap pompa
@1000-1010,trigger,R0
@1000-1010,sear,R0

@1000,T,Pompa
@1000-2000,full_gagang_pompa,X+100
@2000-3000,full_gagang_pompa,X0
@3000-4000,full_gagang_pompa,X+100
@4000-5000,full_gagang_pompa,X0
@2000-5000,tekanan,O1

@3000,T,Body pompa akan mundur
@3000-4000,pompa,X15
@3000-4000,valve_dumping,X-15
@6000,T,Tembak !

@6000-7000,trigger,R-20
@7000-7100,sear,R+10
@7100-7200,valve_dumping,X0
@8000,T,Selesai
@7200+500,angin,O1
@8000+100,angin,O0
@7200+500,tekanan,O0


>melepas pompa
@0+1000,pasak_belakang1,X+50;Y-50
@0+1000,pasak_belakang2,X+50;Y+50

@1000-1500,trigger,R-20
@1000-1500,sear,R+10

@1500-2500,pompa,X+190
@2500-3500,pompa,Y-50

@10,T,Cabut 2 paku pompa
@1000,T,Tekan tahan picu
@2500,T,Tarik keluar pompa
@5000,T,Selesai

>memasang pompa
@0+10,pasak_belakang1,X+50;Y-50
@0+10,pasak_belakang2,X+50;Y+50
@0+10,pompa,X+190

@3000+1000,pasak_belakang1,X0;Y0
@3000+1000,pasak_belakang2,X0;Y0

@1000-1500,trigger,R-20
@1000-1500,sear,R+10

@1500-2500,pompa,X0
@3000+500,trigger,R0
@3000+500,sear,R0


@10,T,Tekan tahan picu
@1500,T,Masukkan pompa sampai mentok
@3000,T,Pasang paku
@5000,T,Selesai

>Mengubah ruang angin
@10+1000,paku_pasak_tutup,X-40;Y+50
@1100+1000,tutup_depan,X-100
@2000+1000,selangusus,SX0.5;SY1;X-28

@3500+1000,tutup_depan,X0
@5000+1000,paku_pasak_tutup,X0;Y0


@10,T,Cabut paku depan
@1000,T,Tarik keluar tutup depan
@2000,T,Potong selang usus
@3500,T,Masukkan lagi
@4500,T,Pasang paku
@7000,T,Selesai

`
  },
  {
    id: 'F03',
    label: 'F03 (Bullpup - Pompa Depan)',
    file: 'serif03.svg',
    defaultScript: `# === Aksi dasar ===
>proses menembak
@0,T,Posisi default
@0-10,trigger,R-20,-1.1,1.2
@0-10,sear,R+10,-9,2
@0-10,valve_f03,X+15
@0-10,tekanan,O0
@0-10,picu,R-20,-1.3,-3.6

@10,T,Majukan valve
@10-1000,valve_f03,X0
@500,T,Picu akan maju, siap pompa
@1000-1010,trigger,R0,2.4,-7.9
@1000-1010,sear,R0
@1000+30,picu,R0


@1000,T,Pompa
@1000-2000,full_gagang_pompa,X+100
@2000-3000,full_gagang_pompa,X0
@3000-4000,full_gagang_pompa,X+100
@4000-5000,full_gagang_pompa,X0
@2000-5000,tekanan,O1

@3000,T,Body pompa akan mundur
@3000-4000,valve_f03,X15
@3000-4000,valve_dumping,X-15
@6000,T,Tembak !

@6000+1000,picu,R-20

@6000-7000,trigger,R-20,2.4,-7.9
@7000-7100,sear,R+10
@7100-7200,valve_dumping,X0
@8000,T,Selesai
@7200+500,angin,O1
@8000+100,angin,O0
@7200+500,tekanan,O0


>melepas pompa
@0+1000,pasak1,X-50;Y-50
@0+1000,pasak2,X-50;Y+50

@1500-2500,pompa,X+190
@2500-3500,pompa,Y+30

@10,T,Cabut 2 paku pompa
@1500,T,Tarik keluar pompa
@5000,T,Selesai


>memasang pompa
@0+10,pasak1,X-50;Y-50
@0+10,pasak2,X-50;Y+50
@0+10,pompa,X+190;Y+30

@1000-1500,pompa,Y+0
@1500-2500,pompa,X+0
@3000+1000,pasak1,X0;Y0
@3000+1000,pasak2,X0;Y0

@500,T,Masukkan pompa
@3000,T,Pasang 2 paku pompa

@5000,T,Selesai

>Melepas valve dumping
@0-1000,trigger,R-20,2.4,-7.9
@0-1000,sear,R+10
@500+1000,paku3,X+30;Y-30
@1500+1000,valve_f03,X+120
@2500+500,valve_f03,Y-20


@100,T,Lepas Paku
@500,T,Tekan tahan picu
@1000,T,Tarik keluar valve
@4000,T,Selesai

>Memasang valve dumping
@0-10,valve_f03,X+120;Y+30
@0-10,paku3,X+30;Y-30

@0-1000,trigger,R-20,2.4,-7.9
@0-1000,sear,R+10

@1500+1000,valve_f03,Y0
@2500+500,valve_f03,X0

@3500+1000,paku3,X0;Y0

@500,T,Tekan tahan picu
@1000,T,Masukkan valve
@3100,T,Pasang Paku
@4000,T,Selesai

>menambah ruang angin
@0+1000,pasak1,X-50;Y-50
@0+1000,pasak2,X-50;Y+50

@1500-2500,pompa,X+190
@2500+500,spacer,SX0.1;X-140
@3000+1000,spacer2,X+40

@4000+1500,pompa,X+0
@5500+1000,pasak1,X0;Y0
@5500+1000,pasak2,X0;Y0


@10,T,Cabut 2 paku pompa
@1500,T,Tarik keluar pompa
@5000,T,Selesai



`
  }
];
let currentUnit = UNITS[0];
const statusEl = document.getElementById('status');
const consoleOut = document.getElementById('consoleOut');
const timelineProgress = document.getElementById('timelineProgress');
const timelineCursor = document.getElementById('timelineCursor');
const timelineLabels = document.getElementById('timelineLabels');
const actionList = document.getElementById('actionList');
const treeRoot = document.getElementById('treeRoot');
const viewerInfo = document.getElementById('viewerInfo');

let svgDoc = null;
let player = null;
let actions = new Map();      // name -> { steps, duration }
let objectTree = [];          // tree of objects from SVG
let zoom = 1, panX = 0, panY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
let lastActionName = null;
const lastActionLabel = document.getElementById('lastActionLabel');
const exportLastBtn = document.getElementById('exportLastBtn');
const recordLastBtn = document.getElementById('recordLastBtn');

function log(msg, cls = 'log-info') {
  const t = new Date().toTimeString().slice(0, 8);
  consoleOut.innerHTML += `<span class="${cls}">[${t}] ${msg}</span>\n`;
  consoleOut.parentElement.scrollTop = consoleOut.parentElement.scrollHeight;
}

function setStatus(s) { statusEl.textContent = s; }

/* ============================================
   SVG Loading
   ============================================ */
function populateUnitSelect() {
  unitSelect.innerHTML = '';
  // Restore last selected unit from storage
  let lastUnit = null;
  try { lastUnit = localStorage.getItem('action_script_last_unit'); } catch (e) { }
  for (const u of UNITS) {
    const opt = document.createElement('option');
    opt.value = u.id;
    opt.textContent = u.label;
    unitSelect.appendChild(opt);
    if (lastUnit && u.id === lastUnit) currentUnit = u;
  }
  unitSelect.value = currentUnit.id;
}
populateUnitSelect();
// If restored unit differs from hardcoded SVG, reload SVG
if (svgObj) {
  const u = UNITS.find(u => u.id === currentUnit.id);
  if (u && !svgObj.getAttribute('data').startsWith(u.file)) {
    svgObj.setAttribute('data', u.file + '?v=' + Date.now());
  }
}

unitSelect.addEventListener('change', () => {
  const u = UNITS.find(u => u.id === unitSelect.value);
  if (!u) return;
  currentUnit = u;
  if (player) player.reset();
  svgObj.setAttribute('data', u.file + '?v=' + Date.now());
  // Save selected unit for next reload
  try { localStorage.setItem('action_script_last_unit', u.id); } catch (e) { }
  // Load script for this unit (saved or default)
  const saved = loadScript();
  if (saved) scriptArea.value = saved;
  // Re-apply after SVG loads
  setTimeout(() => {
    if (svgDoc) {
      applyScript();
      applyMode();
    }
  }, 500);
});
svgObj.addEventListener('load', onSvgLoaded);

function onSvgLoaded() {
  svgDoc = svgObj.contentDocument;
  if (!svgDoc) { log('No contentDocument', 'log-err'); return; }
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  // Remove fixed width/height so it can scale
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  svgEl.style.width = '100%';
  svgEl.style.height = '100%';
  svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svgEl.setAttribute('shape-rendering', 'geometricPrecision');
  svgEl.style.shapeRendering = 'geometricPrecision';
  // Reset zoom state and capture original viewBox
  baseViewBox = null;  // force re-capture
  zoom = 1; panX = 0; panY = 0;

  player = new ActionPlayer(svgDoc);
  hideBocorCek();
  buildObjectTree();
  renderTree();
  log(`SVG loaded: ${countAllObjects()} objects, ${actions.size} actions`, 'log-ok');
  setStatus(`${countAllObjects()} objects`);
  zoomFit();
}

/* Hide all bocor_* and cek_* ellipses (not relevant for animation editor) */
function hideBocorCek() {
  if (!svgDoc) return;
  const ellipses = svgDoc.querySelectorAll('ellipse');
  for (const el of ellipses) {
    const label = el.getAttribute('inkscape:label');
    if (label && (label.startsWith('bocor_') || label.startsWith('cek_'))) {
      el.style.visibility = 'hidden';
    }
  }
}

function buildObjectTree() {
  if (!svgDoc) return;
  // Build tree from groups & their children
  const groups = svgDoc.querySelectorAll('g[id]');
  objectTree = [];
  // Top-level groups
  for (const g of groups) {
    if (g.parentElement && g.parentElement.tagName.toLowerCase() === 'svg') continue;
    // Only top-level (parent is svg or namedview)
    const parent = g.parentElement;
    if (!parent || parent.tagName.toLowerCase() === 'svg') {
      // children with id
      const children = [];
      for (const child of g.children) {
        if (child.id) children.push({ id: child.id, tag: child.tagName.toLowerCase() });
      }
      objectTree.push({ id: g.id, tag: g.tagName.toLowerCase(), children });
    }
  }
}

function countAllObjects() {
  let n = 0;
  svgDoc.querySelectorAll('g[id], rect[id], path[id], circle[id]').forEach(el => {
    if (el.id && el.id !== 'svg1' && el.id !== 'defs1' && el.id !== 'namedview1' && el.tagName.toLowerCase() !== 'ellipse') n++;
  });
  return n;
}

/* ============================================
   Tree Rendering
   ============================================ */
function renderTree() {
  treeRoot.innerHTML = '';
  // Get all top-level groups
  const svg = svgDoc.querySelector('svg');
  if (!svg) return;
  // Top-level = direct children of svg (excluding defs, namedview, ellipse)
  for (const child of svg.children) {
    if (['defs', 'namedview', 'style', 'sodipodi:namedview'].includes(child.tagName.toLowerCase())) continue;
    if (child.tagName.toLowerCase() === 'ellipse') continue;
    if (!child.id) {
      // If no id, just show contents directly
      for (const sub of child.children) {
        if (sub.id) {
          treeRoot.appendChild(makeNode(sub.id, sub.tagName.toLowerCase(), 0));
        }
      }
    } else {
      treeRoot.appendChild(makeNode(child.id, child.tagName.toLowerCase(), 0));
    }
  }
}

function makeNode(id, tag, depth) {
  const wrap = document.createElement('div');
  const node = document.createElement('div');
  node.className = 'tree-node';
  node.dataset.id = id;
  const icon = document.createElement('span');
  icon.className = 'tree-icon';
  icon.textContent = tag === 'g' ? '📁' : tag === 'rect' ? '▭' : tag === 'path' ? '✎' : tag === 'circle' ? '○' : '◇';
  const label = document.createElement('span');
  label.className = 'tree-label';
  label.textContent = id;
  node.appendChild(icon);
  node.appendChild(label);
  // Add click for highlight
  node.addEventListener('click', e => {
    e.stopPropagation();
    document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('highlighted'));
    node.classList.add('highlighted');
  });
  // Add double-click to insert to script
  node.addEventListener('dblclick', () => {
    insertAtCursor(id);
    log('Inserted: ' + id, 'log-info');
  });
  wrap.appendChild(node);

  // Find children with id (nested groups)
  const el = svgDoc.getElementById(id);
  if (el) {
    const children = [];
    for (const c of el.children) {
      if (c.id) children.push(c);
    }
    if (children.length > 0) {
      // Add toggle
      const toggle = document.createElement('span');
      toggle.className = 'tree-toggle';
      toggle.textContent = '▼';
      node.insertBefore(toggle, icon);
      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      for (const c of children) {
        childWrap.appendChild(makeNode(c.id, c.tagName.toLowerCase(), depth + 1));
      }
      wrap.appendChild(childWrap);
      // Toggle expand/collapse
      toggle.addEventListener('click', e => {
        e.stopPropagation();
        const collapsed = childWrap.classList.toggle('collapsed');
        toggle.textContent = collapsed ? '▶' : '▼';
      });
    }
  }
  return wrap;
}

document.getElementById('expandAll').addEventListener('click', () => {
  document.querySelectorAll('.tree-children').forEach(c => c.classList.remove('collapsed'));
  document.querySelectorAll('.tree-toggle').forEach(t => t.textContent = '▼');
});
document.getElementById('collapseAll').addEventListener('click', () => {
  document.querySelectorAll('.tree-children').forEach(c => c.classList.add('collapsed'));
  document.querySelectorAll('.tree-toggle').forEach(t => t.textContent = '▶');
});

/* ============================================
   Pan & Zoom - using SVG viewBox (vector quality)
   ============================================ */
let baseViewBox = null;  // original viewBox of SVG
function applyTransform() {
  if (!svgDoc) return;
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl || !baseViewBox) return;
  // ViewBox dimension = baseViewBox dimension / zoom
  const w = baseViewBox.width / zoom;
  const h = baseViewBox.height / zoom;
  // Center of viewBox stays at baseViewBox center, shifted by pan (px -> vb units)
  const wrapRect = viewerWrap.getBoundingClientRect();
  const pxToVb = baseViewBox.width / wrapRect.width;
  const cx = baseViewBox.x + baseViewBox.width / 2 - panX * pxToVb;
  const cy = baseViewBox.y + baseViewBox.height / 2 - panY * pxToVb;
  const x = cx - w / 2;
  const y = cy - h / 2;
  svgEl.setAttribute('viewBox', `${x.toFixed(3)} ${y.toFixed(3)} ${w.toFixed(3)} ${h.toFixed(3)}`);
  viewerInfo.textContent = `${Math.round(zoom * 100)}%`;
}
function zoomFit() {
  if (!svgDoc) return;
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  if (!baseViewBox) {
    // Read original viewBox from attribute (not baseVal, which can be animated)
    const vbAttr = svgEl.getAttribute('viewBox');
    if (vbAttr) {
      const parts = vbAttr.split(/\s+/).map(parseFloat);
      baseViewBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    } else {
      const vb = svgEl.viewBox.baseVal;
      baseViewBox = { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    }
  }
  // Zoom fit = container / baseViewBox
  const wrapRect = viewerWrap.getBoundingClientRect();
  const zX = wrapRect.width / baseViewBox.width;
  const zY = wrapRect.height / baseViewBox.height;
  const z = Math.min(zX, zY);  // full fit (no 0.95)
  zoom = z;
  panX = 0; panY = 0;
  applyTransform();
}
function zoomReset() {
  // Reset to 100% (1:1 base viewBox in container)
  if (!baseViewBox) return;
  zoom = 1; panX = 0; panY = 0;
  applyTransform();
}
function zoomIn() { zoom = Math.min(zoom * 1.2, 20); applyTransform(); }
function zoomOut() { zoom = Math.max(zoom / 1.2, 0.1); applyTransform(); }

document.getElementById('zoomIn').addEventListener('click', zoomIn);
document.getElementById('zoomOut').addEventListener('click', zoomOut);
document.getElementById('zoomReset').addEventListener('click', zoomReset);
document.getElementById('zoomFit').addEventListener('click', zoomFit);

if (exportLastBtn) {
  exportLastBtn.addEventListener('click', () => {
    if (!lastActionName) {
      log('Belum ada aksi yang dijalankan. Klik sebuah aksi dulu.', 'log-err');
      return;
    }
    exportActionAsSVG(lastActionName);
  });
}
if (recordLastBtn) {
  recordLastBtn.addEventListener('click', () => {
    if (!lastActionName) {
      log('Belum ada aksi yang dijalankan. Klik sebuah aksi dulu.', 'log-err');
      return;
    }
    exportActionAsGIF(lastActionName);
  });
}

viewerWrap.addEventListener('mousedown', e => {
  isDragging = true;
  dragStartX = e.clientX; dragStartY = e.clientY;
  panStartX = panX; panStartY = panY;
  viewerWrap.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!isDragging) return;
  panX = panStartX + (e.clientX - dragStartX);
  panY = panStartY + (e.clientY - dragStartY);
  applyTransform();
});
window.addEventListener('mouseup', () => {
  isDragging = false;
  viewerWrap.classList.remove('dragging');
});
viewerWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const rect = viewerWrap.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const delta = e.deltaY > 0 ? 1 / 1.1 : 1.1;
  const newZoom = Math.max(0.1, Math.min(20, zoom * delta));
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  // Mouse-centric zoom: keep the world point under cursor fixed
  panX = (mx - centerX) * (1 - newZoom / zoom) + panX * newZoom / zoom;
  panY = (my - centerY) * (1 - newZoom / zoom) + panY * newZoom / zoom;
  zoom = newZoom;
  applyTransform();
}, { passive: false });

/* ============================================
   Touch pan & pinch zoom
   ============================================ */
let touchState = null; // { mode:'pan'|'pinch', startZoom, startPanX, startPanY, startTouches: [{id,x,y}], startDist, startMid }

function getTouchPos(t) {
  const rect = viewerWrap.getBoundingClientRect();
  return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}
function touchDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function touchMidpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

viewerWrap.addEventListener('touchstart', e => {
  if (e.touches.length === 0) return;
  const rect = viewerWrap.getBoundingClientRect();
  const touches = Array.from(e.touches).map(t => getTouchPos(t));
  if (e.touches.length === 1) {
    touchState = {
      mode: 'pan',
      startPanX: panX, startPanY: panY,
      startTouches: touches
    };
  } else if (e.touches.length >= 2) {
    const t0 = touches[0], t1 = touches[1];
    touchState = {
      mode: 'pinch',
      startZoom: zoom,
      startPanX: panX, startPanY: panY,
      startDist: touchDistance(t0, t1),
      startMid: touchMidpoint(t0, t1),
      startTouches: touches
    };
  }
}, { passive: false });

viewerWrap.addEventListener('touchmove', e => {
  if (!touchState) return;
  e.preventDefault();
  const rect = viewerWrap.getBoundingClientRect();
  const touches = Array.from(e.touches).map(t => getTouchPos(t));
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;

  // If touch count changed mid-gesture, re-baseline from current state
  if ((e.touches.length >= 2 && touchState.mode !== 'pinch') ||
    (e.touches.length === 1 && touchState.mode !== 'pan')) {
    if (e.touches.length >= 2) {
      const t0 = touches[0], t1 = touches[1];
      touchState = {
        mode: 'pinch',
        startZoom: zoom,
        startPanX: panX, startPanY: panY,
        startDist: touchDistance(t0, t1),
        startMid: touchMidpoint(t0, t1),
        startTouches: touches
      };
    } else {
      touchState = {
        mode: 'pan',
        startPanX: panX, startPanY: panY,
        startTouches: touches
      };
    }
    return;
  }

  if (e.touches.length === 1 && touchState.mode === 'pan') {
    const s = touchState.startTouches[0];
    const c = touches[0];
    panX = touchState.startPanX + (c.x - s.x);
    panY = touchState.startPanY + (c.y - s.y);
    applyTransform();
  } else if (e.touches.length >= 2 && touchState.mode === 'pinch') {
    const t0 = touches[0], t1 = touches[1];
    const dist = touchDistance(t0, t1);
    const mid = touchMidpoint(t0, t1);
    const ratio = dist / touchState.startDist;
    const newZoom = Math.max(0.1, Math.min(20, touchState.startZoom * ratio));
    const mx = mid.x, my = mid.y;
    // Pinch-centric zoom: keep world point under pinch midpoint fixed
    panX = (mx - centerX) * (1 - newZoom / touchState.startZoom) + touchState.startPanX * newZoom / touchState.startZoom;
    panY = (my - centerY) * (1 - newZoom / touchState.startZoom) + touchState.startPanY * newZoom / touchState.startZoom;
    zoom = newZoom;
    applyTransform();
  }
}, { passive: false });

function endTouch() {
  touchState = null;
}
viewerWrap.addEventListener('touchend', endTouch, { passive: false });
viewerWrap.addEventListener('touchcancel', endTouch, { passive: false });

/* ============================================
   Script Apply / Action List
   ============================================ */
applyBtn.addEventListener('click', () => {
  applyScript();
  // Auto-play first action if in player mode
  if (document.body.classList.contains('mode-player') && actions.size > 0) {
    const firstName = [...actions.keys()][0];
    playAction(firstName);
  }
});
saveBtn.addEventListener('click', saveScript);

// Loop default
player && (player.loop = true);
loopToggle.checked = true;

// Speed slider
speedSlider.addEventListener('input', e => {
  currentSpeed = parseFloat(e.target.value);
  speedValue.textContent = currentSpeed + 'x';
});

// Mode toggle
function applyMode() {
  const isEditor = modeToggle.checked;
  document.body.classList.toggle('mode-player', !isEditor);
  if (isEditor) {
    // Switched to editor mode: stop any running animation
    if (player) player.stop();
  }
}
modeToggle.addEventListener('change', applyMode);

// Ctrl+S to save
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveScript();
    applyScript();
  }
});

function applyScript() {
  log('applyScript called', 'log-info');
  if (!player || !svgDoc) {
    log('SVG belum loaded', 'log-err');
    return;
  }
  const result = player.parseScript(scriptArea.value);
  log(`parseScript result: ${result.error ? 'ERROR: ' + result.error : 'OK, ' + result.actions.size + ' actions'}`, 'log-info');
  if (result.error) {
    log('Parse error: ' + result.error, 'log-err');
    setStatus('Parse error');
    return;
  }
  // Validate all objects exist
  const missing = [];
  for (const a of player.actions.values()) {
    for (const s of a.steps) {
      if (!svgDoc.getElementById(s.objId)) missing.push(s.objId);
    }
  }
  if (missing.length) {
    log('Objek hilang: ' + [...new Set(missing)].join(', '), 'log-err');
  }
  actions = player.actions;  // sync to player
  player.captureOriginalTransforms();  // capture originals NOW (before any animation)
  log(`Loaded ${actions.size} actions: ${[...actions.keys()].join(', ')}`, 'log-ok');
  setStatus(`${actions.size} actions`);
  renderActionList();
}

function renderActionList() {
  actionList.innerHTML = '';
  log(`renderActionList: ${actions.size} actions in Map`, 'log-info');
  for (const [name, action] of actions) {
    const chip = document.createElement('span');
    chip.className = 'action-chip';
    const stepCount = action.steps.length;
    const label = document.createElement('span');
    label.className = 'chip-label';
    label.textContent = '▶ ' + name;
    const count = document.createElement('span');
    count.className = 'step-count';
    count.textContent = stepCount;
    chip.appendChild(label);
    chip.appendChild(count);
    chip.title = `Durasi: ${action.duration}ms, ${stepCount} steps\nKlik untuk run`;
    chip.addEventListener('click', () => playAction(name));
    actionList.appendChild(chip);
  }
  if (actions.size === 0) {
    actionList.innerHTML = '<span class="hint-inline">Tidak ada aksi. Cek script di panel kanan dan klik Terapkan.</span>';
  }
}

function playAction(name) {
  if (!player) return;
  // Auto-apply if not yet
  if (actions.size === 0) {
    log('Auto-applying script...', 'log-info');
    applyScript();
  }
  let action = actions.get(name);
  if (!action) {
    // Try fuzzy: find action that starts with name
    for (const [k, a] of actions) {
      if (k.startsWith(name) || k.includes(name)) { action = a; name = k; break; }
    }
  }
  if (!action) {
    log('Aksi tidak ditemukan: ' + name, 'log-err');
    log('Tersedia: ' + [...actions.keys()].join(', '), 'log-info');
    return;
  }
  lastActionName = name;
  if (lastActionLabel) {
    lastActionLabel.textContent = name;
    lastActionLabel.title = `Aksi terakhir: ${name}`;
  }
  log(`▶ ${name} (${action.duration}ms, ${action.steps.length} steps)`, 'log-info');
  player.loop = loopToggle.checked;
  // Speed-adjusted duration
  const adjustedDuration = action.duration / currentSpeed;
  // We need to scale step times too. Simplest: scale all step start/end
  // Better: use a "virtual t" = real t * currentSpeed
  // We'll do this via onProgress by passing scaled t to applyState
  player._speed = currentSpeed;
  // We need to scale step times per-action
  // Create a scaled copy of action
  const scaledAction = scaleActionTime(action, 1 / currentSpeed);
  player._activeAction = scaledAction;
  player._displayName = name;
  player.onProgress = (frac, t, total) => {
    const pct = (frac * 100).toFixed(1);
    timelineProgress.style.width = pct + '%';
    timelineCursor.style.left = pct + '%';
    setStatus(`${name}: ${t.toFixed(0)}ms / ${total}ms`);
    renderTimeline(scaledAction);
  };
  player.onComplete = (n) => {
    // Silent: no notification
  };
  player.onTextChange = (text, isVisible) => {
    if (text) {
      textOverlay.textContent = text;
      textOverlay.classList.add('show');
    } else {
      textOverlay.classList.remove('show');
    }
  };
  // Override applyState call: pass scaled action
  player._playScaled = scaledAction;
  player.play(name);
}

/* Scale all step start/end times by a factor (for speed control) */
function scaleActionTime(action, factor) {
  return {
    name: action.name,
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
  const total = action.duration;
  timelineLabels.innerHTML = '';
  // Show last 5 unique step times
  const times = [...new Set(action.steps.map(s => s.time))];
  for (const t of times) {
    const obj = action.steps.find(s => s.time === t).objId;
    const lbl = document.createElement('span');
    lbl.style.cssText = `position:absolute;left:${(t / total * 100).toFixed(1)}%;top:18px;font-size:0.6rem;color:var(--muted);`;
    lbl.textContent = `[${t}] ${obj}`;
    timelineBar.appendChild(lbl);
  }
}

/* ============================================
   Modal: Add New Action
   ============================================ */
const modal = document.getElementById('modal');
addActionBtn.addEventListener('click', () => {
  modal.style.display = 'flex';
  document.getElementById('modalName').value = '';
  document.getElementById('modalName').focus();
});
document.getElementById('modalCancel').addEventListener('click', () => {
  modal.style.display = 'none';
});
document.getElementById('modalOk').addEventListener('click', () => {
  const name = document.getElementById('modalName').value.trim();
  const type = document.getElementById('modalType').value;
  if (!name) return;
  let insertion = '';
  if (type === 'steps') {
    insertion = `\n\n>${name}\n@200,handle_pompa,X+50\n`;
  } else {
    insertion = `\n\n>${name}\n+existing_action\n`;
  }
  scriptArea.value = scriptArea.value.trimEnd() + insertion;
  modal.style.display = 'none';
  log('Added action: ' + name, 'log-info');
});

function insertAtCursor(text) {
  const pos = scriptArea.selectionStart;
  const before = scriptArea.value.slice(0, pos);
  const after = scriptArea.value.slice(pos);
  scriptArea.value = before + text + after;
  scriptArea.focus();
  scriptArea.selectionStart = scriptArea.selectionEnd = pos + text.length;
}

/* ============================================
   Init
   ============================================ */
window.addEventListener('load', () => {
  // Auto-load saved script from localStorage (or default script)
  const saved = loadScript();
  if (saved) {
    scriptArea.value = saved;
    log('Loaded script dari localStorage/default', 'log-ok');
  }
  // Re-apply script if SVG already loaded
  setTimeout(() => {
    if (svgDoc) {
      applyScript();
      // Apply mode after script loaded (so actions.size is correct for auto-play)
      applyMode();
    }
  }, 500);
});

/* ============================================
   Save / Load script to localStorage
   ============================================ */

/* ============================================
   Save / Load script to localStorage
   ============================================ */
function saveScript() {
  try {
    localStorage.setItem(getStorageKey(), scriptArea.value);
    log('Script tersimpan ke localStorage', 'log-ok');
    setStatus('Saved');
  } catch (e) {
    log('Gagal simpan: ' + e.message, 'log-err');
  }
}

/* ============================================
   Export action as animated SVG (SMIL)
   Embeds the action's animation into SVG using <animate> / <animateTransform>
   so the file can be shared and played in any modern browser.
   ============================================ */
function exportActionAsSVG(actionName) {
  const action = actions.get(actionName);
  if (!action) {
    log('Aksi tidak ditemukan: ' + actionName, 'log-err');
    return;
  }
  if (!svgDoc) {
    log('SVG belum loaded', 'log-err');
    return;
  }
  // Clone the SVG root element
  const origSvg = svgDoc.querySelector('svg');
  const clone = origSvg.cloneNode(true);
  // Get ORIGINAL viewBox (before zoom modifications) from baseViewBox cache
  let vb;
  if (baseViewBox) {
    vb = `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.width} ${baseViewBox.height}`;
  } else {
    vb = origSvg.getAttribute('viewBox') || '0 0 369 90';
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('viewBox', vb);
  clone.setAttribute('width', '100%');
  clone.setAttribute('height', '100%');
  clone.removeAttribute('style');
  // Remove any pre-existing animate elements
  clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(el => el.remove());
  // Remove inline opacity attribute so <animate> can take effect cleanly
  clone.querySelectorAll('[opacity]').forEach(el => el.removeAttribute('opacity'));
  clone.querySelectorAll('[style*="opacity"]').forEach(el => {
    el.style.opacity = '';
  });
  // Remove bocor/cek ellipses (not relevant for static animation)
  clone.querySelectorAll('ellipse').forEach(el => {
    const lbl = el.getAttribute('inkscape:label');
    if (lbl && (lbl.startsWith('bocor_') || lbl.startsWith('cek_'))) {
      el.remove();
    }
  });
  // Build SMIL animations. For each object, generate a single composite
  // transform animation that interpolates from base to final state.
  // We use values="..." with keyTimes to avoid "additive" conflicts.
  const NS = 'http://www.w3.org/2000/svg';
  const svgCloneDoc = clone.ownerDocument;  // not quite — clone is element
  // Group steps by objId, sorted by start time
  const byObj = new Map();
  for (const step of action.steps) {
    if (step.isText) continue;
    if (!byObj.has(step.objId)) byObj.set(step.objId, []);
    byObj.get(step.objId).push(step);
  }
  // For each object, build 3 separate <animateTransform> (translate, rotate, scale)
  // with additive="sum" so they compose into a single transform.
  // Each axis uses its own values+keyTimes for proper interpolation.
  for (const [objId, steps] of byObj.entries()) {
    const el = clone.getElementById(objId);
    if (!el) continue;
    // Get pivot for this object (use original SVG for getBBox since clone isn't mounted)
    const pivot = player.computePivotForStep(steps[0], svgDoc);
    const [pcx, pcy] = pivot.split(' ');
    const totalDur = Math.max(action.duration / 1000, 0.001);
    // Build keyframes per axis
    const trValues = [];  // translate x y
    const trTimes = [];
    const rotValues = [];  // rotate angle
    const rotTimes = [];
    const sxValues = [];  // scale x
    const sxTimes = [];
    const syValues = [];  // scale y
    const syTimes = [];
    // Initial state at t=0
    const firstStep = steps[0];
    trValues.push(`${firstStep.from.x.toFixed(3)} ${firstStep.from.y.toFixed(3)}`);
    trTimes.push('0');
    rotValues.push(firstStep.from.r.toFixed(3));
    rotTimes.push('0');
    sxValues.push(firstStep.from.sx.toFixed(3));
    sxTimes.push('0');
    syValues.push(firstStep.from.sy.toFixed(3));
    syTimes.push('0');
    for (const step of steps) {
      const t = step.start / 1000;
      const dur = (step.end - step.start) / 1000;
      const tFrac = (t / totalDur).toFixed(4);
      const tEndFrac = ((t + dur) / totalDur).toFixed(4);
      if (dur <= 0) {
        // Instant: push "to" value at this time
        trValues.push(`${step.to.x.toFixed(3)} ${step.to.y.toFixed(3)}`);
        trTimes.push(tFrac);
        rotValues.push(step.to.r.toFixed(3));
        rotTimes.push(tFrac);
        sxValues.push(step.to.sx.toFixed(3));
        sxTimes.push(tFrac);
        syValues.push(step.to.sy.toFixed(3));
        syTimes.push(tFrac);
      } else {
        // Push "from" at start of step
        trValues.push(`${step.from.x.toFixed(3)} ${step.from.y.toFixed(3)}`);
        trTimes.push(tFrac);
        rotValues.push(step.from.r.toFixed(3));
        rotTimes.push(tFrac);
        sxValues.push(step.from.sx.toFixed(3));
        sxTimes.push(tFrac);
        syValues.push(step.from.sy.toFixed(3));
        syTimes.push(tFrac);
        // Push "to" at end of step
        trValues.push(`${step.to.x.toFixed(3)} ${step.to.y.toFixed(3)}`);
        trTimes.push(tEndFrac);
        rotValues.push(step.to.r.toFixed(3));
        rotTimes.push(tEndFrac);
        sxValues.push(step.to.sx.toFixed(3));
        sxTimes.push(tEndFrac);
        syValues.push(step.to.sy.toFixed(3));
        syTimes.push(tEndFrac);
      }
    }
    // Make sure last keyTime is 1
    if (trTimes[trTimes.length - 1] !== '1.0000') {
      const lastStep = steps[steps.length - 1];
      trValues.push(`${lastStep.to.x.toFixed(3)} ${lastStep.to.y.toFixed(3)}`);
      trTimes.push('1.0000');
      rotValues.push(lastStep.to.r.toFixed(3));
      rotTimes.push('1.0000');
      sxValues.push(lastStep.to.sx.toFixed(3));
      sxTimes.push('1.0000');
      syValues.push(lastStep.to.sy.toFixed(3));
      syTimes.push('1.0000');
    }
    // Generate animateTransform elements
    const makeAnim = (type, values, keyTimes, extra) => {
      const a = svgCloneDoc.createElementNS(NS, 'animateTransform');
      a.setAttribute('attributeName', 'transform');
      a.setAttribute('type', type);
      a.setAttribute('values', values.join('; '));
      a.setAttribute('keyTimes', keyTimes.join('; '));
      a.setAttribute('dur', totalDur + 's');
      a.setAttribute('fill', 'freeze');
      a.setAttribute('additive', 'sum');
      if (extra) extra(a);
      return a;
    };
    el.appendChild(makeAnim('translate', trValues, trTimes));
    el.appendChild(makeAnim('rotate', rotValues, rotTimes, a => {
      // rotate values must include pivot: "angle cx cy"
      const newValues = rotValues.map((v, i) => {
        const t = rotTimes[i];
        return `${v} ${pcx} ${pcy}`;
      }).join('; ');
      a.setAttribute('values', newValues);
    }));
    el.appendChild(makeAnim('scale', sxValues.map((sx, i) => `${sx} ${syValues[i]}`), sxTimes));
    // Opacity
    const opKeyframes = [];
    for (const step of steps) {
      const t = step.start / 1000;
      const dur = (step.end - step.start) / 1000;
      if (step.to.o !== undefined) {
        if (dur <= 0) {
          // Instant: just set the value at this time
          opKeyframes.push({ time: t, value: step.to.o });
        } else {
          opKeyframes.push({ time: t, value: (step.from.o !== undefined ? step.from.o : 1) });
          opKeyframes.push({ time: t + dur, value: step.to.o });
        }
      }
    }
    if (opKeyframes.length > 0) {
      opKeyframes.sort((a, b) => a.time - b.time);
      // Dedupe adjacent keyframes with same value to avoid SMIL issues
      const deduped = [opKeyframes[0]];
      for (let i = 1; i < opKeyframes.length; i++) {
        if (opKeyframes[i].time !== deduped[deduped.length - 1].time || opKeyframes[i].value !== deduped[deduped.length - 1].value) {
          deduped.push(opKeyframes[i]);
        }
      }
      // Make sure first keyTime is 0
      if (deduped[0].time > 0) {
        deduped.unshift({ time: 0, value: deduped[0].value });
      }
      // Make sure last keyTime is 1
      if (deduped[deduped.length - 1].time < totalDur) {
        deduped.push({ time: totalDur, value: deduped[deduped.length - 1].value });
      }
      const opValues = deduped.map(k => k.value).join('; ');
      const opKeyTimes = deduped.map(k => (k.time / totalDur).toFixed(4)).join('; ');
      const opAnim = svgCloneDoc.createElementNS(NS, 'animate');
      opAnim.setAttribute('attributeName', 'opacity');
      opAnim.setAttribute('values', opValues);
      opAnim.setAttribute('keyTimes', opKeyTimes);
      opAnim.setAttribute('dur', totalDur + 's');
      opAnim.setAttribute('fill', 'freeze');
      el.appendChild(opAnim);
    }
  }
  // Add text overlay as <text> elements at top of SVG
  // Use <set> for clean show/hide to avoid overlap
  const textSteps = action.steps.filter(s => s.isText);
  // Group text steps by exact time to handle duplicate starts
  const textByTime = new Map();
  for (const tStep of textSteps) {
    const t = tStep.start;
    if (!textByTime.has(t)) textByTime.set(t, tStep);
  }
  // For each unique text, show it from start to end
  for (const tStep of textByTime.values()) {
    const t = svgCloneDoc.createElementNS(NS, 'text');
    t.setAttribute('x', '50%');
    t.setAttribute('y', '20');
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('fill', '#fff');
    t.setAttribute('stroke', '#000');
    t.setAttribute('stroke-width', '0.5');
    t.setAttribute('font-family', 'sans-serif');
    t.setAttribute('font-size', '6');
    t.setAttribute('opacity', '0');
    t.textContent = tStep.text;
    // Show at start
    const showSet = svgCloneDoc.createElementNS(NS, 'set');
    showSet.setAttribute('attributeName', 'opacity');
    showSet.setAttribute('to', '1');
    showSet.setAttribute('begin', (tStep.start / 1000) + 's');
    showSet.setAttribute('end', (tStep.end / 1000) + 's');
    t.appendChild(showSet);
    clone.appendChild(t);
  }
  // Add looping + auto-start
  if (loopToggle && loopToggle.checked) {
    clone.querySelectorAll('animate, animateTransform').forEach(a => {
      a.setAttribute('repeatCount', 'indefinite');
      a.setAttribute('begin', '0s');
    });
  } else {
    clone.querySelectorAll('animate, animateTransform').forEach(a => {
      a.setAttribute('begin', '0s');
    });
  }
  // Serialize
  const serializer = new XMLSerializer();
  let svgStr = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + serializer.serializeToString(clone);
  // Trigger download
  const blob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `action_${actionName}_${currentUnit.id}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  log(`Exported: ${actionName} (${svgStr.length} bytes)`, 'log-ok');
  setStatus(`Exported ${actionName}`);
}

function loadScript() {
  try {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) return saved;
    // Fall back to default script for this unit
    return currentUnit.defaultScript || '';
  } catch (e) {
    return currentUnit.defaultScript || '';
  }
}

/* ============================================
   Export action as animated GIF
   Strategy: serialize animated SVG, render each frame to canvas,
   encode frames to GIF using gif.js.
   ============================================ */
async function exportActionAsGIF(actionName) {
  const action = actions.get(actionName);
  if (!action) { log('Aksi tidak ditemukan: ' + actionName, 'log-err'); return; }
  if (!svgDoc) { log('SVG belum loaded', 'log-err'); return; }
  if (!player) { log('Player belum ready', 'log-err'); return; }
  const NS = 'http://www.w3.org/2000/svg';
  if (typeof MediaRecorder === 'undefined') {
    log('MediaRecorder tidak disupport browser', 'log-err');
    return;
  }
  // Use original SVG (mounted in DOM) for live capture
  const origSvg = svgDoc.querySelector('svg');
  // Get ORIGINAL viewBox (before zoom modifications) from baseViewBox cache
  let origVB;
  if (baseViewBox) {
    origVB = `${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.width} ${baseViewBox.height}`;
  } else {
    origVB = origSvg.getAttribute('viewBox') || '0 0 369 90';
  }
  const vbParts = origVB.split(/\s+/).map(parseFloat);
  const vbW = vbParts[2], vbH = vbParts[3];
  // Setup canvas for MediaRecorder
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = vbW * scale;
  canvas.height = vbH * scale;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Setup MediaRecorder on canvas stream
  const stream = canvas.captureStream(30);  // 30 fps
  let mimeType = 'video/webm';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
  if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 5000000 } : undefined);
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action_${actionName}_${currentUnit.id}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (recordLastBtn) recordLastBtn.classList.remove('recording');
    log('Video exported: ' + Math.round(blob.size / 1024) + ' KB', 'log-ok');
    setStatus('Video exported (WebM)');
  };
  log('Recording video ' + (action.duration / 1000) + 's...', 'log-info');
  setStatus('Recording...');
  if (recordLastBtn) recordLastBtn.classList.add('recording');
  player.captureOriginalTransforms();
  // Create text overlay element on live SVG for recording
  const recTextEl = svgDoc.createElementNS(NS, 'text');
  recTextEl.setAttribute('x', '50%');
  recTextEl.setAttribute('y', '20');
  recTextEl.setAttribute('text-anchor', 'middle');
  recTextEl.setAttribute('fill', '#fff');
  recTextEl.setAttribute('stroke', '#000');
  recTextEl.setAttribute('stroke-width', '0.5');
  recTextEl.setAttribute('font-family', 'sans-serif');
  recTextEl.setAttribute('font-size', '6');
  recTextEl.setAttribute('opacity', '0');
  origSvg.appendChild(recTextEl);
  const textStepsForRec = action.steps.filter(s => s.isText);
  // Reset viewBox to original for full visibility during recording
  origSvg.setAttribute('viewBox', origVB);
  origSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  // Pre-render first frame
  player.applyState(action, 0);
  // Update text for frame 0
  for (const ts of textStepsForRec) {
    if (0 >= ts.start && 0 < ts.end) {
      recTextEl.textContent = ts.text;
      recTextEl.setAttribute('opacity', '1');
      break;
    }
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const serializer = new XMLSerializer();
  const svgStr0 = serializer.serializeToString(origSvg);
  const svgUrl0 = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr0);
  const img0 = new Image();
  await new Promise((resolve, reject) => {
    img0.onload = resolve;
    img0.onerror = reject;
    img0.src = svgUrl0;
  });
  ctx.drawImage(img0, 0, 0, canvas.width, canvas.height);
  // Start recording
  recorder.start();
  try {
    // Render frames at 30fps
    const fps = 30;
    const frameDelay = 1000 / fps;
    const totalDur = action.duration;
    const numFrames = Math.ceil(totalDur / frameDelay);
    for (let i = 1; i <= numFrames; i++) {
      const t = i * frameDelay;
      player.applyState(action, t);
      // Update text overlay for this frame
      let activeText = null;
      for (const ts of textStepsForRec) {
        if (t >= ts.start && t < ts.end) { activeText = ts.text; break; }
      }
      if (activeText) {
        recTextEl.textContent = activeText;
        recTextEl.setAttribute('opacity', '1');
      } else {
        recTextEl.setAttribute('opacity', '0');
      }
      // Re-render SVG to canvas
      const svgStr = serializer.serializeToString(origSvg);
      const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = svgUrl;
      });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      await new Promise(r => setTimeout(r, frameDelay));
    }
  } catch (err) {
    log('Recording error: ' + err.message, 'log-err');
    setStatus('Recording failed');
  } finally {
    // Remove temp text element
    if (recTextEl.parentNode) recTextEl.parentNode.removeChild(recTextEl);
    // Stop recording
    recorder.stop();
    // Restore
    player.reset();
    if (recordLastBtn) recordLastBtn.classList.remove('recording');
  }
}
