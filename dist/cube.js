/* ══ ASCII Rubik's cube ════════════════════════════════════
   A 3×3×3 cube drawn in characters, turning slowly, that
   scrambles itself a layer at a time and then solves itself by
   playing the same moves back.

   Drawn the way the old spinning ASCII donut is: every surface is
   sampled as a cloud of points, each point is projected onto the
   character grid, and a z-buffer keeps the nearest one per cell.
   The light on a point picks its character, from "." (turned
   away) to "@" (facing the light).

   Each of the 26 visible cubies is a block of "black plastic"
   with an inset sticker on each outer face. That is what gives
   the grid lines between stickers, and what keeps the back of the
   cube from showing through the gap while a layer is half-turned.
   The plastic is drawn as blank cells, but they still go in the
   z-buffer, so it hides whatever is behind it.

   One face is coloured, in the site's accent. The other five stay
   in ink: in characters, six colours would be noise, and one is
   enough to watch it scatter and come back. */

(() => {
  const pre = document.querySelector(".cube");
  if (!pre) return;

  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  /* ── the grid ──────────────────────────────────────────────
     A monospace cell is about 0.6 of the font size wide and the
     line height (1.1) tall, so a unit up the screen covers fewer
     rows than a unit across covers columns; ASPECT squares that
     up. Turning about the vertical, the cube is never wider than
     its horizontal diagonal (about 4.3 units), so at SCALE columns
     per unit it spins without touching the sides; ROWS leaves room
     for the tilt. */
  const COLS = 72;
  const ROWS = 44;
  const ASPECT = 0.6 / 1.1;
  const DIST = 11; /* camera distance, in cubie widths */
  const SCALE = 14.8 * DIST; /* columns per unit at the cube's centre */
  const RAMP = ".,-~:;=!*#$@";
  /* point spacing on a face: under half a cell at this scale, so
     a face never shows holes */
  const STEP = 0.03;
  const LIGHT = norm([-0.45, 0.65, -0.6]);

  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  }

  /* 3×3 matrices as flat arrays of nine, row by row */
  const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const mul = (a, b) => {
    const r = new Array(9);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  };
  const apply = (m, v) => [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
  const rot = (axis, t) => {
    const c = Math.cos(t), s = Math.sin(t);
    if (axis === 0) return [1, 0, 0, 0, c, -s, 0, s, c];
    if (axis === 1) return [c, 0, s, 0, 1, 0, -s, 0, c];
    return [c, -s, 0, s, c, 0, 0, 0, 1];
  };

  /* ── the cubies ────────────────────────────────────────────
     Each has a position on the integer grid -1..1 and an
     orientation; its stickers are fixed in its own frame, so a
     turn only ever changes those two things. The hidden centre
     cubie is left out. Face 0 (+x: the side on the right when the
     page opens, turned away from the light) is the accent one. */
  const ACCENT = 0;
  const TONE = { [ACCENT]: 1 };
  /* a coloured sticker never drops below ";" in the ramp: in
     shadow it would otherwise be a field of dots, and the colour
     is the point of it */
  const TINTED_MIN = 5;
  const cubies = [];
  for (let x = -1; x <= 1; x++)
    for (let y = -1; y <= 1; y++)
      for (let z = -1; z <= 1; z++) {
        if (!x && !y && !z) continue;
        const pos = [x, y, z];
        const stickers = [];
        for (let a = 0; a < 3; a++)
          for (const s of [1, -1])
            if (pos[a] === s) stickers.push({ a, s, face: a * 2 + (s < 0 ? 1 : 0) });
        cubies.push({ pos, R: I.slice(), stickers });
      }

  /* point offsets across one face, in the face's own (u, v).
     Counted, not stepped: adding STEP up from -half drifts and
     stopped one step short of +half, which left a sliver between
     two cubies that showed as the odd empty cell. */
  const grid = (half) => {
    const n = Math.ceil((2 * half) / STEP);
    const pts = [];
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n; j++) pts.push([-half + (2 * half * i) / n, -half + (2 * half * j) / n]);
    return pts;
  };
  const BODY = grid(0.5);
  const STICKER = grid(0.44);
  /* under a sticker the plastic is never seen, and drawing it
     anyway makes the two fight: on a face seen edge-on, a plastic
     point nearer the camera along the face wins a cell from the
     sticker point beside it, and the sticker comes out full of
     holes. So an outer face draws only the ring of plastic
     around its sticker. */
  const RING = BODY.filter(([u, v]) => Math.max(Math.abs(u), Math.abs(v)) > 0.44 + 1e-9);
  /* the point (u, v) on the face of axis a, side s, at depth d */
  const facePoint = (a, s, d, u, v) => {
    const p = [0, 0, 0];
    p[a] = s * d;
    p[(a + 1) % 3] = u;
    p[(a + 2) % 3] = v;
    return p;
  };

  /* ── the moves ─────────────────────────────────────────────
     A scramble of MOVES random quarter turns (never the same axis
     twice running, so no two moves cancel or merge), then the
     same list backwards with every turn reversed: it always comes
     home. */
  const MOVES = 8;
  let queue = [];
  const scramble = () => {
    const out = [];
    let last = -1;
    for (let i = 0; i < MOVES; i++) {
      let axis;
      do axis = Math.floor(Math.random() * 3); while (axis === last);
      last = axis;
      out.push({ axis, layer: [-1, 0, 1][Math.floor(Math.random() * 3)], dir: Math.random() < 0.5 ? 1 : -1 });
    }
    const back = out.slice().reverse().map((m) => ({ ...m, dir: -m.dir }));
    return [...out, { pause: 900 }, ...back, { pause: 2200 }];
  };

  const inLayer = (c, m) => m && Math.round(c.pos[m.axis]) === m.layer;
  const finish = (m) => {
    const q = rot(m.axis, (m.dir * Math.PI) / 2).map(Math.round);
    for (const c of cubies) {
      if (!inLayer(c, m)) continue;
      c.pos = apply(q, c.pos).map(Math.round);
      c.R = mul(q, c.R).map(Math.round);
    }
  };

  /* ── drawing one frame ─────────────────────────────────────── */
  const zbuf = new Float32Array(COLS * ROWS);
  const chars = new Array(COLS * ROWS);
  const tone = new Uint8Array(COLS * ROWS);

  const draw = (view, move, angle) => {
    zbuf.fill(Infinity);
    chars.fill(" ");
    tone.fill(0);
    const T = move ? rot(move.axis, angle) : I;

    for (const c of cubies) {
      const moving = inLayer(c, move);
      const A = mul(view, moving ? mul(T, c.R) : c.R);
      const b = apply(view, moving ? apply(T, c.pos) : c.pos);

      for (let a = 0; a < 3; a++)
        for (const s of [1, -1]) {
          /* where this face points on the integer grid, and so
             whether anything sits against it */
          const n = [0, 0, 0];
          n[a] = s;
          const nGrid = apply(c.R, n).map(Math.round);
          const next = [c.pos[0] + nGrid[0], c.pos[1] + nGrid[1], c.pos[2] + nGrid[2]];
          const outer = next.some((v) => Math.abs(v) > 1);
          /* an inner face only shows while the layer it sits
             against is turning away from it */
          if (!outer) {
            if (!move) continue;
            const nextMoving = Math.round(next[move.axis]) === move.layer;
            if (moving === nextMoving) continue;
          }
          const nW = apply(A, n);
          /* turned away from the camera: hidden, skip it */
          const ctr = apply(A, facePoint(a, s, 0.5, 0, 0));
          if (nW[0] * (ctr[0] + b[0]) + nW[1] * (ctr[1] + b[1]) + nW[2] * (ctr[2] + b[2] + DIST) >= 0) continue;

          const lum = Math.max(0, nW[0] * LIGHT[0] + nW[1] * LIGHT[1] + nW[2] * LIGHT[2]);
          const sticker = outer ? c.stickers.find((k) => k.a === a && k.s === s) : null;
          const tint = sticker ? TONE[sticker.face] ?? 0 : 0;
          let level = Math.min(RAMP.length - 1, Math.floor(lum * RAMP.length));
          if (tint) level = Math.max(level, TINTED_MIN);
          const ch = RAMP[level];

          const plot = (pts, depth, glyph, t) => {
            for (const [u, v] of pts) {
              const p = apply(A, facePoint(a, s, depth, u, v));
              const z = p[2] + b[2] + DIST;
              const k = SCALE / z;
              const col = Math.round(COLS / 2 + (p[0] + b[0]) * k);
              const row = Math.round(ROWS / 2 - (p[1] + b[1]) * k * ASPECT);
              if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
              const i = row * COLS + col;
              if (z < zbuf[i]) { zbuf[i] = z; chars[i] = glyph; tone[i] = t; }
            }
          };
          plot(sticker ? RING : BODY, 0.5, " ", 0);
          if (sticker) plot(STICKER, 0.51, ch, tint);
        }
    }

    /* runs of the same tone become one span, not one per cell */
    const wrap = (t, run) => (t ? `<span class="${["", "a"][t]}">${run}</span>` : run);
    let html = "";
    for (let r = 0; r < ROWS; r++) {
      let run = "", t = 0;
      for (let col = 0; col < COLS; col++) {
        const i = r * COLS + col;
        if (tone[i] !== t) { html += wrap(t, run); run = ""; t = tone[i]; }
        run += chars[i];
      }
      html += wrap(t, run) + (r < ROWS - 1 ? "\n" : "");
    }
    pre.innerHTML = html;
  };

  /* the camera looks a little down on it, so the top face shows,
     and it turns slowly about the vertical */
  const viewAt = (t) => mul(rot(0, -0.5 + Math.sin(t * 0.00031) * 0.12), rot(1, 0.7 + t * 0.00028));

  if (still) {
    draw(viewAt(0), null, 0);
    return;
  }

  /* ── the loop ──────────────────────────────────────────────
     A quarter turn takes 420ms, eased in and out so it starts
     and lands softly, with a beat between moves. It only runs
     while the cube can be seen. */
  const TURN_MS = 420;
  const GAP_MS = 140;
  let move = null, moveStart = 0, waitUntil = 0;
  let raf = 0, seen = true;

  const tick = (now) => {
    if (!seen || document.hidden) { raf = 0; return; }
    let angle = 0;
    if (move) {
      const u = Math.min(1, (now - moveStart) / TURN_MS);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      angle = (move.dir * Math.PI * e) / 2;
      if (u >= 1) { finish(move); move = null; angle = 0; waitUntil = now + GAP_MS; }
    } else if (now >= waitUntil) {
      if (!queue.length) queue = scramble();
      const next = queue.shift();
      if (next.pause) waitUntil = now + next.pause;
      else { move = next; moveStart = now; }
    }
    draw(viewAt(now), move, angle);
    raf = requestAnimationFrame(tick);
  };
  waitUntil = performance.now() + 1200;
  const resume = () => { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; resume(); }).observe(pre);
  document.addEventListener("visibilitychange", resume);
  resume();
})();
