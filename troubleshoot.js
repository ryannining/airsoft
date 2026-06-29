/* ============================================
   Trouble Shoot F04/F03 - Logic
   ============================================ */

const svgObj = document.getElementById('svgObj');
const infoPanel = document.getElementById('infoPanel');
const soundToggle = document.getElementById('soundToggle');
const resetBtn = document.getElementById('resetBtn');
const tabF04 = document.getElementById('tabF04');
const tabF03 = document.getElementById('tabF03');
const consoleOut = document.getElementById('consoleOut');
const seriesName = document.getElementById('seriesName');
const seriesSubtitle = document.getElementById('seriesSubtitle');

let svgDoc = null;
let activeLeakId = null;
let hoverLeakId = null;
let currentSeries = 'F04';
let audioCtx = null;

function log(msg, cls = 'log-info') {
  const t = new Date().toTimeString().slice(0,8);
  consoleOut.innerHTML += `<span class="${cls}">[${t}] ${msg}</span>\n`;
  consoleOut.parentElement.scrollTop = consoleOut.parentElement.scrollHeight;
}

function setStatus(s) { /* placeholder */ }

/* ---------- Init ---------- */
function init() {
  setupControls();
  setupTabs();
  setupPanZoom();
  svgObj.addEventListener('load', onSvgLoaded);
}

/* ---------- Pan & Zoom ---------- */
let zoom = 1, panX = 0, panY = 0;
let isDragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
let baseViewBox = null;

function setupPanZoom() {
  const diagramContainer = document.getElementById('diagram-container');
  if (!diagramContainer) return;
  // Create toolbar
  let toolbar = document.querySelector('.viewer-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'viewer-toolbar';
    toolbar.innerHTML = `
      <button class="btn-zoom-in" title="Zoom in">+</button>
      <button class="btn-zoom-out" title="Zoom out">−</button>
      <button class="btn-zoom-reset" title="Reset 100%">100%</button>
      <button class="btn-zoom-fit" title="Fit">Fit</button>
      <span class="viewer-info">100%</span>
    `;
    diagramContainer.parentElement.insertBefore(toolbar, diagramContainer);
  }
  toolbar.querySelector('.btn-zoom-in').addEventListener('click', zoomIn);
  toolbar.querySelector('.btn-zoom-out').addEventListener('click', zoomOut);
  toolbar.querySelector('.btn-zoom-reset').addEventListener('click', zoomReset);
  toolbar.querySelector('.btn-zoom-fit').addEventListener('click', zoomFit);
  // Use document-level mouse events so we can drag even when starting over the <object>
  let dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
  let totalDragDist = 0;
  document.addEventListener('mousedown', e => {
    const rect = diagramContainer.getBoundingClientRect();
    const inContainer = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inContainer) return;
    isDragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    panStartX = panX; panStartY = panY;
    totalDragDist = 0;
    diagramContainer.classList.add('dragging');
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    totalDragDist = Math.max(totalDragDist, Math.sqrt(dx*dx + dy*dy));
    panX = panStartX + dx;
    panY = panStartY + dy;
    applyTransform();
  });
  window.addEventListener('mouseup', e => {
    if (isDragging) {
      isDragging = false;
      diagramContainer.classList.remove('dragging');
      // If small movement, treat as click — find ellipse under cursor
      if (totalDragDist < 5 && svgDoc) {
        const result = findEllipseAt(e.clientX, e.clientY);
        if (result) {
          const el = result.el;
          const label = el.getAttribute('inkscape:label');
          if (label) {
            if (label.startsWith('cek_')) {
              const leakId = CEK_MAP[label];
              if (leakId) onCekClick(leakId, label);
            } else if (label.startsWith('bocor_')) {
              const leakId = BOCOR_MAP[label];
              if (leakId) onBocorClick(leakId, label);
            }
          }
        }
      }
    }
  });
  // Track mouse for hover detection
  document.addEventListener('mousemove', e => {
    if (isDragging) return;
    if (!svgDoc) return;
    const rect = diagramContainer.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      // Outside container: clear debug and reset hover
      const overlay = document.getElementById('debugOverlay');
      if (overlay) overlay.textContent = `(outside container) x=${Math.round(e.clientX)}, y=${Math.round(e.clientY)}`;
      return;
    }
    const result = findEllipseAt(e.clientX, e.clientY);
    // Always show debug (even if null)
    if (result) {
      const el = result.el;
      const sx = result.sx;
      const sy = result.sy;
      showDebugOverlay(e.clientX, e.clientY, el, sx, sy);
      const label = el.getAttribute('inkscape:label');
      if (!label) return;
      if (label.startsWith('cek_') && hoverLeakId !== CEK_MAP[label]) {
        onCekHover(CEK_MAP[label], label);
      } else if (label.startsWith('bocor_') && hoverLeakId !== BOCOR_MAP[label]) {
        onBocorHover(BOCOR_MAP[label], label);
      }
    } else {
      // No ellipse hit - show debug with null
      showDebugOverlay(e.clientX, e.clientY, null);
    }
  });
  document.addEventListener('mouseleave', () => {
    if (hoverLeakId) {
      // Reset hover state for all
      Object.keys(CEK_MAP).forEach(label => onCekLeave(CEK_MAP[label], label));
      Object.keys(BOCOR_MAP).forEach(label => onBocorLeave(BOCOR_MAP[label], label));
    }
  });
  // Use document-level wheel listener (object doesn't reliably bubble wheel to parent)
  document.addEventListener('wheel', e => {
    const rect = diagramContainer.getBoundingClientRect();
    const inContainer = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inContainer) return;
    e.preventDefault();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 1/1.1 : 1.1;
    const newZoom = Math.max(0.1, Math.min(20, zoom * delta));
    const factor = (newZoom - zoom) / newZoom;
    panX += mx * factor;
    panY += my * factor;
    zoom = newZoom;
    applyTransform();
  }, { passive: false });
  zoomFit();
}

