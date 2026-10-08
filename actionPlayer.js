/* ============================================
   Action Player 3D - serial timeline with absolute start/end per step
   Port dari interaktif/actionPlayer.js (2D SVG) -> three.js.

   Perbedaan inti dengan versi 2D:
   - Target script: "G01".."G08" (toleran G2/G00) = GRUP, selain itu
     objek individu (nama lengkap / gname). Resolusi via window.__f03.
   - Transform diterapkan ke wrapper node (groupNode / animNode) lewat
     matrix langsung (matrixAutoUpdate = false):
         L = P0^-1 . M_world . P0
     dengan P0 = matrixWorld root OBJ. Konjugasi ke P0 (bukan parent
     saat ini) menghasilkan komposisi gaya-SVG:
         world = M_grup . M_individu . rest
     sehingga transform grup MELINGKUPI transform anak.
   - M_world (ruang display/dunia, sesuai konvensi GROUP_DIR):
         M = T(t). T(p). Rz(r). S . T(-p)
     t = X,Y,Z (mm dunia), p = pivot (pusat bbox dunia + offset px,py),
     R = rotasi sekitar sumbu Z dunia (bidang samping), S = scale.
   - Opacity (O) -> material.opacity + userData.animOpacity
     (materialFor di index.html membawanya ke material sorot/toon).
   - Reset mengembalikan semua wrapper ke identity + opacity asli.
   ============================================ */

class ActionPlayer {
  constructor() {
    this.actions = new Map();        // name -> { name, steps, duration }
    this.pivotCache = new Map();     // objId -> {x,y} offset pivot (dari R/P)
    this.targetPivots = new Map();   // objId -> THREE.Vector3 (pusat bbox dunia, di-capture saat play)
    this.currentAction = null;
    this.running = false;
    this.rafId = null;
    this.startTime = 0;
    this.onProgress = null;
    this.onComplete = null;
    this.onActionStart = null;
    this.onTextChange = null;
    this.loop = false;
    this._playScaled = null;

    // scratch matrices (dipakai ulang tiap frame, hindari GC)
    const T = window.__f03 ? window.__f03.THREE : THREE;
    this._M = new T.Matrix4();
    this._L = new T.Matrix4();
    this._T1 = new T.Matrix4();
    this._T2 = new T.Matrix4();
    this._R = new T.Matrix4();
    this._RX = new T.Matrix4();
    this._RY = new T.Matrix4();
    this._S = new T.Matrix4();
    this._P0inv = new T.Matrix4();
    this._box = new T.Box3();
    this._center = new T.Vector3();
    this._Matrix4 = T.Matrix4;
    this._Lmap = new Map();            // objId -> Matrix4 (L persisten, hindari GC)
    this._Vector3 = T.Vector3;
    // env playback (aksi S/CF + jeda P)
    this._env = null;                  // snapshot section + kamera saat play
    this._envActive = false;           // snapshot masih "kotor" (belum direstore)
    this._secSteps = []; this._secInit = null; this._secSig = null;
    this._camSteps = [];
    this._pauses = []; this._pauseIdx = 0;
    this.paused = false; this.pauseAt = 0; this._pauseResumeTimer = null;
    this.onPauseState = null;          // (paused, autoMs) -> UI tombol
  }

