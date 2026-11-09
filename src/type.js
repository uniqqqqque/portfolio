/* ══ Typing the name ═══════════════════════════════════════
   The name types itself in once on load: one letter every 38ms
   (about 0.6s for the whole name), an accent caret at the end of
   what is typed, which blinks twice when it is done and goes.

   The letters that are not typed yet are there all along, only
   invisible, so the line has its full width from the first frame
   and nothing next to it (the cube with eyes) moves. The caret
   has no width of its own for the same reason. Screen readers get
   the whole name at once from aria-label.

   Without the script, or with reduced motion asked for, the name
   is simply there. */

(() => {
  const h1 = document.querySelector(".hero__name");
  if (!h1) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const KEY_MS = 38;
  const START_MS = 120;
  const text = h1.textContent.trim();

  h1.setAttribute("aria-label", text);
  h1.textContent = "";
  const letters = [...text].map((ch) => {
    const s = document.createElement("span");
    s.className = "type-off";
    s.setAttribute("aria-hidden", "true");
    s.textContent = ch;
    h1.appendChild(s);
    return s;
  });
  const caret = document.createElement("span");
  caret.className = "type-caret";
  caret.setAttribute("aria-hidden", "true");
  h1.insertBefore(caret, letters[0]);
  h1.classList.add("typing");

  let i = 0;
  const key = () => {
    letters[i].classList.remove("type-off");
    i++;
    h1.insertBefore(caret, letters[i] ?? null);
    if (i < letters.length) setTimeout(key, KEY_MS);
    else {
      caret.classList.add("type-done");
      caret.addEventListener("animationend", () => caret.remove(), { once: true });
    }
  };
  setTimeout(key, START_MS);
})();