function applyTransform() {
  if (!svgObj) return;
  // Use CSS transform on #svgWrap for stable viewBox
  const wrap = document.getElementById('svgWrap');
  if (!wrap) return;
  wrap.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  const info = document.querySelector('.viewer-info');
  if (info) info.textContent = `${Math.round(zoom*100)}%`;
}
function zoomFit() {
  if (!svgObj) return;
  zoom = 1; panX = 0; panY = 0;
  baseViewBox = null;  // re-capture
  setTimeout(applyTransform, 50);
}
function zoomReset() {
  zoom = 1; panX = 0; panY = 0;
  baseViewBox = null;
  setTimeout(applyTransform, 50);
}
function zoomIn() { zoom = Math.min(zoom * 1.2, 20); applyTransform(); }
function zoomOut() { zoom = Math.max(zoom / 1.2, 0.1); applyTransform(); }

function onSvgLoaded() {
  svgDoc = svgObj.contentDocument;
  if (!svgDoc) { log('No contentDocument', 'log-err'); return; }
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return;
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  svgEl.style.width = '100%';
  svgEl.style.height = '100%';
  setupCekEllipses();
  hideAllCek();
  // Apply initial zoom/pan state
  baseViewBox = null;  // re-capture for new SVG
  applyTransform();
  log(`SVG loaded: ${countAllObjects()} objects`, 'log-ok');
}

function findByLabel(label) {
  const all = svgDoc.querySelectorAll('ellipse');
  for (const el of all) {
    if (el.getAttribute('inkscape:label') === label) return el;
  }
  return null;
}

/* Find ellipse at screen (x, y) using SVG's screenCTM to inverse-transform
   the mouse coords into SVG user-coords. Then test each ellipse's
   cx, cy, rx, ry attributes (which are in user-coords).
   Returns { el, sx, sy } or null. */