  /* Parse script -> actions Map. Grammar sama dengan 2D, ditambah
     sumbu Z (translate) dan SZ (scale). */
  parseScript(text) {
    this.actions = new Map();
    this.pivotCache = new Map();
    const lines = text.split('\n');
    let current = null;
    let lineNo = 0;
    // Waktu relatif: "@+N" = N ms setelah akhir baris script sebelumnya.
    let prevEnd = 0;          // akhir waktu baris sebelumnya (per aksi)
    let serialCursor = 0;     // kursor serial (cermin logika finalize)

    // --- definisi grup custom ("G11=G04,-20,-21,22") ---
    // diproses DULU dan berurutan file, jadi boleh ditulis di mana saja
    // sebelum dipakai. Barisnya dilewati oleh loop parser di bawah.
    const defRe = /^(G\d+)\s*=\s*(.+)$/i;
    const defLines = new Set();
    const defs = [];
    for (let i = 0; i < lines.length; i++) {
      const dm = defRe.exec(lines[i].trim());
      if (!dm) continue;
      defLines.add(i + 1);
      defs.push({
        name: dm[1],
        tokens: dm[2].split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        lineNo: i + 1
      });
    }
    if (window.__f03 && window.__f03.defineCustomGroups) {
      const derr = window.__f03.defineCustomGroups(defs);
      if (derr) return derr;                 // { error: 'Line N: ...' }
    }

    const startNewAction = (name, isComposition, nameEn) => {
      finalize();
      current = { name, nameEn: nameEn || null, steps: [], isComposition, refs: isComposition ? [] : null };
      prevEnd = 0;
      serialCursor = 0;
    };
    const finalize = () => {
      if (!current) return;
      const steps = current.steps;

      // 1) resolve step animasi (serial & range) -> start/end + from/to
      const curVal = new Map();
      let serialCursor = 0;
      for (const s of steps) {
        if (s.isText || s.isSection || s.isCam || s.isPause) continue;
        const objId = s.objId;
        let start, end;
        if (s.range) {
          start = s.range[0];
          end = s.range[1];
          serialCursor = Math.max(serialCursor, end);
        } else {
          start = serialCursor;
          end = serialCursor + s.dur;
          serialCursor = end;
        }
        const from = curVal.has(objId) ? { ...curVal.get(objId) } :
          { x: 0, y: 0, z: 0, r: 0, rx: 0, ry: 0, sx: 1, sy: 1, sz: 1 };
        const to = { ...from };
        if (s.target.X !== undefined) to.x = s.target.X;
        if (s.target.Y !== undefined) to.y = s.target.Y;
        if (s.target.Z !== undefined) to.z = s.target.Z;
        if (s.target.R !== undefined) to.r = s.target.R;
        if (s.target.RX !== undefined) to.rx = s.target.RX;
        if (s.target.RY !== undefined) to.ry = s.target.RY;
        if (s.target.SX !== undefined) to.sx = s.target.SX;
        if (s.target.SY !== undefined) to.sy = s.target.SY;
        if (s.target.SZ !== undefined) to.sz = s.target.SZ;
        if (s.target.O !== undefined) to.o = s.target.O;
        s.start = start; s.end = end; s.from = from; s.to = to;
        curVal.set(objId, to);
      }

      // 2) total durasi (untuk end teks terakhir) = max akhir animasi & mulai teks
      let totalDuration = 0;
      for (const s of steps) {
        if (s.isText) totalDuration = Math.max(totalDuration, s.start);
        else totalDuration = Math.max(totalDuration, s.end);
      }

      // 3) teks: end = mulai teks berikutnya atau totalDuration + grace
      const textSteps = steps.filter(s => s.isText);
      for (let i = 0; i < textSteps.length; i++) {
        if (textSteps[i].end === -1) {
          const next = textSteps[i + 1];
          textSteps[i].end = next ? next.start : totalDuration + 1000;
        }
      }

      const duration = steps.length ? Math.max(...steps.map(s => s.end)) : 0;
      this.actions.set(current.name, {
        name: current.name, nameEn: current.nameEn || null, steps, duration,
        isComposition: !!current.isComposition, refs: current.refs || []
      });
    };

    for (const raw of lines) {
      lineNo++;
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      if (defLines.has(lineNo)) continue;      // baris definisi grup (pre-scan)

      if (line.startsWith('>')) {
        // Judul aksi boleh 2 bahasa: ">namaIND,namaENG"
        const hs = line.slice(1).split(',').map(s => s.trim());
        startNewAction(hs[0] || '', false, hs.length > 1 ? hs.slice(1).join(',').trim() : null);
        continue;
      }
      if (line.startsWith('+')) {
        const ref = line.slice(1).trim();
        if (current && !current.isComposition && current.steps.length === 0) {
          // pola ">nama" lalu "+ref" langsung -> jadikan aksi compose
          current.isComposition = true;
          current.refs = [];
        }
        if (current && current.isComposition) {
          current.refs.push(ref);
        } else {
          // "+ref" setelah aksi berisi step -> compose: aksi sebelumnya + ref.
          // Dibuat sebagai aksi BARU (tak menimpa aksi lain) supaya "+Menembak"
          // di ekor sebuah aksi tidak menghapus aksi "Menembak" yang asli.
          const prev = current ? current.name : null;
          const base = prev ? (prev + ' + ' + ref) : ref;
          startNewAction(base, true);
          let n = 2;
          while (this.actions.has(current.name)) current.name = base + ' (' + (n++) + ')';
          current.refs = prev ? [prev, ref] : [ref];
        }
        continue;
      }

      if (!line.startsWith('@')) {
        return { error: `Line ${lineNo}: expected '@' or '>' or '+'\n  ${line}` };
      }

      if (!current || current.isComposition) {
        if (!current) {
          startNewAction('unnamed_' + lineNo, false);
        } else {
          return { error: `Line ${lineNo}: cannot add steps to composition '${current.name}' (use > to start new action)\n  ${line}` };
        }
      }

      const body = line.slice(1).trim();
      const parts = body.split(',').map(s => s.trim());
      if (parts.length < 2) {
        return { error: `Line ${lineNo}: format '@time,obj,key+val,...'\n  ${line}` };
      }
      let timeStr = parts[0];
      let relInstant = false;      // "@+N" polos -> set langsung (durasi 0)

      // Waktu relatif: "@[+]N" -> absolut (akhir baris sebelumnya + N), N boleh
      // negatif (mis. "@+-1000+1000"); sisanya di belakang (+100 / -200 / +100+100)
      // diterjemahkan seperti biasa. Tanpa sisanya = set nilai langsung.
      if (timeStr.charAt(0) === '+') {
        const rm = /^\+(-?\d+)/.exec(timeStr);
        if (!rm) {
          return { error: `Line ${lineNo}: invalid relative time '${timeStr}'\n  ${line}` };
        }
        const rest = timeStr.slice(rm[0].length);
        timeStr = String(prevEnd + parseInt(rm[1], 10)) + rest;
        relInstant = rest === '';
      }

      // Teks overlay: @t,T,teks  atau  @t,T,teksIND,teksENG
      // (hindari koma di dalam teks — koma = pemisah bahasa)
      if (parts[1] === 'T') {
        const segs = parts.slice(2).map(s => s.trim());
        const textId = segs[0] || '';
        const textEn = segs.length > 1 ? segs.slice(1).join(',').trim() : null;
        if (!textId) {
          return { error: `Line ${lineNo}: empty text after 'T'\n  ${line}` };
        }
        let tStart, tEnd;
        if (timeStr.includes('-')) {
          const segs2 = timeStr.split('-').map(s => parseInt(s.trim()));
          tStart = segs2[0]; tEnd = segs2[1];
        } else {
          tStart = parseInt(timeStr);
          tEnd = -1;  // sentinel: diganti di finalize
        }
        prevEnd = (tEnd === -1) ? tStart : tEnd;
        current.steps.push({ objId: 'TEXT', text: textId, textEn, start: tStart, end: tEnd, isText: true, lineNo });
        continue;
      }

      // Section view per objek: @waktu,S,grup/objek,on|off
      // waktu = ms absolut (sama dengan teks); on -> objek itu di-section
      if (parts[1] === 'S') {
        if (parts.length < 4) {
          return { error: `Line ${lineNo}: format '@waktu,S,grup/objek,on|off'\n  ${line}` };
        }
        const starget = parts[2];
        const son = /^(on|1)$/i.test(parts[3]);
        if (!son && !/^(off|0)$/i.test(parts[3])) {
          return { error: `Line ${lineNo}: state section harus on/off (dapat '${parts[3]}')\n  ${line}` };
        }
        const sAt = parseInt(timeStr.split(/[-+]/)[0]);
        if (isNaN(sAt) || sAt < 0) {
          return { error: `Line ${lineNo}: invalid time '${timeStr}'\n  ${line}` };
        }
        prevEnd = sAt;
        current.steps.push({ objId: 'SECTION', target: starget, on: son, start: sAt, end: sAt, isSection: true, lineNo });
        continue;
      }

      // Camera focus (pan ke objek): @waktu,CF,grup/objek,jarak
      // @a-b / @a+d = pan mulus; @waktu polos = snap. jarak = jarak kamera
      // ke pusat objek (mm); arah pandang dikunci -> panning tanpa rotasi.
      if (parts[1] === 'CF') {
        if (parts.length < 4) {
          return { error: `Line ${lineNo}: format '@waktu,CF,grup/objek,jarak'\n  ${line}` };
        }
        const ctarget = parts[2];
        const cdist = parseFloat(parts[3]);
        if (isNaN(cdist) || cdist <= 0) {
          return { error: `Line ${lineNo}: jarak CF tidak valid '${parts[3]}'\n  ${line}` };
        }
        let cStart, cEnd;
        if (timeStr.includes('-')) {
          const segs = timeStr.split('-').map(s => parseInt(s.trim()));
          cStart = segs[0]; cEnd = segs[1];
        } else if (timeStr.includes('+')) {
          const segs = timeStr.split('+').map(s => parseInt(s.trim()));
          cStart = segs[0]; cEnd = segs[0] + segs[1];
        } else {
          cStart = cEnd = parseInt(timeStr);
        }
        if (isNaN(cStart) || isNaN(cEnd) || cEnd < cStart || cStart < 0) {
          return { error: `Line ${lineNo}: invalid time '${timeStr}'\n  ${line}` };
        }
        prevEnd = cEnd;
        current.steps.push({ objId: 'CAM', target: ctarget, dist: cdist, start: cStart, end: cEnd, isCam: true, lineNo });
        continue;
      }

      // Jeda script: @waktu,P[,auto_ms] — auto kosong = tunggu user klik
      // Lanjut; isi 1000 = auto-resume setelah 1000ms.
      if (parts[1] === 'P') {
        const pAt = parseInt(timeStr.split(/[-+]/)[0]);
        if (isNaN(pAt) || pAt < 0) {
          return { error: `Line ${lineNo}: invalid time '${timeStr}'\n  ${line}` };
        }
        let pAuto = 0;
        if (parts.length > 2 && parts[2] !== '') {
          pAuto = parseInt(parts[2]);
          if (isNaN(pAuto) || pAuto < 0) {
            return { error: `Line ${lineNo}: auto-resume P tidak valid '${parts[2]}'\n  ${line}` };
          }
        }
        prevEnd = pAt;
        current.steps.push({ objId: 'PAUSE', start: pAt, end: pAt, autoMs: pAuto, isPause: true, lineNo });
        continue;
      }

      // Waktu: @dur | @start-end | @start+offset | @+N (set langsung)
      let dur = 0, range = null;
      if (relInstant) {
        const b = parseInt(timeStr, 10);
        if (isNaN(b) || b < 0) {
          return { error: `Line ${lineNo}: waktu relatif di luar rentang ('${parts[0]}' -> ${b}ms)\n  ${line}` };
        }
        range = [b, b];              // durasi 0: set nilai langsung, tanpa animasi
      } else if (timeStr.includes('-')) {
        const segs = timeStr.split('-').map(s => parseInt(s.trim()));
        if (segs.length !== 2 || isNaN(segs[0]) || isNaN(segs[1]) || segs[1] <= segs[0]) {
          return { error: `Line ${lineNo}: invalid range '${timeStr}'\n  ${line}` };
        }
        range = segs;
      } else if (timeStr.includes('+')) {
        const segs = timeStr.split('+').map(s => parseInt(s.trim()));
        if (segs.length !== 2 || isNaN(segs[0]) || isNaN(segs[1]) || segs[1] <= 0) {
          return { error: `Line ${lineNo}: invalid offset '${timeStr}'\n  ${line}` };
        }
        range = [segs[0], segs[0] + segs[1]];
      } else {
        dur = parseInt(timeStr);
        if (isNaN(dur) || dur <= 0) {
          return { error: `Line ${lineNo}: invalid time '${timeStr}'\n  ${line}` };
        }
      }
      // Simpan akhir baris ini sebagai acuan "@+N" untuk baris berikutnya.
      if (range) {
        prevEnd = range[1];
        serialCursor = Math.max(serialCursor, range[1]);
      } else {
        serialCursor += dur;
        prevEnd = serialCursor;
      }
      const objId = parts[1];
      const restStr = parts.slice(2).join(',');
      const restParts = restStr.split(';');   // pisah banyak param
      const target = {};
      let pivot = null;
      for (const part of restParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Format pivot: P±x,±y (juga di-cache utk R berikutnya pada objek sama)
        const pm = trimmed.match(/^P([+\-]?)([\d.]+),([+\-]?)([\d.]+)$/);
        if (pm) {
          pivot = { x: parseFloat((pm[1] || '') + pm[2]), y: parseFloat((pm[3] || '') + pm[4]) };
          this.pivotCache.set(objId, pivot);
          continue;
        }
        // Axis: X,Y,Z,R,RX,RY,O,SX,SY,SZ (+ pivot opsional utk R/RX/RY: R<val>,<px>,<py>)
        const m = trimmed.match(/^([XYZRO]|SX|SY|SZ|RX|RY)([+\-]?)([\d.]+)(?:,([+\-]?)([\d.]+)(?:,([+\-]?)([\d.]+))?)?$/);
        if (!m) {
          return { error: `Line ${lineNo}: bad param '${trimmed}'\n  ${line}` };
        }
        const axis = m[1];
        const sign = m[2];
        const val = parseFloat(m[3]);
        target[axis] = sign === '-' ? -val : val;
        if ((axis === 'R' || axis === 'RX' || axis === 'RY') && m[4] !== undefined) {
          pivot = { x: parseFloat((m[4] || '') + m[5]), y: parseFloat((m[6] || '') + m[7]) };
          this.pivotCache.set(objId, pivot);
        }
      }
      // Rotasi tanpa pivot -> pakai pivot terakhir yang di-cache utk objId ini
      if ((target.R !== undefined || target.RX !== undefined || target.RY !== undefined) &&
          !pivot && this.pivotCache.has(objId)) {
        pivot = this.pivotCache.get(objId);
      }
      current.steps.push({ objId, target, dur, range, pivot, lineNo });
    }
    finalize();

    // Resolve compositions: expand +refs jadi step inline (shift waktu)
    // Ref boleh memakai nama IND atau nama ENG.
    const findAction = (ref) => {
      if (this.actions.has(ref)) return this.actions.get(ref);
      for (const a of this.actions.values()) if (a.nameEn === ref) return a;
      // ref boleh ditulis "namaID,namaEN" (mis. copy langsung dari judul aksi)
      const first = String(ref).split(',')[0].trim();
      if (first && first !== ref) {
        if (this.actions.has(first)) return this.actions.get(first);
        for (const a of this.actions.values()) if (a.nameEn === first) return a;
      }
      return null;
    };
    for (const [name, action] of this.actions) {
      if (action.isComposition) {
        const composed = [];
        let cursor = 0;
        for (const ref of action.refs) {
          if (ref === name) continue;              // skip self-reference
          const refAction = findAction(ref);
          if (!refAction) {
            return { error: `Composition '${name}': action '${ref}' not found` };
          }
          for (const step of refAction.steps) {
            composed.push({ ...step, start: step.start + cursor, end: step.end + cursor, from: { ...step.from }, to: { ...step.to } });
          }
          cursor = Math.max(cursor + refAction.duration, composed.length ? composed[composed.length - 1].end : 0);
        }
        action.steps = composed;
        action.isComposition = false;
        action.refs = null;
        action.duration = Math.max(0, ...composed.map(s => s.end));
      }
    }

    return { actions: this.actions };
  }

