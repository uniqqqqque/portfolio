/* ══ Eye tracker ═══════════════════════════════════════════
   Ported from Bencho's "Eye tracker" (EyeTracker / Watcher),
   MIT licence — bencho.dev/licence. Rewritten from React to plain
   DOM for this static site; the markup lives in index.html, so
   without this script the face still shows, it just doesn't move.

   A ball with two eyes that watches your cursor, wherever it is
   on the page.

   ── THE EYES ARE ON THE BALL, NOT IN FRONT OF IT ───────────
   The easy version slides two shapes toward the pointer, and it
   reads as stickers on a disc. Here each eye is a point on the
   sphere's surface: looking left turns the ball, so an eye
   travels along the curve, and the one heading for the rim
   moves less and narrows as it turns away from you while the
   other swings wide. That foreshortening is the whole trick —
   it is what makes a flat circle read as something round.

   One turn (yaw and pitch) is the state, sprung toward where
   the pointer is; both eyes are read off it, so they can never
   disagree. It relaxes back to facing you when the pointer
   leaves the window, and it blinks on its own now and then.

   Written straight to the DOM every frame: a pointer move is
   not a render.

   Left out of the port, because this page uses neither: the
   shape morph and the idle "mark" mode. Settings as picked on
   the bench: the soft square ("Cube"), "Squares" eyes, Follow 50,
   Bounce 30, Size 180px, dark fill. */