function findEllipseAt(x, y) {
  if (!svgDoc) return null;
  const svgEl = svgDoc.querySelector('svg');
  if (!svgEl) return null;
  // Skip if mouse outside container
  const cRect = document.getElementById('diagram-container').getBoundingClientRect();
  if (!cRect || x < cRect.left || x > cRect.right || y < cRect.top || y > cRect.bottom) return null;
  // Use reliable manual formula: mouseScreen - containerOffset - pan / zoom
  // CSS transform on #svgWrap is: translate(panX, panY) scale(zoom)
  // So screenPoint = svgUserCoord * zoom + (panX, panY) + containerOffset
  // => svgUserCoord = (screenPoint - containerOffset - pan) / zoom
  const relX = x - cRect.left;
  const relY = y - cRect.top;
  const sx = (relX - panX) / zoom;
  const sy = (relY - panY) / zoom;
  // Test each ellipse using its attributes (in user-coords)
  const allLabels = [...Object.keys(CEK_MAP), ...Object.keys(BOCOR_MAP)];
  for (const label of allLabels) {
    const el = findByLabel(label);
    if (!el) continue;
    const ecx = parseFloat(el.getAttribute('cx'));
    const ecy = parseFloat(el.getAttribute('cy'));
    const erx = parseFloat(el.getAttribute('rx'));
    const ery = parseFloat(el.getAttribute('ry'));
    if (isNaN(ecx) || isNaN(ecy) || isNaN(erx) || isNaN(ery)) continue;
    const dx = (sx - ecx) / erx;
    const dy = (sy - ecy) / ery;
    if (dx*dx + dy*dy <= 1) {
      const cs = svgDoc.defaultView.getComputedStyle(el);
      if (cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      return { el, sx, sy };
    }
  }
  return null;
}

function setupCekEllipses() {
  // Hover and click detection now handled via document-level elementFromPoint
  // (works through <object> with pointer-events: none on container)
}

function onBocorHover(leakId, bocorLabel) {
  hoverLeakId = leakId;
  if (activeLeakId === leakId) return;
  // Show paired cek
  const cekEl = findByLabel('cek_' + leakId);
  if (cekEl) {
    cekEl.classList.remove('cek-hidden');
    cekEl.classList.add('cek-shown');
  }
}
function onBocorLeave(leakId, bocorLabel) {
  if (hoverLeakId === leakId) hoverLeakId = null;
  if (activeLeakId === leakId) return;
  // Hide paired cek
  const cekEl = findByLabel('cek_' + leakId);
  if (cekEl) {
    cekEl.classList.remove('cek-shown');
    cekEl.classList.add('cek-hidden');
  }
  // Restore bocor hint
  const bocorEl = findByLabel(bocorLabel);
  if (bocorEl) {
    bocorEl.classList.remove('cek-shown', 'bocor-revealed');
    bocorEl.classList.add('cek-bocor-hint');
    setBocorStyle(bocorEl, 'hidden');
  }
}
function onBocorClick(leakId, bocorLabel) {
  const cekLabel = 'cek_' + leakId;
  if (activeLeakId === leakId) {
    clearActive();
    return;
  }
  onCekClick(leakId, cekLabel);
}

function onCekHover(leakId, cekLabel) {
  hoverLeakId = leakId;
  if (activeLeakId === leakId) return;
  // Show paired cek
  const cekEl = findByLabel(cekLabel);
  if (cekEl) {
    cekEl.classList.remove('cek-hidden');
    cekEl.classList.add('cek-shown');
  }
  // Show paired bocor as preview
  const bocorEl = findByLabel('bocor_' + leakId);
  if (bocorEl) {
    bocorEl.classList.remove('cek-bocor-hint');
    bocorEl.classList.add('cek-bocor-preview');
    setBocorStyle(bocorEl, 'preview');
  }
}
function onCekLeave(leakId, cekLabel) {
  if (hoverLeakId === leakId) hoverLeakId = null;
  if (activeLeakId === leakId) return;
  // Hide previewed bocor
  const bocorEl = findByLabel('bocor_' + leakId);
  if (bocorEl) {
    bocorEl.classList.remove('cek-bocor-preview');
    bocorEl.classList.add('cek-bocor-hint');
    setBocorStyle(bocorEl, 'hidden');
  }
  // Hide cek
  const cekEl = findByLabel(cekLabel);
  if (cekEl) {
    cekEl.classList.remove('cek-shown');
    cekEl.classList.add('cek-hidden');
  }
}
function onCekClick(leakId, clickedCekLabel) {
  if (activeLeakId === leakId) {
    clearActive();
    return;
  }
  clearActive();
  activeLeakId = leakId;
  const dataset = currentSeries === 'F04' ? LEAK_DATA_F04 : LEAK_DATA_F03;
  const data = dataset.find(l => l.id === leakId);
  if (!data) return;
  renderInfoPanel(data);
  const cekEl = findByLabel(clickedCekLabel);
  if (cekEl) {
    cekEl.classList.remove('cek-shown');
    cekEl.classList.add('cek-active');
  }
  const bocorEl = findByLabel('bocor_' + leakId);
  if (bocorEl) {
    bocorEl.classList.remove('cek-bocor-hint', 'cek-shown');
    bocorEl.classList.add('bocor-revealed');
    setBocorStyle(bocorEl, 'active');
  }
  if (soundToggle.checked) playHiss();
}

function hideAllCek() {
  if (!svgDoc) return;
  // Show all cek (yellow pulse hint)
  Object.keys(CEK_MAP).forEach(label => {
    const el = findByLabel(label);
    if (el) {
      el.classList.remove('cek-active', 'cek-hidden');
      el.classList.add('cek-shown');
    }
  });
  // Hide all bocor by default
  Object.keys(BOCOR_MAP).forEach(label => {
    const el = findByLabel(label);
    if (el) {
      el.classList.remove('bocor-revealed', 'cek-bocor-preview', 'cek-shown');
      el.classList.add('cek-bocor-hint');
      setBocorStyle(el, 'hidden');
    }
  });
}

/* Set inline style on bocor ellipse to override SVG attribute fill.
   mode: 'hidden' (opacity 0), 'preview' (yellow pulse), 'active' (orange solid) */
function setBocorStyle(el, mode) {
  if (mode === 'hidden') {
    el.style.opacity = '0';
    el.style.fill = '';
    el.style.fillOpacity = '';
    el.style.stroke = '';
    el.style.pointerEvents = 'none';
  } else if (mode === 'preview') {
    el.style.opacity = '1';
    el.style.fill = '#ffeb3b';
    el.style.fillOpacity = '0.5';
    el.style.stroke = '#fbc02d';
    el.style.strokeWidth = '1.2';
    el.style.pointerEvents = 'auto';
    el.style.cursor = 'pointer';
  } else if (mode === 'active') {
    el.style.opacity = '1';
    el.style.fill = '#ff6b35';
    el.style.fillOpacity = '0.9';
    el.style.stroke = '#fff';
    el.style.strokeWidth = '3';
    el.style.pointerEvents = 'auto';
  }
}

/* Show debug info: mouse coords, element under cursor, label */
function showDebugOverlay(x, y, el, sx, sy) {
  const overlay = document.getElementById('debugOverlay');
  if (!overlay) return;
  // Compute sx, sy from screen coords if not provided
  if (sx === undefined || sy === undefined) {
    if (svgDoc) {
      const svgEl = svgDoc.querySelector('svg');
      if (svgEl) {
        const ctm = svgEl.getScreenCTM();
        if (ctm) {
          const a = ctm.a, b = ctm.b, c = ctm.c, d = ctm.d, e = ctm.e, f = ctm.f;
          const det = a * d - b * c;
          if (det !== 0) {
            sx = (d * (x - e) - b * (y - f)) / det;
            sy = (-c * (x - e) + a * (y - f)) / det;
          }
        }
      }
    }
  }
  const tag = el ? el.tagName.toLowerCase() : 'null';
  const id = el && el.id ? `#${el.id}` : '';
  const label = el && el.getAttribute('inkscape:label') ? `label="${el.getAttribute('inkscape:label')}"` : '';
  const className = el && el.getAttribute('class') ? `class="${el.getAttribute('class')}"` : '';
  // Show container info
  const container = document.getElementById('diagram-container');
  const cRect = container ? container.getBoundingClientRect() : null;
  const containerInfo = cRect ? `container: x=${Math.round(cRect.left)}-${Math.round(cRect.right)} y=${Math.round(cRect.top)}-${Math.round(cRect.bottom)} (${Math.round(cRect.width)}x${Math.round(cRect.height)})` : '';
  // Show mouse user-coords (after transform)
  const userInfo = (sx !== undefined) ? `mouse (user-coord svg): x=${sx.toFixed(2)} y=${sy.toFixed(2)}` : 'mouse (user-coord svg): -';
  // Show pan/zoom state
  const transformInfo = `pan: (${panX.toFixed(1)}, ${panY.toFixed(1)}), zoom: ${zoom.toFixed(2)}`;
  // Compute manual transform (mouseX - containerLeft - panX) / zoom
  let manualX = null, manualY = null;
  if (svgDoc && cRect) {
    const svgEl2 = svgDoc.querySelector('svg');
    if (svgEl2) {
      const a = parseFloat(svgEl2.getAttribute('width')) || 0;
      // Use simple math: relative to container - panX, divided by zoom
      const relX = x - cRect.left;
      const relY = y - cRect.top;
      // The transform is: translate(panX, panY) scale(zoom) which means screen = svg * zoom + pan
      // So svg_x = (screen - pan) / zoom
      manualX = (relX - panX) / zoom;
      manualY = (relY - panY) / zoom;
    }
  }
  const manualInfo = (manualX !== null) ? `manual: x=${manualX.toFixed(2)} y=${manualY.toFixed(2)}` : 'manual: -';
  // Show ellipse info in user-coords (cx, cy, rx, ry from attributes)
  let userCoords = '';
  if (svgDoc) {
    [...Object.keys(CEK_MAP), ...Object.keys(BOCOR_MAP)].forEach(lbl => {
      const e = findByLabel(lbl);
      if (!e) return;
      const cx = e.getAttribute('cx');
      const cy = e.getAttribute('cy');
      const rx = e.getAttribute('rx');
      const ry = e.getAttribute('ry');
      userCoords += `${lbl}: cx=${cx} cy=${cy} rx=${rx} ry=${ry}\n`;
    });
  }
  overlay.textContent = `mouse (screen): x=${Math.round(x)}, y=${Math.round(y)}\n${userInfo}\n${manualInfo}\nhit: <${tag}${id}> ${label} ${className}\n${containerInfo}\n${transformInfo}\n\nellipse attrs (user-coords):\n${userCoords}`;
}

function clearActive() {
  hideAllCek();
  resetInfoPanel();
  activeLeakId = null;
}

function resetInfoPanel() {
  const seriesName = currentSeries === 'F04' ? 'F04 (Pompa Belakang)' : 'F03 (Bullpup - Pompa Depan)';
  infoPanel.innerHTML = `
    <div class="info-empty">
      <h2>Panduan Trouble Shoot ${currentSeries}</h2>
      <p>Unit Airsoft Gun - <b>${seriesName}</b></p>
      <p>Klik area di diagram di mana Anda <b>mendengar suara desisan</b>. Aplikasi akan menunjukkan <b>oring mana yang perlu dicek</b>.</p>
      <hr />
      <h3>Cara Pakai</h3>
      <ol>
        <li>Pompa unit seperti biasa</li>
        <li>Dengarkan di mana ada suara "psshh"</li>
        <li>Klik ellipse <span class="dot dot-bocor" style="vertical-align:middle"></span> <b>kuning</b> di area desisan</li>
        <li>Ellipse <span class="dot dot-leak" style="vertical-align:middle"></span> <b>merah</b> akan muncul menunjukkan oring yang harus diservis</li>
      </ol>
    </div>
  `;
}

function renderInfoPanel(data) {
  const sevClass = 'severity-' + data.severity;
  const causes = data.causes.map(c => `<li>${c}</li>`).join('');
  const solutions = data.solutions.map(s => `<li>${s}</li>`).join('');
  infoPanel.innerHTML = `
    <div class="info-card">
      <h2>Cek Oring #${data.id} - ${data.name}</h2>
      <p class="meta"><b>Seri:</b> ${currentSeries} &nbsp;|&nbsp; <b>Tingkat:</b> <span class="${sevClass}">${data.severity.toUpperCase()}</span></p>
      <h3><span class="badge badge-lokasi">Lokasi Oring</span></h3>
      <p>${data.location}</p>
      <h3><span class="badge badge-suara">Lokasi Desisan</span></h3>
      <p>${data.soundAt}</p>
      <h3><span class="badge" style="background:#ff6b35;color:#fff">Gejala</span></h3>
      <p>${data.symptom}</p>
      <h3><span class="badge badge-penyebab">Penyebab</span></h3>
      <ul>${causes}</ul>
      <h3><span class="badge badge-solusi">Solusi</span></h3>
      <ol>${solutions}</ol>
      <p class="meta" style="margin-top:1rem; font-size:0.8rem;">
        Tips: Gunakan <b>silicone grease</b> (bukan vaseline) untuk o-ring. Bersihkan komponen dengan <b>IPA (isopropyl alcohol)</b> sebelum dipasang ulang.
      </p>
    </div>
  `;
}

function playHiss() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
  }
  try {
    const dur = 0.8;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const t = i / audioCtx.sampleRate;
      const env = Math.exp(-t * 3) * (0.5 + 0.5 * Math.sin(t * 30));
      data[i] = (Math.random() * 2 - 1) * env * 0.15;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    src.connect(filter).connect(audioCtx.destination);
    src.start();
  } catch(e) { /* ignore */ }
}