  /* Capture pivot (pusat bbox dunia) utk setiap objId dalam action.
     Dipanggil dari play() SETELAH reset, sehingga selalu dari state rest. */
  capturePivots(action) {
    const F = window.__f03;
    this.targetPivots = new Map();
    if (!F || !F.ready() || !action) return;
    F.rootWorld();  // segarkan matrixWorld rantai parent
    const seen = new Set();
    for (const step of action.steps) {
      if (step.isText || step.isSection || step.isPause) continue;
      const objId = step.isCam ? step.target : step.objId;
      if (!objId || seen.has(objId)) continue;
      seen.add(objId);
      const tgt = F.resolveTarget(objId);
      if (!tgt) continue;
      this._box.makeEmpty();
      for (const n of tgt.nodes) {
        const b = new F.THREE.Box3().setFromObject(n);
        if (!b.isEmpty()) this._box.union(b);
      }
      if (!this._box.isEmpty()) {
        this.targetPivots.set(objId, this._box.getCenter(new F.THREE.Vector3()));
      }
    }
  }

  pivotOf(objId) {
    return this.targetPivots.get(objId) || null;
  }

  /* Kembalikan semua wrapper + material ke keadaan awal (tanpa stop). */
  resetVisual() {
    const F = window.__f03;
    if (!F) return;
    F.resetAnimNodes();
    const parts = F.getParts();
    for (const m of parts) {
      if (m.userData.animOpacity === undefined) continue;
      delete m.userData.animOpacity;
      const base = m.userData.baseMaterial;
      const bo = m.userData.baseOpacity !== undefined ? m.userData.baseOpacity : 1;
      const bt = !!m.userData.baseTransparent;
      if (base) { base.opacity = bo; base.transparent = bt; }
      if (m.material && m.material !== base) { m.material.opacity = bo; m.material.transparent = bt; }
    }
    if (this.onTextChange) this.onTextChange(null, false);
  }