(() => {
  const el = document.querySelector(".eyt");
  if (!el) return;

  /* Read once. A preference, not a live input. */
  const still = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const R = 50; /* the ball's radius, in the 100-unit viewBox */

  /* ── the eyes: a style, and where they rest ─────────────────
     Two rounded rectangles, the same size as each other. Any
     difference in SIZE between the two is depth, worked out from
     the turn, never drawn in.

     The face goes where you are: straight on, centred and level
     when you are on top of it, and it comes back to centre when
     the pointer leaves the window. */
  const EYE = { w: 12, h: 12, r: 3.5 }; /* "Squares" */
  /* half the gap between the eyes, as a fraction of the radius */
  const GAP = 0.19;
  /* how far a look to a corner tilts the pair, in degrees at the
     rim — a glance up and right leans them back */
  const TILT = 64;
  /* how far the ball turns toward the pointer, 0..100 */
  const FOLLOW = 50;
  /* how much the turn overshoots and settles, 0..100 */
  const BOUNCE = 30;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const eyes = [...el.querySelectorAll(".eyt-eyes > g")];
  const ball = el.querySelector(".eyt-ball");
  const say = el.querySelector(".eyt-say");
  const sayText = say?.firstElementChild;

  /* where the face is on the ball (fractions of the radius), its
     speed, and where it is heading — one spring on a point, read
     as a turn when the eyes are drawn */
  const t = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  let raf = 0;
  let prev = 0;
  let blink = 0;
  let nextBlink = performance.now() + 2200;

  const draw = (now) => {
    /* a blink is 160ms down and up, as a squash on each eye */
    let lid = 1;
    if (now > nextBlink) {
      blink = now;
      nextBlink = now + 2600 + Math.random() * 3200;
    }
    const since = now - blink;
    if (since < 160) lid = 1 - 0.9 * Math.sin((since / 160) * Math.PI);

    /* the turn that brings the front of the ball to the face's
       spot: yaw about the vertical, pitch about the horizontal */
    const as = (v) => Math.asin(clamp(v, -0.92, 0.92));
    const yaw = as(t.x);
    const pitch = -as(t.y);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    /* the pair leans with a diagonal look and stands level on
       the axes: up-right and down-left lean one way, the other
       two the other, nothing straight on */
    const tilt = TILT * t.x * t.y;

    [-GAP, GAP].forEach((x0, i) => {
      const g = eyes[i];
      if (!g) return;
      /* the eye as a point on the unit sphere, either side of
         the front, turned with the ball */
      const z0 = Math.sqrt(1 - x0 * x0);
      const x1 = x0 * cy + z0 * sy;
      const z1 = -x0 * sy + z0 * cy;
      const y2 = -z1 * sp;
      const z2 = z1 * cp;
      /* depth: the eye nearer the rim is further from you, so it
         is smaller all over and narrower still across the turn */
      const near = clamp(z2, 0, 1);
      const k = 0.45 + 0.55 * near;
      const sx = k * (0.7 + 0.3 * near);
      /* ── the size is written as a size, never as a scale ──
         A scale stretches the corner with the shape: an eye
         narrowed for depth or squashed by a blink had elliptical
         corners, rounder on one side than the other. Writing the
         width and height directly keeps every corner the same
         radius, clamped so it never exceeds half a side. */
      const w = EYE.w * sx;
      const h = Math.max(0.6, EYE.h * k * lid);
      const rect = g.firstElementChild;
      if (rect) {
        rect.setAttribute("x", (-w / 2).toFixed(2));
        rect.setAttribute("y", (-h / 2).toFixed(2));
        rect.setAttribute("width", w.toFixed(2));
        rect.setAttribute("height", h.toFixed(2));
        rect.setAttribute("rx", Math.min(EYE.r, w / 2, h / 2).toFixed(2));
      }
      g.setAttribute(
        "transform",
        `translate(${(50 + x1 * R).toFixed(2)} ${(50 + y2 * R).toFixed(2)}) rotate(${tilt.toFixed(2)})`,
      );
      g.style.opacity = z2 < 0.05 ? "0" : "1";
    });
  };

  /* ── it only runs while it can be seen ───────────────────
     Off screen or in a background tab the loop stops; it starts
     again the moment the ball comes back into view.

     Frames, not milliseconds. `dt` is expressed in sixtieths of
     a second, so a dropped frame moves the spring as far as the
     two frames it replaced. */
  let seen = true;
  const tick = (now) => {
    if (!seen || document.hidden) { raf = 0; prev = 0; return; }
    const dt = prev ? Math.min(2.5, (now - prev) / 16.67) : 1;
    prev = now;
    if (still) {
      t.x = t.tx;
      t.y = t.ty;
    } else {
      /* one spring for both axes; Bounce loosens the damping */
      const k = 0.06;
      const d = 0.34 - (BOUNCE / 100) * 0.22;
      t.vx += ((t.tx - t.x) * k - t.vx * d) * dt;
      t.vy += ((t.ty - t.y) * k - t.vy * d) * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    }
    draw(now);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const resume = () => { if (!raf && seen && !document.hidden) raf = requestAnimationFrame(tick); };
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; resume(); }).observe(el);
  document.addEventListener("visibilitychange", resume);

  /* ── the face goes where you are ──────────────────────────
     A spot out along the pointer's direction, further the
     further away you are — so on top of it the face is dead
     centre, and off in a corner it is out by that corner's
     rim, turned, one eye smaller and the pair leaning.

     There is one of these on the page, not a wall of them, so
     it watches the whole window rather than a card; the reach is
     measured against the window, so the eyes arrive at the rim
     well before the pointer reaches the far edge. */
  const aim = (e) => {
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.max(60, Math.min(innerWidth, innerHeight) * 0.28);
    const far = Math.min(0.85, Math.tanh(d / reach) * (FOLLOW / 100) * 1.5);
    t.tx = (dx / d) * far;
    t.ty = (dy / d) * far;
  };
  const rest = () => { t.tx = 0; t.ty = 0; };
  addEventListener("pointermove", aim, { passive: true });
  document.documentElement.addEventListener("pointerleave", rest);

  /* ── it talks back when you poke it ─────────────────────────
     A press on the ball opens a little chat bubble off its lower
     left (it sits at the right edge of the page, so the right side
     has no room), types one short line into it a letter at a
     time, holds it to be read, and folds it away. Never the same
     line twice running. */
  const LINES = [
    "Hey, I see you.",
    "Boop.",
    "That tickles.",
    "Hi there!",
    "Stop poking me.",
    "I'm watching you.",
    "Again? Okay.",
    "You found me.",
  ];
  const KEY_MS = 38;
  const HOLD_MS = 1500;
  let turn = 0;
  let lastLine = -1;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* types one line into the bubble, holds it, folds it away; a
     newer line cuts an older one short */
  const speak = async (line) => {
    if (!say || !sayText) return;
    const mine = ++turn;
    sayText.textContent = "";
    say.dataset.on = "";
    for (let k = 1; k <= line.length; k++) {
      await wait(KEY_MS + Math.random() * 30);
      if (mine !== turn) return;
      sayText.textContent = line.slice(0, k);
    }
    await wait(HOLD_MS);
    if (mine !== turn) return;
    delete say.dataset.on;
  };
  const poke = () => {
    const pool = LINES.map((_, i) => i).filter((i) => i !== lastLine);
    const i = pool[Math.floor(Math.random() * pool.length)];
    lastLine = i;
    speak(LINES[i]);
  };
  ball?.addEventListener("click", poke);

  /* ── and it says hello first ────────────────────────────────
     One second after the page is up, before anyone pokes it, it
     types "Welcome" once on its own. Counted from now (the page
     has been parsed when a deferred script runs), not from the
     window's load event: that waits for every other script too,
     the analytics one included, and a slow one would hold the
     greeting back. */
  setTimeout(() => speak("Welcome"), 1000);
})();
