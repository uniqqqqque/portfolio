/* ══ Link accordion ════════════════════════════════════════
   After Bencho's "Image accordion" (MIT, bencho.dev/licence),
   rewritten from React to plain DOM and turned on its side: the
   pictures are the link rows, stacked as they always were, and
   what is negotiated is their HEIGHT. Point at one and it opens;
   the others give up exactly what it takes.

   Without this script (or on a touch screen, or with reduced
   motion asked for) the list is the plain list it was before.

   ── THE LIST IS A FIXED HEIGHT, AND THAT IS THE COMPONENT ──
   Nothing here grows. The list is measured once at rest and held
   at that height, so opening a row is a NEGOTIATION rather than
   an expansion: every pixel the one you are pointing at gains,
   the others have paid for between them. That is what makes it
   feel like one object with pieces rather than six rows that
   happen to be in a column — and it is why the layout is flexbox
   with six grow numbers rather than six heights worked out by
   hand. Flex does the arithmetic of who pays, at every count and
   every gap, and it cannot be got wrong. It also means nothing
   below the list (the footer) ever moves.

   ── AND THE SWELL CARRIES ─────────────────────────────────
   The neighbours of the open row open a little too. The reflex
   is one row tall and five rows short, which reads as a switch
   being thrown; a falloff reads as a force arriving somewhere.

   ── WHY POINTING IS STABLE ────────────────────────────────
   A list that resizes under the cursor sounds like it should
   oscillate and does not: the row you point at is the one that
   GROWS. Its edges move away from your pointer, never across it,
   so it cannot shrink out from under you and hand the hover to a
   neighbour. Everything that shrinks is something you are not
   on. */

(() => {
  const list = document.querySelector(".links__list");
  if (!list) return;
  const rows = [...list.children];
  if (!rows.length) return;

  /* Read once. A preference, not a live input. A finger has no
     hover, so on touch the rows would only jump on the way to
     being followed; there the list stays still. */
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /* ── how much the open one takes ───────────────────────────
     As a share of what an unopened row has. Bencho draws its
     pictures at 50 (1.8, nearly three times a resting one). Rows
     of text are not pictures: a shrinking row still has to hold
     its name, and at 50 the five that pay would be squeezed to
     about three quarters of their resting height, which is where
     the padding runs out. 35 (about 1.4) leaves them at four
     fifths, and the open row at nearly twice its resting height. */
  const OPEN = 35;
  const lift = (open) => 0.4 + (clamp(open, 0, 100) / 100) * 2.8;

  /* ── and how far the swell carries ─────────────────────────
     A gaussian on the distance in rows, so it is smooth and it
     never reaches a row three away with anything you could see.

     0.35 puts the first neighbour at three ten-thousandths —
     off, in every sense that matters — and 1.25 puts it at
     better than half. The default of 35 lands it at a tenth,
     which is where a neighbour is visibly paying less than the
     ones further out without looking like it is opening too. */
  const REACH = 35;
  const fall = (d, reach) => {
    const s = 0.35 + (clamp(reach, 0, 100) / 100) * 0.9;
    return Math.exp(-((d / s) ** 2));
  };

  /* ── the spring ─────────────────────────────────────────────
     0..100 into the two numbers a spring actually has. The pair
     is chosen by DAMPING RATIO and then written back as stiffness
     and decay, because the ratio is the thing a person is
     actually setting and the two numbers on their own do not say
     what they add up to.

       zeta = -ln(d) / (2 * sqrt(k))

       0   → zeta ~0.85, heavy, arrives without a ring
       50  → zeta ~0.41
       100 → zeta ~0.20, lively, two visible rebounds

     Bencho's accordion runs at 10: nearly no ring, because these
     are one height being divided, and a visible overshoot would
     be the list visibly failing to add up. */
  const BOUNCE = 10;
  const k = 0.08 + (BOUNCE / 100) * 0.16; /* stiffness: how hard it is pulled */
  const d = 0.62 + (BOUNCE / 100) * 0.2; /* decay, per frame: how much velocity survives */

  const K = lift(OPEN);
  /* Units matter. The snap threshold is absolute, so the springs
     run over 0..100 — a spring driven over 0..1 would be
     "settled" before it had visibly moved. */
  const cur = rows.map(() => 0);
  const vel = rows.map(() => 0);
  let at = null; /* which row the pointer is on; null, not -1, so "none" is not the first */
  let raf = 0;
  let prev = 0;

  const want = (i) => (at === null ? 0 : fall(Math.abs(i - at), REACH) * 100);

  const paint = () => {
    rows.forEach((row, i) => { row.style.flexGrow = (1 + K * (cur[i] / 100)).toFixed(4); });
  };

  /* ── one spring each, and NO stagger ───────────────────────
     These six are not six things responding in turn, they are
     one height being divided — if the row at the end gave up its
     share a beat after the one next to it, the list would visibly
     fail to add up for that beat. They move together because
     they are the same measurement: one loop drives all six.

     Frames, not milliseconds. `dt` is in sixtieths of a second
     and the decay is RAISED to it rather than multiplied by it,
     so a dropped frame loses the same energy as the two frames
     it replaced. The loop parks itself the moment every row has
     settled. */
  const tick = (t) => {
    const dt = prev ? clamp((t - prev) / 16.67, 0, 2.5) : 1;
    prev = t;
    let moving = false;
    rows.forEach((_, i) => {
      const target = want(i);
      vel[i] += (target - cur[i]) * k * dt;
      vel[i] *= Math.pow(d, dt);
      cur[i] += vel[i] * dt;
      if (Math.abs(target - cur[i]) < 0.02 && Math.abs(vel[i]) < 0.02) {
        cur[i] = target;
        vel[i] = 0;
      } else {
        moving = true;
      }
    });
    paint();
    if (moving) raf = requestAnimationFrame(tick);
    else { raf = 0; prev = 0; }
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };
  const point = (i) => { if (at === i) return; at = i; go(); };

  /* ── the list's own size ───────────────────────────────────
     Measured from the plain list, so at rest every row is exactly
     the height it always was and nothing on the page shifts when
     the script arrives. Measured again whenever the width changes
     what a row holds (the type is fluid), and once the font has
     loaded, which changes the line height under it. */
  const measure = () => {
    list.classList.remove("acc");
    list.style.height = "";
    list.style.height = `${list.getBoundingClientRect().height}px`;
    list.classList.add("acc");
  };
  measure();
  let w = innerWidth;
  addEventListener("resize", () => { if (innerWidth !== w) { w = innerWidth; measure(); } });
  document.fonts?.ready.then(measure);

  rows.forEach((row, i) => {
    row.addEventListener("pointerenter", () => point(i));
    /* the keyboard opens a row too: a focused link is the row
       being looked at, same as one under the pointer */
    row.addEventListener("focusin", () => point(i));
  });
  const shut = () => point(null);
  list.addEventListener("pointerleave", shut);
  list.addEventListener("pointercancel", shut);
  list.addEventListener("focusout", (e) => { if (!list.contains(e.relatedTarget)) shut(); });
})();