  reset() {
    this.stop();
    this.restoreEnv();
    this._envActive = false;
    this.resetVisual();
  }

  /* ---- env: section + kamera utk aksi S/CF (snapshot & restore) ---- */
  restoreEnv() {
    const F = window.__f03;
    if (!F || !this._env || !F.restoreEnv) return;
    F.restoreEnv(this._env);
  }

  // Rencana pan kamera per step CF: from -> to dihitung SAAT step mulai
  // (arah pandang = kamera saat itu -> panning tanpa rotasi, kamera bebas
  // digeser user sebelum CF). Pusat objek dari pivot capture.
  prepareCam(action) {
    this._camSteps = [];
    const F = window.__f03;
    if (!F || !action || !F.getCam) return;
    this._camSteps = action.steps.filter(function (s) { return s.isCam; })
      .sort(function (a, b) { return a.start - b.start; })
      .map(function (s) {
        return { start: s.start, end: s.end, dist: s.dist, target: s.target, _from: null, _to: null };
      });
  }

  _armCam(s) {
    const F = window.__f03;
    const init = F.getCam();
    const V = this._Vector3;
    const dir = new V().fromArray(init.pos).sub(new V().fromArray(init.tgt));
    if (dir.lengthSq() < 1e-9) dir.set(0, 0, 1);
    dir.normalize();
    const c = this.pivotOf(s.target);
    s._from = init;
    s._to = c ? {
      pos: [c.x + dir.x * s.dist, c.y + dir.y * s.dist, c.z + dir.z * s.dist],
      tgt: [c.x, c.y, c.z]
    } : init;
  }

