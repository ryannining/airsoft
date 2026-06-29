/* ============================================
   Action Player v3 - serial timeline with absolute start/end per step
   ============================================ */

class ActionPlayer {
  constructor(svgDoc) {
    this.svgDoc = svgDoc;
    this.actions = new Map();   // name -> { steps: [ {start, end, objId, target} ], duration }
    this.pivotCache = new Map();  // objId -> {x,y} (pivot from previous R step on same obj)
    this.currentAction = null;
    this.running = false;
    this.rafId = null;
    this.startTime = 0;
    this.onProgress = null;
    this.onComplete = null;
    this.onActionStart = null;
    this.loop = false;
    this.originalTransforms = null;
  }

  /* Parse script text -> actions Map
     Format:
       >nama_aksi
       @durasi,obj,X15          (serial: durasi ms, target X=15)
       @start-end,obj,X15       (absolut: window start-end, target X=15)
       +nama_aksi_lain          (compose)
  */
  parseScript(text) {
    this.actions = new Map();  // reset
    this.pivotCache = new Map();  // reset pivot cache
    const lines = text.split('\n');
    let current = null;
    let lineNo = 0;
    let pendingRefs = null;  // for composition lines under >parent

    const startNewAction = (name, isComposition) => {
      finalize();
      current = { name, steps: [], isComposition, refs: isComposition ? [] : null };
    };
    const finalize = () => {
      if (current) {
        // First: resolve text steps with end=-1 (duration form)
        // Each text step is visible from its start until the next text step's start
        const textSteps = current.steps.filter(s => s.isText);
        // Compute action total duration
        const totalDuration = current.steps.reduce((max, s) => {
          if (s.isText) return Math.max(max, s.start);
          if (s.range) return Math.max(max, s.range[1]);
          if (s.dur) return Math.max(max, serialCursor, s.start + s.dur);
          return max;
        }, 0);
        // For each text step with end=-1, set end to next text step's start or totalDuration
        for (let i = 0; i < textSteps.length; i++) {
          if (textSteps[i].end === -1) {
            const next = textSteps[i + 1];
            textSteps[i].end = next ? next.start : totalDuration + 1000;  // +1000ms grace
          }
        }
        // Now finalize animation steps
        const steps = current.steps;
        const curVal = new Map();
        let serialCursor = 0;
        for (const s of steps) {
          if (s.isText) continue;
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
          const from = curVal.has(objId) ? { ...curVal.get(objId) } : { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
          const to = { ...from };
          if (s.target.X !== undefined) to.x = s.target.X;
          if (s.target.Y !== undefined) to.y = s.target.Y;
          if (s.target.R !== undefined) to.r = s.target.R;
          if (s.target.SX !== undefined) to.sx = s.target.SX;
          if (s.target.SY !== undefined) to.sy = s.target.SY;
          if (s.target.O !== undefined) to.o = s.target.O;
          if (s.target.SX !== undefined) to.sx = s.target.SX;
          if (s.target.SY !== undefined) to.sy = s.target.SY;
          // Save
          s.start = start; s.end = end; s.from = from; s.to = to;
          // Carry
          curVal.set(objId, to);
        }
        const duration = steps.length ? Math.max(...steps.map(s => s.end)) : 0;
        this.actions.set(current.name, { name: current.name, steps, duration });
      }
    };

    for (const raw of lines) {
      lineNo++;
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('>')) {
        startNewAction(line.slice(1).trim(), false);
        continue;
      }
      if (line.startsWith('+')) {
        // Composition: add ref to current action's refs list
        if (current && current.isComposition) {
          const ref = line.slice(1).trim();
          current.refs = current.refs || [];
          current.refs.push(ref);
        } else {
          // Start a new composition action with this ref
          startNewAction(line.slice(1).trim(), true);
          current.refs = [line.slice(1).trim()];
        }
        continue;
      }

      if (!line.startsWith('@')) {
        return { error: `Line ${lineNo}: expected '@' or '>' or '+'\n  ${line}` };
      }

      if (!current || current.isComposition) {
        // Cannot define steps on a composition action; start a new one if needed
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
      const timeStr = parts[0];

      // Special: if objId is 'T' (text overlay), handle as text step
      if (parts[1] === 'T') {
        const text = parts.slice(2).join(',').trim();
        if (!text) {
          return { error: `Line ${lineNo}: empty text after 'T'\n  ${line}` };
        }
        // For range form @start-end: text visible during [start, end]
        // For duration form @N: text visible from t=N until the next text step or action end
        let tStart, tEnd;
        if (timeStr.includes('-')) {
          const segs = timeStr.split('-').map(s => parseInt(s.trim()));
          tStart = segs[0]; tEnd = segs[1];
        } else {
          // Duration form: text shown starting at t=N, until the next text step replaces it
          // We use a sentinel tStart that is updated in finalize based on next text step
          tStart = parseInt(timeStr);
          tEnd = -1;  // sentinel: replaced by next text step
        }
        current.steps.push({ objId: 'TEXT', text, start: tStart, end: tEnd, isText: true, lineNo });
        continue;
      }

      // Parse time: @dur (int) | @start-end (abs range) | @start+offset (abs + rel)
      let dur = 0, range = null;
      if (timeStr.includes('-')) {
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
        // @start+offset: absolute start, end = start + offset
        range = [segs[0], segs[0] + segs[1]];
      } else {
        dur = parseInt(timeStr);
        if (isNaN(dur) || dur <= 0) {
          return { error: `Line ${lineNo}: invalid time '${timeStr}'\n  ${line}` };
        }
      }
      const objId = parts[1];
      // Re-join the rest so axis params with their own commas stay together
      const restStr = parts.slice(2).join(',');
      const restParts = restStr.split(';');  // use ; to separate multiple key=value pairs
      const target = {};
      let pivot = null;
      for (const part of restParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Try P format first
        const pm = trimmed.match(/^P([+\-]?)([\d.]+),([+\-]?)([\d.]+)$/);
        if (pm) {
          pivot = { x: parseFloat((pm[1]||'') + pm[2]), y: parseFloat((pm[3]||'') + pm[4]) };
          continue;
        }
        // Try axis format with optional pivot (X, Y, R, O, SX, SY)
        const m = trimmed.match(/^([XYRO]|SX|SY)([+\-]?)([\d.]+)(?:,([+\-]?)([\d.]+)(?:,([+\-]?)([\d.]+))?)?$/);
        if (!m) {
          return { error: `Line ${lineNo}: bad param '${trimmed}'\n  ${line}` };
        }
        const axis = m[1];
        const sign = m[2];
        const val = parseFloat(m[3]);
        target[axis] = sign === '-' ? -val : val;
        if (axis === 'R' && m[4] !== undefined) {
          pivot = { x: parseFloat((m[4]||'') + m[5]), y: parseFloat((m[6]||'') + m[7]) };
          // Cache this pivot for future R steps on same object
          this.pivotCache.set(objId, pivot);
        }
      }
      // If R axis but no pivot specified, use cached pivot
      if (target.R !== undefined && !pivot && this.pivotCache.has(objId)) {
        pivot = this.pivotCache.get(objId);
      }
      current.steps.push({ objId, target, dur, range, pivot, lineNo });
    }
    finalize();

    // Resolve compositions: expand +refs into inline steps
    for (const [name, action] of this.actions) {
      if (action.isComposition) {
        const composed = [];
        let cursor = 0;
        for (const ref of action.refs) {
          const refAction = this.actions.get(ref);
          if (!refAction) {
            return { error: `Composition '${name}': action '${ref}' not found` };
          }
          // Shift step start/end times
          for (const step of refAction.steps) {
            composed.push({ ...step, start: step.start + cursor, end: step.end + cursor, from: { ...step.from }, to: { ...step.to } });
          }
          cursor = Math.max(cursor + refAction.duration, composed.length ? composed[composed.length-1].end : 0);
        }
        action.steps = composed;
        action.isComposition = false;
        action.refs = null;
        action.duration = Math.max(0, ...composed.map(s => s.end));
      }
    }

    return { actions: this.actions };
  }

  /* Apply interpolated state at given time t for an action.
     Steps are sorted by start time. For each step, if t < step.start, skip (do nothing).
     Uses SVG transform attribute with rotate(angle, cx, cy) for proper pivot support
     (reads inkscape:transform-center-x/y from element). */
  applyState(action, t) {
    if (!action.steps.length) return;
    // Handle text overlay: find text steps that are active at time t
    let activeText = null;
    for (const step of action.steps) {
      if (step.isText) {
        if (t >= step.start && t < step.end) {
          activeText = step.text;
        }
      }
    }
    if (this.onTextChange) this.onTextChange(activeText, activeText !== null);

    const byObj = new Map();
    for (const step of action.steps) {
      if (step.isText) continue;  // skip text in normal flow
      if (!byObj.has(step.objId)) byObj.set(step.objId, []);
      byObj.get(step.objId).push(step);
    }
    for (const [objId, steps] of byObj.entries()) {
      let active = null;
      for (const step of steps) {
        if (step.start <= t) active = step;
        else break;
      }
      const el = this.svgDoc.getElementById(objId);
      if (!el) continue;
      let rotCx = null, rotCy = null;
      const activeStep = active;
      if (activeStep && activeStep.pivot) {
        try {
          const bb = el.getBBox();
          rotCx = bb.x + bb.width / 2 + activeStep.pivot.x;
          rotCy = bb.y + bb.height / 2 + activeStep.pivot.y;
        } catch(e) { rotCx = 0; rotCy = 0; }
      } else {
        const cxAttr = el.getAttribute('inkscape:transform-center-x');
        const cyAttr = el.getAttribute('inkscape:transform-center-y');
        if (cxAttr !== null && cyAttr !== null) {
          try {
            const bb = el.getBBox();
            rotCx = bb.x + bb.width / 2 + parseFloat(cxAttr);
            rotCy = bb.y + bb.height / 2 + parseFloat(cyAttr);
          } catch(e) { rotCx = 0; rotCy = 0; }
        } else {
          try {
            const bb = el.getBBox();
            rotCx = bb.x + bb.width / 2;
            rotCy = bb.y + bb.height / 2;
          } catch(e) { rotCx = 0; rotCy = 0; }
        }
      }
      if (!active) {
        const orig = (this.originalTransforms && this.originalTransforms.get(objId)) || null;
        const animTransform = `translate(0 0) rotate(0 ${rotCx.toFixed(3)} ${rotCy.toFixed(3)}) scale(1)`;
        el.setAttribute('transform', orig ? `${orig} ${animTransform}` : animTransform);
        continue;
      }
      let x = active.from.x, y = active.from.y, r = active.from.r, o = (active.from.o !== undefined ? active.from.o : 1);
      let sx = (active.from.sx !== undefined ? active.from.sx : 1);
      let sy = (active.from.sy !== undefined ? active.from.sy : 1);
      if (t >= active.end) {
        x = active.to.x; y = active.to.y; r = active.to.r;
        o = (active.to.o !== undefined ? active.to.o : o);
        sx = (active.to.sx !== undefined ? active.to.sx : sx);
        sy = (active.to.sy !== undefined ? active.to.sy : sy);
      } else if (t > active.start) {
        const frac = (t - active.start) / (active.end - active.start);
        x = active.from.x + (active.to.x - active.from.x) * frac;
        y = active.from.y + (active.to.y - active.from.y) * frac;
        r = active.from.r + (active.to.r - active.from.r) * frac;
        if (active.from.sx !== undefined || active.to.sx !== undefined) {
          const fx = (active.from.sx !== undefined ? active.from.sx : 1);
          const tx = (active.to.sx !== undefined ? active.to.sx : fx);
          sx = fx + (tx - fx) * frac;
        }
        if (active.from.sy !== undefined || active.to.sy !== undefined) {
          const fy = (active.from.sy !== undefined ? active.from.sy : 1);
          const ty = (active.to.sy !== undefined ? active.to.sy : fy);
          sy = fy + (ty - fy) * frac;
        }
        if (active.from.o !== undefined || active.to.o !== undefined) {
          const of = (active.from.o !== undefined ? active.from.o : 1);
          const ot = (active.to.o !== undefined ? active.to.o : of);
          o = of + (ot - of) * frac;
        }
      }
      const animTransform = `translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${r.toFixed(3)} ${rotCx.toFixed(3)} ${rotCy.toFixed(3)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`;
      const orig = (this.originalTransforms && this.originalTransforms.get(objId)) || null;
      el.setAttribute('transform', orig ? `${orig} ${animTransform}` : animTransform);
      // Set opacity ABSOLUTELY (overrides original style opacity)
      el.setAttribute('opacity', o.toFixed(3));
      el.style.opacity = o.toFixed(3);
    }
  }

  /* Compute pivot for SMIL export. Returns "cx cy" string. */
  computePivotForStep(step, svgDocLocal) {
    const el = svgDocLocal.getElementById(step.objId);
    if (!el) return '0 0';
    let cx, cy;
    if (step.pivot) {
      try {
        const bb = el.getBBox();
        cx = bb.x + bb.width / 2 + step.pivot.x;
        cy = bb.y + bb.height / 2 + step.pivot.y;
      } catch(e) { return '0 0'; }
    } else {
      const cxAttr = el.getAttribute('inkscape:transform-center-x');
      const cyAttr = el.getAttribute('inkscape:transform-center-y');
      if (cxAttr !== null && cyAttr !== null) {
        try {
          const bb = el.getBBox();
          cx = bb.x + bb.width / 2 + parseFloat(cxAttr);
          cy = bb.y + bb.height / 2 + parseFloat(cyAttr);
        } catch(e) { return '0 0'; }
      } else {
        try {
          const bb = el.getBBox();
          cx = bb.x + bb.width / 2;
          cy = bb.y + bb.height / 2;
        } catch(e) { return '0 0'; }
      }
    }
    return `${cx.toFixed(3)} ${cy.toFixed(3)}`;
  }
  reset() {
    this.stop();
    if (!this.svgDoc) return;
    const ids = new Set();
    for (const a of this.actions.values()) {
      for (const s of a.steps) ids.add(s.objId);
    }
    for (const id of ids) {
      const el = this.svgDoc.getElementById(id);
      if (!el) continue;
      if (this.originalTransforms && this.originalTransforms.has(id)) {
        const orig = this.originalTransforms.get(id);
        if (orig === null) el.removeAttribute('transform');
        else el.setAttribute('transform', orig);
      } else {
        el.removeAttribute('transform');
      }
    }
  }

  /* Save original transform attribute of all elements that may be animated */
  captureOriginalTransforms() {
    if (!this.svgDoc) return;
    if (!this.originalTransforms) this.originalTransforms = new Map();
    for (const a of this.actions.values()) {
      for (const s of a.steps) {
        if (this.originalTransforms.has(s.objId)) continue;
        const el = this.svgDoc.getElementById(s.objId);
        if (!el) continue;
        this.originalTransforms.set(s.objId, el.getAttribute('transform'));
      }
    }
  }

  /* Play a named action. If player._playScaled is set (speed-scaled), use that. */
  play(name) {
    const action = this._playScaled || this.actions.get(name);
    if (!action) {
      console.warn('Action not found:', name);
      return;
    }
    this.captureOriginalTransforms();
    this.reset();
    this.currentAction = name;
    if (this.onActionStart) this.onActionStart(name, action);
    this.running = true;
    this.startTime = performance.now();
    const tick = (now) => {
      if (!this.running) return;
      const elapsed = now - this.startTime;
      if (elapsed >= action.duration) {
        this.applyState(action, action.duration);
        if (this.onProgress) this.onProgress(1, action.duration, action.duration);
        if (this.onComplete) this.onComplete(name);
        if (this.loop) {
          this.reset();
          this.startTime = now;
        } else {
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
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}

window.ActionPlayer = ActionPlayer;