function countAllObjects() {
  let n = 0;
  svgDoc.querySelectorAll('g[id], rect[id], path[id], circle[id]').forEach(el => {
    if (el.id && el.id !== 'svg1' && el.id !== 'defs1' && el.id !== 'namedview1' && el.tagName.toLowerCase() !== 'ellipse') n++;
  });
  return n;
}

/* ---------- Tabs ---------- */
function setupTabs() {
  tabF04.addEventListener('click', () => switchSeries('F04'));
  tabF03.addEventListener('click', () => switchSeries('F03'));
}
function switchSeries(series) {
  if (series === currentSeries) return;
  currentSeries = series;
  clearActive();
  tabF04.classList.toggle('active', series === 'F04');
  tabF03.classList.toggle('active', series === 'F03');
  tabF04.setAttribute('aria-selected', series === 'F04' ? 'true' : 'false');
  tabF03.setAttribute('aria-selected', series === 'F03' ? 'true' : 'false');
  svgObj.setAttribute('data', (series === 'F04' ? 'serif04.svg' : 'serif03.svg') + '?v=' + Date.now());
  seriesSubtitle.textContent = series === 'F04' ? 'Seri F04 (Pompa Belakang)' : 'Seri F03 — Bullpup (Pompa Depan)';
  seriesName.textContent = series === 'F04' ? 'F04 (Pompa Belakang)' : 'F03 (Bullpup - Pompa Depan)';
  // Hide manometer ellipse for F03 (no manometer there)
  // ...
}

/* ---------- Controls ---------- */
function setupControls() {
  soundToggle.addEventListener('change', () => {
    if (soundToggle.checked && !audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    }
  });
  resetBtn.addEventListener('click', () => {
    clearActive();
    log('Reset', 'log-info');
  });
}

document.addEventListener('DOMContentLoaded', init);

// Prevent default browser zoom on double-click in SVG area
document.addEventListener('dblclick', e => {
  e.preventDefault();
}, { passive: false });