  applyCam(t) {
    const F = window.__f03;
    if (!F || !this._camSteps.length || !F.setCam) return;
    const first = this._camSteps[0];
    if (t < first.start) {
      // belum waktunya CF: kamera TIDAK disentuh (user bebas geser/putar),
      // rencana pan di-reset supaya di-arm ulang dari posisi terbaru
      for (const s of this._camSteps) { s._from = null; s._to = null; }
      return;
    }
    // kamera HANYA dikendalikan selama range CF (snap: satu frame saat masuk);
    // di luar itu kontrol dilepas lagi ke user.
    let state = null;
    for (const s of this._camSteps) {
      if (t < s.start) break;
      const armed = !!s._to;
      if (!armed) this._armCam(s);
      if (s.end <= s.start) {
        if (!armed) state = s._to;       // snap: jepret sekali, lalu lepas
        continue;
      }
      if (t >= s.end) continue;          // range selesai -> kamera lepas
      const f = (t - s.start) / (s.end - s.start);
      state = {
        pos: [s._from.pos[0] + (s._to.pos[0] - s._from.pos[0]) * f,
              s._from.pos[1] + (s._to.pos[1] - s._from.pos[1]) * f,
              s._from.pos[2] + (s._to.pos[2] - s._from.pos[2]) * f],
        tgt: [s._from.tgt[0] + (s._to.tgt[0] - s._from.tgt[0]) * f,
              s._from.tgt[1] + (s._to.tgt[1] - s._from.tgt[1]) * f,
              s._from.tgt[2] + (s._to.tgt[2] - s._from.tgt[2]) * f]
      };
      break;
    }
    if (state) F.setCam(state.pos, state.tgt);
  }

