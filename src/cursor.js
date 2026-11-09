/* ══ Spring mouse follow ═══════════════════════════════════
   After Skiper UI's "Mouse follow animations" (skiper61, the
   SpringMouseFollow variant) by gxuri — skiper-ui.com. Free
   components are "free to use and modify in both personal and
   commercial projects"; attribution to Skiper UI is required.

   The original runs on framer-motion's useSpring. This is the
   same spring written out by hand, so the page needs no library:
   a dot that rides the pointer, fading and growing in when the
   pointer arrives and shrinking away when it leaves. Here it
   follows across the whole window rather than inside one box,
   and it is centred on the pointer rather than hanging off it.

   Touch screens get nothing (a finger has no hover to follow),
   and nor does anyone who asked for reduced motion. */

(() => {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;

  /* Skiper's numbers were stiffness 131, damping 10: a dot that
     trails a good way behind the pointer. Here it is meant to sit
     on the pointer, so the spring is about five times stiffer and
     damped just past critical (2·√(k·m) ≈ 15.5): it catches up in
     a few frames and never swings past. */
  const SPRING = {
    mass: 0.1, // avoid Controls inertia (how sluggish or responsive the object feels). Lower mass = snappier motion; higher mass = lethargic motion
    damping: 16, // its like the weight of the ball heavier the ball less it will bounce or harder the rubber band the more it will bounce
    stiffness: 600, // like rubber Band the more you strech the more speed it goes back to the original position
  };

  const dot = document.createElement("div");
  dot.className = "follow-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);

  /* x, y, opacity and scale: four springs with the same settings,
     as in the original — each has a value, a velocity and a target */
  const s = {
    x: { v: 0, vel: 0, to: 0 },
    y: { v: 0, vel: 0, to: 0 },
    o: { v: 0, vel: 0, to: 0 },
    k: { v: 0, vel: 0, to: 0 },
  };
  const springs = Object.values(s);

  /* F = -stiffness·(x - target) - damping·v, a = F / mass. With
     these numbers the natural frequency is about 77 rad/s, far too
     fast to step once per 16ms frame, so each frame is cut into
     2ms steps (semi-implicit Euler). */
  const step = (sp, dt) => {
    const a = (-SPRING.stiffness * (sp.v - sp.to) - SPRING.damping * sp.vel) / SPRING.mass;
    sp.vel += a * dt;
    sp.v += sp.vel * dt;
  };

  let raf = 0;
  let prev = 0;
  const tick = (now) => {
    const t = prev ? Math.min(0.05, (now - prev) / 1000) : 1 / 60;
    prev = now;
    const n = Math.max(1, Math.ceil(t / 0.002));
    for (let i = 0; i < n; i++) springs.forEach((sp) => step(sp, t / n));
    dot.style.opacity = Math.max(0, Math.min(1, s.o.v)).toFixed(3);
    dot.style.transform =
      `translate3d(${s.x.v.toFixed(2)}px, ${s.y.v.toFixed(2)}px, 0) scale(${Math.max(0, s.k.v).toFixed(3)})`;
    /* park once everything has arrived */
    const settled = springs.every((sp) => Math.abs(sp.v - sp.to) < 0.01 && Math.abs(sp.vel) < 0.01);
    if (settled) { raf = 0; prev = 0; return; }
    raf = requestAnimationFrame(tick);
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(tick); };

  let inside = false;
  addEventListener("pointermove", (e) => {
    s.x.to = e.clientX;
    s.y.to = e.clientY;
    if (!inside) {
      inside = true;
      /* the first move after arriving: start from the pointer, not
         from wherever the dot was left, or it flies in from a corner */
      if (s.k.v < 0.05) { s.x.v = s.x.to; s.y.v = s.y.to; s.x.vel = s.y.vel = 0; }
      s.o.to = 1;
      s.k.to = 1;
    }
    go();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => {
    inside = false;
    s.o.to = 0;
    s.k.to = 0;
    go();
  });
})();
