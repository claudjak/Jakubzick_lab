/* Jakubzick Lab hero: a living field of mononuclear phagocytes, drawn on canvas.
   Macrophages (large, ruffled), dendritic cells (with swaying dendrites), monocytes (small, round) and
   antigen particles drift slowly at rest. The pointer is a chemokine source: monocytes and dendritic cells
   chemotax towards it, macrophages extend a pseudopod towards it, and cells that reach it become activated
   (yellow -> orange glow that fades). Clicking releases a chemokine burst (expanding rings) that recruits
   nearby cells, and macrophages within reach phagocytose the nearest particle. A random macrophage releases a
   small burst every 9 to 16 s while the canvas is on screen. Respects prefers-reduced-motion.
   Dependency-free. Exposes window.JLAB_HERO.burst(x?, y?). */
(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas || !canvas.getContext) return;
  const wrap = canvas.closest(".hero-canvas-wrap") || canvas.parentElement;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rnd = Math.random, TAU = Math.PI * 2;

  const N = { mac: 6, dc: 5, mono: 13, part: 26 };
  const CHEMO_R = 0.42;                 // chemotaxis radius, fraction of canvas size
  const ACT_MS = 1600, SPONT_MS = [9000, 16000], BURST_MS = 1400;
  const YELLOW = [255, 216, 74], ORANGE = [255, 138, 42];
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a == null ? 1 : a})`;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function theme() {
    const attr = document.documentElement.getAttribute("data-theme");
    const dark = attr === "dark" || (attr !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    return dark ? { fill: hex("#3a414d"), rim: hex("#4a5261"), nuc: hex("#262c36"), part: hex("#4a5261"), ring: [143, 176, 210] }
                : { fill: hex("#dcd8cf"), rim: hex("#c3bfb5"), nuc: hex("#bfbab0"), part: hex("#c9c5bb"), ring: [111, 143, 176] };
  }

  let W = 0, H = 0, S = 1;
  let cells = [], parts = [], bursts = [];
  let raf = null, last = 0, visible = true, pointer = null, pointerAt = 0, nextSpont = 0;

  function make() {
    cells = []; parts = [];
    const add = (kind, r) => cells.push({ kind, x: 0.1 + rnd() * 0.8, y: 0.1 + rnd() * 0.8, r, vx: 0, vy: 0, ph: rnd() * TAU, act: 0, actAt: -1e9, ext: 0, dir: rnd() * TAU, nuc: rnd() * TAU, eat: null, seed: rnd() * 100 });
    for (let i = 0; i < N.mac; i++) add("mac", 0.052 + rnd() * 0.014);
    for (let i = 0; i < N.dc; i++) add("dc", 0.024 + rnd() * 0.006);
    for (let i = 0; i < N.mono; i++) add("mono", 0.013 + rnd() * 0.004);
    for (let i = 0; i < N.part; i++) parts.push({ x: rnd(), y: rnd(), r: 0.004 + rnd() * 0.003, vx: 0, vy: 0, ph: rnd() * TAU, gone: 0 });
    relax();
  }
  // push overlapping cells apart a few times so the field starts tidy
  function relax() {
    for (let k = 0; k < 40; k++) for (const a of cells) for (const b of cells) {
      if (a === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3, min = (a.r + b.r) * 1.15;
      if (d < min) { const p = (min - d) / 2; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
    for (const c of cells) { c.x = Math.min(0.94, Math.max(0.06, c.x)); c.y = Math.min(0.94, Math.max(0.06, c.y)); }
  }
  function resize() {
    const rect = wrap.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width)); H = Math.max(1, Math.round(rect.height)); S = Math.min(W, H);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    kick();
  }
  const px = c => [(W - S) / 2 + c.x * S, (H - S) / 2 + c.y * S];

  // --- behaviour ----------------------------------------------------------------
  function activate(c, now, col) { c.act = 1; c.actAt = now; c.col = col || YELLOW; }
  function burst(x, y, now, strength) {
    bursts.push({ x, y, t0: now, s: strength || 1 });
    for (const c of cells) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (c.kind !== "mac" && d < CHEMO_R * (strength || 1)) { c.tx = x; c.ty = y; c.tUntil = now + 2600; }
      if (c.kind === "mac" && d < c.r * 2.4 && !c.eat) eat(c);
      if (d < c.r * 1.3) activate(c, now, ORANGE);
    }
    kick();
  }
  function eat(m) {
    let best = null, bd = Infinity;
    for (const p of parts) { if (p.gone) continue; const d = Math.hypot(p.x - m.x, p.y - m.y); if (d < m.r * 2.6 && d < bd) { bd = d; best = p; } }
    if (best) { m.eat = best; best.eaten = m; }
  }
  function step(dt, now) {
    const k = dt / 1000;
    const ptr = pointer && now - pointerAt < 4000 ? pointer : null;
    for (const c of cells) {
      if (c.act > 0) c.act = Math.max(0, 1 - (now - c.actAt) / ACT_MS);
      // random walk
      if (!reduce) { c.vx += (rnd() - 0.5) * 0.02 * k; c.vy += (rnd() - 0.5) * 0.02 * k; }
      // chemotaxis towards the pointer or a burst target
      let tx = null, ty = null, gain = 0;
      if (c.tUntil > now) { tx = c.tx; ty = c.ty; gain = c.kind === "mono" ? 0.09 : 0.05; }
      if (ptr) { const d = Math.hypot(ptr.x - c.x, ptr.y - c.y); if (d < CHEMO_R) { tx = ptr.x; ty = ptr.y; gain = c.kind === "mono" ? 0.11 : c.kind === "dc" ? 0.06 : 0.02; } }
      if (tx != null) {
        const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy) || 1e-3;
        if (d > c.r * 1.4) { c.vx += dx / d * gain * k; c.vy += dy / d * gain * k; }
        else if (now - c.actAt > ACT_MS * 0.8) activate(c, now, YELLOW);
        c.dir += (Math.atan2(dy, dx) - c.dir + Math.PI * 3) % TAU - Math.PI > 0 ? 3 * k : -3 * k;
        if (c.kind === "mac") c.ext = Math.min(1, c.ext + 1.5 * k);
      } else if (c.kind === "mac") c.ext = Math.max(0, c.ext - 0.8 * k);
      // damping, soft walls, separation
      c.vx *= Math.pow(0.15, k); c.vy *= Math.pow(0.15, k);
      const sp = Math.hypot(c.vx, c.vy), maxv = c.kind === "mono" ? 0.09 : c.kind === "dc" ? 0.05 : 0.025;
      if (sp > maxv) { c.vx *= maxv / sp; c.vy *= maxv / sp; }
      c.x += c.vx * k; c.y += c.vy * k;
      const m = c.r + 0.02;
      if (c.x < m) c.vx += (m - c.x) * 2 * k; if (c.x > 1 - m) c.vx -= (c.x - 1 + m) * 2 * k;
      if (c.y < m) c.vy += (m - c.y) * 2 * k; if (c.y > 1 - m) c.vy -= (c.y - 1 + m) * 2 * k;
    }
    for (const a of cells) for (const b of cells) {
      if (a === b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-3, min = (a.r + b.r) * 1.05;
      if (d < min) { const p = (min - d) * 0.5; a.x -= dx / d * p * 0.5; a.y -= dy / d * p * 0.5; b.x += dx / d * p * 0.5; b.y += dy / d * p * 0.5; }
    }
    for (const p of parts) {
      if (p.eaten) { // drawn into the macrophage, then digested
        const m = p.eaten, dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1e-3;
        p.x += dx / d * Math.min(d, 0.12 * k); p.y += dy / d * Math.min(d, 0.12 * k);
        if (d < m.r * 0.5) { p.gone = Math.min(1, p.gone + 1.2 * k); if (p.gone >= 1) { p.eaten = null; m.eat = null; activate(m, now, ORANGE); Object.assign(p, { x: rnd(), y: rnd(), gone: 0, spawn: 0 }); } }
        continue;
      }
      if (!reduce) { p.vx += (rnd() - 0.5) * 0.01 * k; p.vy += (rnd() - 0.5) * 0.01 * k; p.vx *= Math.pow(0.3, k); p.vy *= Math.pow(0.3, k); p.x += p.vx * k; p.y += p.vy * k; }
      if (p.x < 0.02 || p.x > 0.98) p.vx *= -1; if (p.y < 0.02 || p.y > 0.98) p.vy *= -1;
      if (p.spawn != null && p.spawn < 1) p.spawn += 0.6 * k;
    }
    for (let i = bursts.length - 1; i >= 0; i--) if (now - bursts[i].t0 > BURST_MS) bursts.splice(i, 1);
  }

  // --- drawing ------------------------------------------------------------------
  function blob(cx, cy, r, n, f) {
    const pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, rr = r * f(a, i); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(p[0], p[1], mx, my); }
    const p = pts[0], q = pts[1]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    ctx.closePath();
  }
  function drawCell(c, T, now) {
    const [x, y] = px(c), r = c.r * S, t = now * 0.001, col = c.col || YELLOW;
    const fill = rgba(mix(T.fill, col, c.act * 0.9)), rim = rgba(mix(T.rim, col, c.act));
    ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 1.1;
    if (c.kind === "mac") {
      const wob = reduce ? 0 : 1;
      blob(x, y, r, 22, a => 1 + wob * (0.07 * Math.sin(3 * a + t * 0.7 + c.ph) + 0.05 * Math.sin(5 * a - t * 0.5 + c.seed) + 0.03 * Math.sin(9 * a + t * 1.3))
        + 0.9 * c.ext * Math.pow(Math.max(0, Math.cos(a - c.dir)), 8));
      ctx.fill(); ctx.stroke();
      // kidney-shaped nucleus
      ctx.fillStyle = rgba(mix(T.nuc, col, c.act * 0.5));
      blob(x + Math.cos(c.nuc) * r * 0.22, y + Math.sin(c.nuc) * r * 0.22, r * 0.36, 14, a => 1 - 0.28 * Math.pow(Math.max(0, Math.cos(a - c.nuc - 2.2)), 3));
      ctx.fill();
    } else if (c.kind === "dc") {
      // dendrites first, then the body over them
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        const a = c.ph + i / 7 * TAU + (reduce ? 0 : 0.35 * Math.sin(t * 0.9 + i * 1.7 + c.seed)), len = r * (1.9 + 0.5 * Math.sin(i * 2.1 + c.seed) + (reduce ? 0 : 0.25 * Math.sin(t * 0.6 + i)));
        const bend = 0.5 * Math.sin(t * 0.5 + i + c.seed);
        ctx.strokeStyle = rim; ctx.lineWidth = Math.max(1, r * 0.16);
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
        ctx.quadraticCurveTo(x + Math.cos(a + bend * 0.3) * len * 0.6, y + Math.sin(a + bend * 0.3) * len * 0.6, x + Math.cos(a + bend * 0.5) * len, y + Math.sin(a + bend * 0.5) * len); ctx.stroke();
        if (i % 2 === 0) { const ex = x + Math.cos(a + bend * 0.5) * len, ey = y + Math.sin(a + bend * 0.5) * len; ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(ex, ey, r * 0.13, 0, TAU); ctx.fill(); }
      }
      ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 1.1;
      blob(x, y, r, 12, a => 1 + (reduce ? 0 : 0.06 * Math.sin(4 * a + t + c.ph)));
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(mix(T.nuc, col, c.act * 0.5)); ctx.beginPath(); ctx.arc(x, y, r * 0.42, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(x, y, r * (1 + (reduce ? 0 : 0.04 * Math.sin(t * 1.4 + c.ph))), 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = rgba(mix(T.nuc, col, c.act * 0.5));
      blob(x + Math.cos(c.nuc) * r * 0.1, y + Math.sin(c.nuc) * r * 0.1, r * 0.5, 12, a => 1 - 0.35 * Math.pow(Math.max(0, Math.cos(a - c.nuc)), 2));
      ctx.fill();
    }
  }
  function draw(now) {
    const T = theme();
    ctx.clearRect(0, 0, W, H);
    // chemokine bursts: expanding rings
    for (const b of bursts) {
      const [x, y] = px(b), t = (now - b.t0) / BURST_MS;
      for (let i = 0; i < 3; i++) { const tt = t - i * 0.18; if (tt <= 0) continue; const rr = tt * S * 0.22 * b.s; ctx.strokeStyle = rgba(i ? T.ring : YELLOW, (1 - tt) * 0.55); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); }
    }
    for (const p of parts) {
      const [x, y] = px(p), sc = (p.spawn == null ? 1 : Math.min(1, p.spawn)) * (1 - p.gone);
      if (sc <= 0) continue;
      ctx.fillStyle = rgba(T.part, 0.9); ctx.beginPath(); ctx.arc(x, y, p.r * S * sc, 0, TAU); ctx.fill();
    }
    // draw small cells first so macrophages sit on top when they overlap
    const order = cells.slice().sort((a, b) => a.r - b.r);
    for (const c of order) drawCell(c, T, now);
  }

  // --- loop ------------------------------------------------------------------------
  const moving = () => !reduce || bursts.length || cells.some(c => c.act > 0 || c.tUntil > performance.now()) || parts.some(p => p.eaten);
  function frame(now) {
    raf = null;
    if (!reduce && visible) {
      if (!nextSpont) nextSpont = now + SPONT_MS[0] + rnd() * (SPONT_MS[1] - SPONT_MS[0]);
      if (now >= nextSpont) { const macs = cells.filter(c => c.kind === "mac"); const m = macs[Math.floor(rnd() * macs.length)]; if (m) burst(m.x, m.y, now, 0.6); nextSpont = now + SPONT_MS[0] + rnd() * (SPONT_MS[1] - SPONT_MS[0]); }
    }
    const dt = Math.min(50, last ? now - last : 16); last = now;
    step(dt, now); draw(now);
    if (visible && moving()) raf = requestAnimationFrame(frame); else last = 0;
  }
  function kick() { if (!raf && cells.length) { last = 0; raf = requestAnimationFrame(frame); } }

  // --- input ------------------------------------------------------------------------
  const local = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - (W - S) / 2) / S, y: (e.clientY - r.top - (H - S) / 2) / S }; };
  canvas.addEventListener("pointermove", e => { pointer = local(e); pointerAt = performance.now(); kick(); });
  canvas.addEventListener("pointerleave", () => { pointerAt = -1e9; });
  canvas.addEventListener("pointerdown", e => { const p = local(e); burst(p.x, p.y, performance.now(), 1); });
  canvas.addEventListener("touchmove", e => { const t = e.touches && e.touches[0]; if (t) { pointer = local(t); pointerAt = performance.now(); kick(); } }, { passive: true });

  let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 120); });
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(resize, 60); }).observe(wrap);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", kick); else if (mq.addListener) mq.addListener(kick);
  if (window.MutationObserver) new MutationObserver(kick).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0.02 }).observe(wrap);

  window.JLAB_HERO = { burst(x, y) { burst(x == null ? 0.3 + rnd() * 0.4 : x, y == null ? 0.3 + rnd() * 0.4 : y, performance.now(), 1); } };
  make(); resize();
})();