  // State section per waktu: snapshot awal lalu step S berurutan sampai t.
  // Di-apply hanya saat berubah (rebuild stencil tidak murah).
  applySec(t) {
    const F = window.__f03;
    if (!F || !this._secSteps.length || !F.setSecState) return;
    const state = { master: this._secInit.master, objs: Object.assign({}, this._secInit.objs) };
    for (const s of this._secSteps) {
      if (s.start > t) break;
      const tgt = F.resolveTarget(s.target);
      if (!tgt) continue;
      tgt.meshes.forEach(function (m) {
        const k = m.userData.uid || m.name;
        if (s.on) { state.objs[k] = true; state.master = true; }
        else delete state.objs[k];
      });
    }
    const sig = JSON.stringify(state);
    if (sig === this._secSig) return;
    this._secSig = sig;
    F.setSecState(state);
  }

  /* ---- jeda playback: tombol Pause/Stop + step P di script ---- */
  checkPauses(elapsed) {
    const list = this._pauses;
    if (!list || this._pauseIdx >= list.length) return;
    const p = list[this._pauseIdx];
    if (p.start > elapsed) return;
    this._pauseIdx++;
    this.pausePlay(elapsed, p.autoMs || 0);
  }

  pausePlay(elapsed, autoMs) {
    if (!this.running) return;
    this.paused = true;
    this.pauseAt = elapsed;
    if (this._pauseResumeTimer) {
      clearTimeout(this._pauseResumeTimer);
      this._pauseResumeTimer = null;
    }
    if (autoMs > 0) {
      const self = this;
      this._pauseResumeTimer = setTimeout(function () {
        self._pauseResumeTimer = null;
        self.resumePlay();
      }, autoMs);
    }
    if (this.onPauseState) this.onPauseState(true, autoMs || 0);
  }

  resumePlay() {
    if (!this.running || !this.paused) return;
    if (this._pauseResumeTimer) {
      clearTimeout(this._pauseResumeTimer);
      this._pauseResumeTimer = null;
    }
    this.paused = false;
    this.startTime = performance.now() - this.pauseAt;
    if (this.onPauseState) this.onPauseState(false, 0);
  }

  togglePause() {
    if (!this.running) return;
    if (this.paused) this.resumePlay();
    else this.pausePlay(performance.now() - this.startTime, 0);
  }

  /* Geser posisi playback (seek) — timeline. SELALU mem-pause, dan tetap
     bisa dipakai saat sudah paused (menggeser lagi). */
  seek(t) {
    if (!this.running) return;
    const action = this._playScaled || this.actions.get(this.currentAction);
    if (!action || !action.duration) return;
    t = Math.max(0, Math.min(action.duration, t));
    this.paused = true;
    this.pauseAt = t;
    if (this._pauseResumeTimer) {
      clearTimeout(this._pauseResumeTimer);
      this._pauseResumeTimer = null;
    }
    // state yang bergantung urutan waktu di-reset supaya seek maju/mundur benar
    this._secSig = null;
    if (this._camSteps) this._camSteps.forEach(function (s) { s._from = null; s._to = null; });
    this._pauseIdx = 0;
    if (this._pauses) {
      while (this._pauseIdx < this._pauses.length && this._pauses[this._pauseIdx].start <= t) this._pauseIdx++;
    }
    this.applyState(action, t);
    if (this.onProgress) this.onProgress(t / action.duration, t, action.duration);
    if (this.onPauseState) this.onPauseState(true, 0);
  }

  setMeshOpacity(m, o) {
    m.userData.animOpacity = o;
    const bt = !!m.userData.baseTransparent;
    const transparent = o < 0.999 || bt;
    const base = m.userData.baseMaterial;
    if (base) { base.opacity = o; base.transparent = transparent; }
    if (m.material && m.material !== base) { m.material.opacity = o; m.material.transparent = transparent; }
  }

  /* Terapkan state animasi pada waktu t (ms). */
  applyState(action, t) {
    const F = window.__f03;
    if (!F || !action) return;

    // --- teks overlay (pilih bahasa: IND/ENG) ---
    let activeText = null;
    const wantId = (typeof window !== 'undefined' && window.__lang === 'id');
    for (const step of action.steps) {
      if (step.isText && t >= step.start && t < step.end) {
        activeText = (step.textEn == null) ? step.text : (wantId ? step.text : step.textEn);
      }
    }
    if (this.onTextChange) this.onTextChange(activeText, activeText !== null);

    // --- aksi state: section (S) & camera focus (CF) ---
    this.applySec(t);
    this.applyCam(t);

    // --- kelompokkan step per objId (non-teks) ---
    const byObj = new Map();
    for (const step of action.steps) {
      if (step.isText || step.isSection || step.isCam || step.isPause) continue;
      if (!byObj.has(step.objId)) byObj.set(step.objId, []);
      byObj.get(step.objId).push(step);
    }
    if (!byObj.size) return;

    // P0 = matrixWorld root OBJ (segarkan parent chain sekali per frame)
    const P0 = F.rootWorld();
    if (!P0) return;
    this._P0inv.copy(P0).invert();

    // pass 1: hitung L per objId. Grup bawaan langsung ditulis ke node
    // pembungkus (parent); individu & grup custom dikumpul per mesh dulu,
    // karena transform keduanya harus berkomposisi di animNode yang sama
    // (grup custom membungkus individu — ekuivalen grup bawaan via parent).
    const pend = new Map();            // mesh -> [{ ord, L }]
    const ensure = function (m) {
      let a = pend.get(m);
      if (!a) { a = []; pend.set(m, a); }
      return a;
    };

    for (const [objId, steps] of byObj) {
      // step aktif = terakhir yang start <= t
      let active = null;
      for (const step of steps) {
        if (step.start <= t) active = step;
        else break;
      }

      const tgt = F.resolveTarget(objId);
      if (!tgt) continue;

      if (!active) {
        // belum ada step -> kembali ke rest (identity)
        if (tgt.kind === 'group') {
          for (const n of tgt.nodes) {
            n.matrix.identity();
            n.matrixWorldNeedsUpdate = true;
          }
        } else {
          tgt.meshes.forEach(ensure);   // tandai disentuh -> identity di pass 2
        }
        continue;
      }

      // interpolasi from -> to
      const f = active.from, to = active.to;
      let x = f.x, y = f.y, z = f.z, r = f.r, rx = f.rx || 0, ry = f.ry || 0;
      let sx = f.sx, sy = f.sy, sz = f.sz, o = f.o;
      if (t >= active.end) {
        x = to.x; y = to.y; z = to.z; r = to.r; rx = to.rx || 0; ry = to.ry || 0;
        sx = to.sx; sy = to.sy; sz = to.sz;
        if (to.o !== undefined) o = to.o;
      } else if (t > active.start) {
        const frac = (t - active.start) / (active.end - active.start);
        x = f.x + (to.x - f.x) * frac;
        y = f.y + (to.y - f.y) * frac;
        z = f.z + (to.z - f.z) * frac;
        r = f.r + (to.r - f.r) * frac;
        rx = (f.rx || 0) + ((to.rx || 0) - (f.rx || 0)) * frac;
        ry = (f.ry || 0) + ((to.ry || 0) - (f.ry || 0)) * frac;
        sx = f.sx + (to.sx - f.sx) * frac;
        sy = f.sy + (to.sy - f.sy) * frac;
        sz = f.sz + (to.sz - f.sz) * frac;
        if (f.o !== undefined || to.o !== undefined) {
          const of = f.o !== undefined ? f.o : 1;
          const ot = to.o !== undefined ? to.o : of;
          o = of + (ot - of) * frac;
        }
      }

      // pivot = pusat bbox dunia + offset step
      const pv = this.pivotOf(objId);
      const so = active.pivot;
      const px = (pv ? pv.x : 0) + (so ? so.x : 0);
      const py = (pv ? pv.y : 0) + (so ? so.y : 0);
      const pz = pv ? pv.z : 0;

      // M = T(t) . T(p) . (Rz.Ry.Rx) . S . T(-p)   (ruang dunia/display)
      this._M.makeTranslation(x, y, z);
      this._T1.makeTranslation(px, py, pz);
      this._RX.makeRotationX(rx * Math.PI / 180);
      this._RY.makeRotationY(ry * Math.PI / 180);
      this._R.makeRotationZ(r * Math.PI / 180);
      this._R.multiply(this._RY).multiply(this._RX);     // Rx dulu, lalu Ry, lalu Rz
      this._S.makeScale(sx, sy, sz);
      this._T2.makeTranslation(-px, -py, -pz);
      this._M.multiply(this._T1).multiply(this._R).multiply(this._S).multiply(this._T2);

      // L = P0^-1 . M . P0  -> komposisi grup x individu gaya-SVG
      this._L.multiplyMatrices(this._P0inv, this._M).multiply(P0);

      // opacity (hanya kalau pernah disebut utk objId ini)
      if (active.to.o !== undefined || active.from.o !== undefined) {
        const oo = o !== undefined ? o : 1;
        for (const m of tgt.meshes) this.setMeshOpacity(m, oo);
      }

      if (tgt.kind === 'group') {
        for (const n of tgt.nodes) {
          n.matrix.copy(this._L);
          n.matrixWorldNeedsUpdate = true;
        }
      } else {
        let Lm = this._Lmap.get(objId);
        if (!Lm) { Lm = new this._Matrix4(); this._Lmap.set(objId, Lm); }
        Lm.copy(this._L);
        const ord = tgt.kind === 'custom' ? tgt.ord : Number.MAX_SAFE_INTEGER;
        tgt.meshes.forEach(function (m) { ensure(m).push({ ord: ord, L: Lm }); });
      }
    }

    // pass 2: animNode = perkalian kontribusi (luar -> dalam)
    pend.forEach(function (contribs, m) {
      const an = F.getAnimNode(m);
      if (!an) return;
      if (contribs.length) {
        contribs.sort(function (a, b) { return a.ord - b.ord; });
        an.matrix.copy(contribs[0].L);
        for (let i = 1; i < contribs.length; i++) an.matrix.multiply(contribs[i].L);
      } else {
        an.matrix.identity();
      }
      an.matrixWorldNeedsUpdate = true;
    });

    // segarkan subtree wrapper dulu (matrixAutoUpdate=false) baru baca selBox
    F.refreshTree();
    F.updateSelBox();
  }

  /* Putar aksi. name -> action; pakai _playScaled kalau ada (dari editor). */
  play(name) {
    const action = this._playScaled || this.actions.get(name);
    if (!action) {
      console.warn('Action not found:', name);
      return;
    }
    if (!action.steps.length || action.duration <= 0) {
      console.warn('Action kosong:', name);
      return;
    }
    this.stop();
    // run sebelumnya terputus di tengah (env masih kotor) -> bersihkan dulu;
    // kalau sudah selesai normal, JANGAN restore — biarkan posisi kamera /
    // section pilihan user antar-play apa adanya jadi baseline run ini.
    if (this._envActive) this.restoreEnv();
    this.resetVisual();          // pastikan rest sebelum capture pivot
    const F = window.__f03;
    this._env = F && F.captureEnv ? F.captureEnv() : null;
    this._envActive = !!this._env;
    this._secInit = this._env
      ? { master: this._env.sec.master, objs: Object.assign({}, this._env.sec.objs) }
      : { master: true, objs: {} };
    this._secSteps = action.steps.filter(function (s) { return s.isSection; })
      .sort(function (a, b) { return a.start - b.start; });
    this._secSig = null;
    this._camSteps = [];
    this._pauses = action.steps.filter(function (s) { return s.isPause; })
      .sort(function (a, b) { return a.start - b.start; });
    this._pauseIdx = 0;
    this.paused = false;
    this.pauseAt = 0;
    if (this._pauseResumeTimer) { clearTimeout(this._pauseResumeTimer); this._pauseResumeTimer = null; }
    this.capturePivots(action);
    this.prepareCam(action);
    this.currentAction = name;
    if (this.onActionStart) this.onActionStart(name, action);
    this.running = true;
    this.startTime = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      if (!this.paused) this.checkPauses(now - this.startTime);
      const elapsed = this.paused ? this.pauseAt : now - this.startTime;
      if (elapsed >= action.duration) {
        this.applyState(action, action.duration);
        if (this.onProgress) this.onProgress(1, action.duration, action.duration);
        this.restoreEnv();       // section + kamera -> kondisi awal sebelum play
        if (this.onComplete) this.onComplete(name);
        if (this.loop) {
          this.resetVisual();     // reset TANPA stop supaya loop benar2 berputar
          this._pauseIdx = 0;
          this.startTime = now;
        } else {
          this._envActive = false;
          this.running = false;
          return;
        }
      } else {
        this.applyState(action, elapsed);
        if (this.onProgress) this.onProgress(elapsed / action.duration, elapsed, action.duration);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this._pauseResumeTimer) { clearTimeout(this._pauseResumeTimer); this._pauseResumeTimer = null; }
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}

window.ActionPlayer = ActionPlayer;
